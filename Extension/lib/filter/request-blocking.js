/**
 * ----------------------------------------------------------------------------------
 * PurifyBrowserExtension request-blocking.js
 * Licensed under MIT (https://github.com/CyberPurify/CyberPurify/blob/main/LICENSE)
 * ----------------------------------------------------------------------------------
 */

purify.webRequestService = (function (purify) {
  "use strict";

  const onRequestBlockedChannel = purify.utils.channels.newChannel();

  /**
   * Checks if we can collect hit stats for this tab:
   * Option "Send ad filters usage" is enabled and tab isn't incognito
   * @param {object} tab
   * @returns {boolean}
   */
  const canCollectHitStatsForTab = function (tab) {
    if (!tab) {
      return purify.settings.collectHitsCount();
    }

    return (
      tab &&
      purify.settings.collectHitsCount() &&
      !purify.frames.isIncognitoTab(tab)
    );
  };

  /**
   * Records filtering rule hit
   *
   * @param tab            Tab object
   * @param requestRule    Rule to record
   * @param requestUrl     Request URL
   */
  const recordRuleHit = function (tab, requestRule, requestUrl) {
    if (
      requestRule &&
      !purify.utils.filters.isUserFilterRule(requestRule) &&
      !purify.utils.filters.isWhiteListFilterRule(requestRule) &&
      canCollectHitStatsForTab(tab)
    ) {
      const domain = purify.frames.getFrameDomain(tab);
      purify.hitStats.addRuleHit(
        domain,
        requestRule.ruleText,
        requestRule.filterId,
        requestUrl
      );
    }
  };

  /**
   * An object with the selectors and scripts to be injected into the page
   * @typedef {Object} SelectorsAndScripts
   * @property {SelectorsData} selectors An object with the CSS styles that needs to be applied
   * @property {string} scripts Javascript to be injected into the page
   * @property {boolean} collapseAllElements If true, content script must force the collapse check of the page elements
   */

  /**
   * Prepares CSS and JS which should be injected to the page.
   *
   * @param tab                       Tab data
   * @param documentUrl               Document URL
   * @param cssFilterOptions          Bitmask for the CssFilter
   * @param {boolean} retrieveScripts Indicates whether to retrieve JS rules or not
   *
   * When cssFilterOptions and retrieveScripts are undefined, we handle it in a special way
   * that depends on whether the browser supports inserting CSS and scripts from the background page
   *
   * @returns {SelectorsAndScripts} an object with the selectors and scripts to be injected into the page
   */
  const processGetSelectorsAndScripts = function (
    tab,
    documentUrl,
    cssFilterOptions,
    retrieveScripts
  ) {
    const result = Object.create(null);

    if (!tab) {
      return result;
    }

    if (!purify.requestFilter.isReady()) {
      result.requestFilterReady = false;
      return result;
    }

    if (purify.frames.isTabProtectionDisabled(tab)) {
      return result;
    }

    // Looking for the whitelist rule
    let whitelistRule = purify.frames.getFrameWhiteListRule(tab);
    if (!whitelistRule) {
      // Check whitelist for current frame
      const mainFrameUrl = purify.frames.getMainFrameUrl(tab);
      whitelistRule = purify.requestFilter.findWhiteListRule(
        documentUrl,
        mainFrameUrl,
        purify.RequestTypes.DOCUMENT
      );
    }

    const { CssFilter } = purify.rules;

    // Check what exactly is disabled by this rule
    const elemHideFlag = whitelistRule && whitelistRule.isElemhide();
    const genericHideFlag = whitelistRule && whitelistRule.isGenericHide();

    // content-message-handler calls it in this way
    if (
      typeof cssFilterOptions === "undefined" &&
      typeof retrieveScripts === "undefined"
    ) {
      // Build up default flags.
      const { canUseInsertCSSAndExecuteScript } = purify.prefs.features;
      // If tabs.executeScript is unavailable, retrieve JS rules now.
      retrieveScripts = !canUseInsertCSSAndExecuteScript;
      if (!elemHideFlag) {
        cssFilterOptions = CssFilter.RETRIEVE_EXTCSS;
        if (!canUseInsertCSSAndExecuteScript) {
          cssFilterOptions += CssFilter.RETRIEVE_TRADITIONAL_CSS;
        }
        if (genericHideFlag) {
          cssFilterOptions += CssFilter.GENERIC_HIDE_APPLIED;
        }
      }
    } else if (!elemHideFlag && genericHideFlag) {
      cssFilterOptions += CssFilter.GENERIC_HIDE_APPLIED;
    }

    const retrieveSelectors =
      !elemHideFlag &&
      (cssFilterOptions &
        (CssFilter.RETRIEVE_TRADITIONAL_CSS + CssFilter.RETRIEVE_EXTCSS)) !==
        0;

    // It's important to check this after the recordRuleHit call
    // as otherwise we will never record $document rules hit for domain
    if (purify.frames.isTabWhiteListed(tab)) {
      return result;
    }

    if (retrieveSelectors) {
      result.collapseAllElements = purify.requestFilter.shouldCollapseAllElements();
      result.selectors = purify.requestFilter.getSelectorsForUrl(
        documentUrl,
        cssFilterOptions
      );
    }

    if (retrieveScripts) {
      const jsInjectFlag = whitelistRule && whitelistRule.isJsInject();
      if (!jsInjectFlag) {
        // JS rules aren't disabled, returning them
        result.scripts = purify.requestFilter.getScriptsStringForUrl(
          documentUrl,
          tab
        );
      }
    }
    // https://github.com/CyberPurify/PurifyBrowserExtension/issues/1337
    result.collectRulesHits = elemHideFlag
      ? false
      : purify.webRequestService.isCollectingCosmeticRulesHits(tab);

    return result;
  };

  /**
   * Checks if request that is wrapped in page script should be blocked.
   * We do this because browser API doesn't have full support for intercepting all requests, e.g. WebSocket or WebRTC.
   *
   * @param tab           Tab
   * @param requestUrl    request url
   * @param referrerUrl   referrer url
   * @param requestType   Request type (WEBSOCKET or WEBRTC)
   * @returns {boolean}   true if request is blocked
   */
  const checkPageScriptWrapperRequest = function (
    tab,
    requestUrl,
    referrerUrl,
    requestType
  ) {
    if (!tab) {
      return false;
    }

    let requestRule = getRuleForRequest(
      tab,
      requestUrl,
      referrerUrl,
      requestType
    );
    requestRule = postProcessRequest(
      tab,
      requestUrl,
      referrerUrl,
      requestType,
      requestRule
    );

    purify.requestContextStorage.recordEmulated(
      requestUrl,
      referrerUrl,
      requestType,
      tab,
      requestRule
    );

    return isRequestBlockedByRule(requestRule);
  };

  /**
   * Checks if request is blocked
   *
   * @param tab           Tab
   * @param requestUrl    request url
   * @param referrerUrl   referrer url
   * @param requestType   one of RequestType
   * @returns {boolean}   true if request is blocked
   */
  const processShouldCollapse = function (
    tab,
    requestUrl,
    referrerUrl,
    requestType
  ) {
    if (!tab) {
      return false;
    }

    const requestRule = getRuleForRequest(
      tab,
      requestUrl,
      referrerUrl,
      requestType
    );
    return isRequestBlockedByRule(requestRule);
  };

  /**
   * Checks if requests are blocked
   *
   * @param tab               Tab
   * @param referrerUrl       referrer url
   * @param collapseRequests  requests array
   * @returns {*}             requests array
   */
  const processShouldCollapseMany = function (
    tab,
    referrerUrl,
    collapseRequests
  ) {
    if (!tab) {
      return collapseRequests;
    }

    for (let i = 0; i < collapseRequests.length; i++) {
      const request = collapseRequests[i];
      const requestRule = getRuleForRequest(
        tab,
        request.elementUrl,
        referrerUrl,
        request.requestType
      );
      request.collapse = isRequestBlockedByRule(requestRule);
    }

    return collapseRequests;
  };

  /**
   * Checks if request is blocked by rule
   * Do not allow redirect rules because they can't be used in collapse check functions
   *
   * @param requestRule
   * @returns {*|boolean}
   */
  var isRequestBlockedByRule = function (requestRule) {
    return (
      requestRule &&
      !requestRule.whiteListRule &&
      !requestRule.getReplace() &&
      !requestRule.isRedirectRule()
    );
  };

  /**
   * Checks if popup is blocked by rule
   * @param requestRule
   * @returns {*|boolean|true}
   */
  const isPopupBlockedByRule = function (requestRule) {
    return (
      requestRule && !requestRule.whiteListRule && requestRule.isBlockPopups()
    );
  };

  /**
   * Gets blocked response by rule
   * For details see https://developer.chrome.com/extensions/webRequest#type-BlockingResponse
   * or https://developer.mozilla.org/en-US/Add-ons/WebExtensions/API/webRequest/BlockingResponse
   * @param requestRule   Request rule or null
   * @param requestType   Request type
   * @param requestUrl    Request url
   * @returns {*} Blocked response or null
   */
  const getBlockedResponseByRule = function (
    requestRule,
    requestType,
    requestUrl
  ) {
    if (isRequestBlockedByRule(requestRule)) {
      const isDocumentLevel =
        requestType === purify.RequestTypes.DOCUMENT ||
        requestType === purify.RequestTypes.SUBDOCUMENT;

      if (isDocumentLevel && requestRule.isDocumentRule()) {
        const documentBlockedPage = purify.rules.documentFilterService.getDocumentBlockPageUrl(
          requestUrl,
          requestRule.ruleText
        );

        if (documentBlockedPage) {
          return { documentBlockedPage };
        }

        return null;
      }

      // Don't block main_frame request
      if (requestType !== purify.RequestTypes.DOCUMENT) {
        return { cancel: true };
      }
      // check if request rule is blocked by rule and is redirect rule
    } else if (
      requestRule &&
      !requestRule.whiteListRule &&
      requestRule.isRedirectRule()
    ) {
      const redirectOption = requestRule.getRedirect();
      const redirectUrl = redirectOption.getRedirectUrl();
      return { redirectUrl };
    }
    return null;
  };

  /**
   * Finds rule for request
   *
   * @param tab           Tab
   * @param requestUrl    request url
   * @param referrerUrl   referrer url
   * @param requestType   one of RequestType
   * @returns {*}         rule or null
   */
  var getRuleForRequest = function (tab, requestUrl, referrerUrl, requestType) {
    if (purify.frames.isTabProtectionDisabled(tab)) {
      // don't process request
      return null;
    }

    let whitelistRule;
    /**
     * Background requests will be whitelisted if their referrer
     * url will match with user whitelist rule
     * https://github.com/CyberPurify/PurifyBrowserExtension/issues/1032
     */
    if (tab.tabId === purify.BACKGROUND_TAB_ID) {
      whitelistRule = purify.whitelist.findWhiteListRule(referrerUrl);
    } else {
      whitelistRule = purify.frames.getFrameWhiteListRule(tab);
    }

    if (whitelistRule && whitelistRule.isDocumentWhiteList()) {
      // Frame is whitelisted by the main frame's $document rule
      // We do nothing more in this case - return the rule.
      return whitelistRule;
    }
    if (!whitelistRule) {
      // If whitelist rule is not found for the main frame, we check it for referrer
      whitelistRule = purify.requestFilter.findWhiteListRule(
        requestUrl,
        referrerUrl,
        purify.RequestTypes.DOCUMENT
      );
    }

    return purify.requestFilter.findRuleForRequest(
      requestUrl,
      referrerUrl,
      requestType,
      whitelistRule
    );
  };

  /**
   * Finds all content rules for the url
   * @param tab Tab
   * @param documentUrl Document URL
   * @returns collection of content rules or null
   */
  const getContentRules = function (tab, documentUrl) {
    if (purify.frames.shouldStopRequestProcess(tab)) {
      // don't process request
      return null;
    }

    const whitelistRule = purify.requestFilter.findWhiteListRule(
      documentUrl,
      documentUrl,
      purify.RequestTypes.DOCUMENT
    );
    if (whitelistRule && whitelistRule.isContent()) {
      return null;
    }

    return purify.requestFilter.getContentRulesForUrl(documentUrl);
  };

  /**
   * Find CSP rules for request
   * @param tab           Tab
   * @param requestUrl    Request URL
   * @param referrerUrl   Referrer URL
   * @param requestType   Request type (DOCUMENT or SUBDOCUMENT)
   * @returns {Array}     Collection of rules or null
   */
  const getCspRules = function (tab, requestUrl, referrerUrl, requestType) {
    if (purify.frames.shouldStopRequestProcess(tab)) {
      // don't process request
      return null;
    }

    // @@||example.org^$document or @@||example.org^$urlblock — disables all the $csp rules on all the pages matching the rule pattern.
    const whitelistRule = purify.requestFilter.findWhiteListRule(
      requestUrl,
      referrerUrl,
      purify.RequestTypes.DOCUMENT
    );
    if (whitelistRule && whitelistRule.isUrlBlock()) {
      return null;
    }

    return purify.requestFilter.getCspRules(
      requestUrl,
      referrerUrl,
      requestType
    );
  };

  /**
   * Find cookie rules for request
   * @param tab           Tab
   * @param requestUrl    Request URL
   * @param referrerUrl   Referrer URL
   * @param requestType   Request type
   * @returns {Array}     Collection of rules or null
   */
  const getCookieRules = (tab, requestUrl, referrerUrl, requestType) => {
    if (purify.frames.shouldStopRequestProcess(tab)) {
      // Don't process request
      return null;
    }

    const whitelistRule = purify.requestFilter.findWhiteListRule(
      requestUrl,
      referrerUrl,
      purify.RequestTypes.DOCUMENT
    );
    if (whitelistRule && whitelistRule.isDocumentWhiteList()) {
      // $cookie rules are not affected by regular exception rules (@@) unless it's a $document exception.
      return null;
    }

    // Get all $cookie rules matching the specified request
    return purify.requestFilter.getCookieRules(
      requestUrl,
      referrerUrl,
      requestType
    );
  };

  /**
   * Find replace rules for request
   * @param tab
   * @param requestUrl
   * @param referrerUrl
   * @param requestType
   * @returns {*} Collection of rules or null
   */
  const getReplaceRules = (tab, requestUrl, referrerUrl, requestType) => {
    if (purify.frames.shouldStopRequestProcess(tab)) {
      // don't process request
      return null;
    }

    const whitelistRule = purify.requestFilter.findWhiteListRule(
      requestUrl,
      referrerUrl,
      purify.RequestTypes.DOCUMENT
    );

    if (whitelistRule && whitelistRule.isContent()) {
      return null;
    }

    return purify.requestFilter.getReplaceRules(
      requestUrl,
      referrerUrl,
      requestType
    );
  };

  /**
   * Processes HTTP response.
   * It could do the following:
   * 1. Add event to the filtering log (for DOCUMENT requests)
   * 2. Record page stats (if it's enabled)
   *
   * @param tab Tab object
   * @param requestUrl Request URL
   * @param referrerUrl Referrer URL
   * @param requestType Request type
   * @return {void}
   */
  const processRequestResponse = function (
    tab,
    requestUrl,
    referrerUrl,
    requestType
  ) {
    // add page view to stats
    if (requestType === purify.RequestTypes.DOCUMENT) {
      const domain = purify.frames.getFrameDomain(tab);
      if (canCollectHitStatsForTab(tab)) {
        purify.hitStats.addDomainView(domain);
      }
    }
  };

  /**
   * Request post processing, firing events, add log records etc.
   *
   * @param tab           Tab
   * @param requestUrl    request url
   * @param referrerUrl   referrer url
   * @param requestType   one of RequestType
   * @param requestRule   rule
   * @return {object} Request rule if suitable by its own type and request type or null
   */
  var postProcessRequest = function (
    tab,
    requestUrl,
    referrerUrl,
    requestType,
    requestRule
  ) {
    if (requestRule && !requestRule.whiteListRule) {
      const isRequestBlockingRule = isRequestBlockedByRule(requestRule);
      const isPopupBlockingRule = isPopupBlockedByRule(requestRule);
      const isReplaceRule = !!requestRule.getReplace();

      // Url blocking rules are not applicable to the main_frame
      if (
        isRequestBlockingRule &&
        requestType === purify.RequestTypes.DOCUMENT
      ) {
        // except rules with $document and $popup modifiers
        if (!requestRule.isDocumentRule() && !isPopupBlockingRule) {
          requestRule = null;
        }
      }

      // Replace rules are processed in content-filtering.js
      if (isReplaceRule) {
        requestRule = null;
      }

      if (requestRule) {
        purify.listeners.notifyListenersAsync(
          purify.listeners.ADS_BLOCKED,
          requestRule,
          tab,
          1
        );
        const details = {
          tabId: tab.tabId,
          requestUrl,
          referrerUrl,
          requestType,
        };
        details.rule = requestRule.ruleText;
        details.filterId = requestRule.filterId;
        onRequestBlockedChannel.notify(details);
      }
    }

    return requestRule;
  };

  const isCollectingCosmeticRulesHits = (tab) => {
    /**
     * Edge Legacy browser doesn't support css content attribute for node elements except
     * :before and :after
     * Due to this we can't use cssHitsCounter for edge browser
     */
    if (purify.utils.browser.isEdgeBrowser()) {
      return false;
    }

    return canCollectHitStatsForTab(tab) || purify.filteringLog.isOpen();
  };

  // EXPOSE
  return {
    processGetSelectorsAndScripts,
    checkPageScriptWrapperRequest,
    processShouldCollapse,
    processShouldCollapseMany,
    isRequestBlockedByRule,
    isPopupBlockedByRule,
    getBlockedResponseByRule,
    getRuleForRequest,
    getCspRules,
    getCookieRules,
    getContentRules,
    getReplaceRules,
    processRequestResponse,
    postProcessRequest,
    recordRuleHit,
    onRequestBlocked: onRequestBlockedChannel,
    isCollectingCosmeticRulesHits,
  };
})(purify);
