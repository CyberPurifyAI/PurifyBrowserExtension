/**
 * ----------------------------------------------------------------------------------
 * PurifyBrowserExtension filters.js
 * Licensed under MIT (https://github.com/cyberpurify/CyberPurify/blob/main/LICENSE)
 * ----------------------------------------------------------------------------------
 */

(function (purify) {
  "use strict";

  /**
   * Simple request cache
   * @param requestCacheMaxSize Max cache size
   */
  const RequestCache = function (requestCacheMaxSize) {
    this.requestCache = Object.create(null);
    this.requestCacheSize = 0;
    this.requestCacheMaxSize = requestCacheMaxSize;

    /**
     * Searches for cached filter rule
     *
     * @param requestUrl Request url
     * @param refHost Referrer host
     * @param requestType Request type
     */
    this.searchRequestCache = function (requestUrl, refHost, requestType) {
      const cacheItem = this.requestCache[requestUrl];
      if (!cacheItem) {
        return null;
      }

      const c = cacheItem[requestType];
      if (c && c[1] === refHost) {
        return c;
      }

      return null;
    };

    /**
     * Saves resulting filtering rule to requestCache
     *
     * @param requestUrl Request url
     * @param rule Rule found
     * @param refHost Referrer host
     * @param requestType Request type
     */
    this.saveResultToCache = function (requestUrl, rule, refHost, requestType) {
      if (this.requestCacheSize > this.requestCacheMaxSize) {
        this.clearRequestCache();
      }
      if (!this.requestCache[requestUrl]) {
        this.requestCache[requestUrl] = Object.create(null);
        this.requestCacheSize += 1;
      }

      // Two-levels gives us an ability to not to override cached item for
      // different request types with the same url
      this.requestCache[requestUrl][requestType] = [rule, refHost];
    };

    /**
     * Clears request cache
     */
    this.clearRequestCache = function () {
      if (this.requestCacheSize === 0) {
        return;
      }
      this.requestCache = Object.create(null);
      this.requestCacheSize = 0;
    };
  };

  /**
   * Request filter is main class which applies filter rules.
   *
   * @type {Function}
   */
  const RequestFilter = function () {
    // Bad-filter rules collection
    // https://kb.cyberpurify.com/en/general/how-to-create-your-own-ad-filters#badfilter-modifier
    this.badFilterRules = {};

    // Filter that applies URL blocking rules
    // Basic rules: https://kb.cyberpurify.com/en/general/how-to-create-your-own-ad-filters#basic-rules
    this.urlBlockingFilter = new purify.rules.UrlFilter(
      [],
      this.badFilterRules
    );

    // Filter that applies whitelist rules
    // Exception rules: https://kb.cyberpurify.com/en/general/how-to-create-your-own-ad-filters#exceptions-modifiers
    this.urlWhiteFilter = new purify.rules.UrlFilter([], this.badFilterRules);

    // Filter that applies CSS rules
    // https://kb.cyberpurify.com/en/general/how-to-create-your-own-ad-filters#cosmetic-rules
    this.cssFilter = new purify.rules.CssFilter();

    // Filter that applies JS rules
    // https://kb.cyberpurify.com/en/general/how-to-create-your-own-ad-filters#javascript-rules
    this.scriptFilter = new purify.rules.ScriptFilter();

    // Filter that applies CSP rules
    // https://kb.cyberpurify.com/en/general/how-to-create-your-own-ad-filters#csp-modifier
    this.cspFilter = new purify.rules.CspFilter([], this.badFilterRules);

    // Filter that applies cookie rules
    // https://github.com/CyberPurify/PurifyBrowserExtension/issues/961
    this.cookieFilter = new purify.rules.CookieFilter();

    // Filter that applies stealth rules
    // https://kb.cyberpurify.com/en/general/how-to-create-your-own-ad-filters#stealth-modifier
    this.stealthFilter = new purify.rules.UrlFilter([], this.badFilterRules);

    // Filter that applies replace rules
    // https://kb.cyberpurify.com/en/general/how-to-create-your-own-ad-filters#replace-modifier
    this.replaceFilter = new purify.rules.ReplaceFilter(
      [],
      this.badFilterRules
    );

    // Filter that applies HTML filtering rules
    // https://kb.cyberpurify.com/en/general/how-to-create-your-own-ad-filters#html-filtering-rules
    this.contentFilter = new purify.rules.ContentFilter();

    // Rules count (includes all types of rules)
    this.rulesCount = 0;

    // Init small caches for url filtering rules
    this.urlBlockingCache = new RequestCache(this.requestCacheMaxSize);
    this.urlExceptionsCache = new RequestCache(this.requestCacheMaxSize);
  };

  RequestFilter.prototype = {
    /**
     * Cache capacity
     */
    requestCacheMaxSize: 1000,

    /**
     * Adds rules to the request filter
     *
     * @param rules List of rules to add
     */
    addRules(rules) {
      if (!rules) {
        return;
      }
      for (let i = 0; i < rules.length; i += 1) {
        this.addRule(rules[i]);
      }
    },

    /**
     * Adds rule to the request filter.
     * Rule is added to one of underlying filter objects depending on the rule type.
     *
     * @param rule     Rule to add. Rule should be an object of
     *                 one of these classes: UrlFilterRule, CssFilterRule, ScriptFilterRule
     */
    addRule(rule) {
      if (rule === null || !rule.ruleText) {
        purify.console.error("FilterRule must not be null");
        return;
      }

      if (rule instanceof purify.rules.UrlFilterRule) {
        if (typeof rule.isIgnored === "function" && rule.isIgnored()) {
          purify.console.debug(
            `FilterRule with $extension modifier was omitted. Rule text: "${rule.ruleText}"`
          );
          return;
        }
        if (rule.isCspRule() && !rule.isBadFilter()) {
          this.cspFilter.addRule(rule);
        } else if (rule.isCookieRule()) {
          this.cookieFilter.addRule(rule);
        } else if (rule.isStealthRule() && !rule.isBadFilter()) {
          this.stealthFilter.addRule(rule);
        } else if (rule.isReplaceRule() && !rule.isBadFilter()) {
          this.replaceFilter.addRule(rule);
        } else if (rule.isBadFilter()) {
          this.badFilterRules[rule.badFilter] = rule;
        } else if (rule.whiteListRule) {
          this.urlWhiteFilter.addRule(rule);
        } else {
          this.urlBlockingFilter.addRule(rule);
        }
      } else if (rule instanceof purify.rules.CssFilterRule) {
        this.cssFilter.addRule(rule);
      } else if (rule instanceof purify.rules.ScriptFilterRule) {
        this.scriptFilter.addRule(rule);
      } else if (rule instanceof purify.rules.ScriptletRule) {
        this.scriptFilter.addRule(rule);
      } else if (rule instanceof purify.rules.CompositeRule) {
        rule.rules.forEach(this.addRule.bind(this));
      } else if (rule instanceof purify.rules.ContentFilterRule) {
        this.contentFilter.addRule(rule);
      }

      this.rulesCount++;
      this.urlBlockingCache.clearRequestCache();
      this.urlExceptionsCache.clearRequestCache();
    },

    /**
     * Removes rule from the RequestFilter.
     * Rule is removed from one of underlying filters depending on the rule type.
     *
     * @param rule Rule to be removed
     */
    removeRule(rule) {
      if (rule === null) {
        purify.console.error("FilterRule must not be null");
        return;
      }
      if (rule instanceof purify.rules.UrlFilterRule) {
        if (rule.isCspRule()) {
          this.cspFilter.removeRule(rule);
        } else if (rule.isCookieRule()) {
          this.cookieFilter.removeRule(rule);
        } else if (rule.isStealthRule()) {
          this.stealthFilter.removeRule(rule);
        } else if (rule.isBadFilter()) {
          delete this.badFilterRules[rule.badFilter];
        } else if (rule.whiteListRule) {
          this.urlWhiteFilter.removeRule(rule);
        } else {
          this.urlBlockingFilter.removeRule(rule);
        }
      } else if (rule instanceof purify.rules.CssFilterRule) {
        this.cssFilter.removeRule(rule);
      } else if (rule instanceof purify.rules.ScriptFilterRule) {
        this.scriptFilter.removeRule(rule);
      } else if (rule instanceof purify.rules.ScriptletRule) {
        this.scriptFilter.removeRule(rule);
      } else if (rule instanceof purify.rules.CompositeRule) {
        rule.rules.forEach(this.removeRule.bind(this));
      } else if (rule instanceof purify.rules.ContentFilterRule) {
        this.contentFilter.removeRule(rule);
      }
      this.rulesCount -= 1;
      this.urlBlockingCache.clearRequestCache();
      this.urlExceptionsCache.clearRequestCache();
    },

    /**
     * Returns the array of loaded rules
     */
    getRules() {
      let result = [];

      result = result.concat(this.urlWhiteFilter.getRules());
      result = result.concat(this.urlBlockingFilter.getRules());
      result = result.concat(this.cssFilter.getRules());
      result = result.concat(this.scriptFilter.getRules());
      result = result.concat(this.cspFilter.getRules());
      result = result.concat(this.cookieFilter.getRules());
      result = result.concat(this.stealthFilter.getRules());

      for (const badFilter in this.badFilterRules) {
        result.push(this.badFilterRules[badFilter]);
      }

      return result;
    },

    /**
     * An object with the information on the CSS and ExtendedCss stylesheets which
     * need to be injected into a web page.
     *
     * @typedef {Object} SelectorsData
     * @property {Array.<string>} css Regular CSS stylesheets
     * @property {Array.<string>} extendedCss ExtendedCSS stylesheets
     * @property {boolean} cssHitsCounterEnabled If true - collecting CSS rules hits stats
     * is enabled
     */

    /**
     * Builds CSS for the specified web page.
     * http://cyberpurify.com/en/filterrules.html#hideRules
     *
     * @param {string} url Page URL
     * @param {number} options CssFilter bitmask
     * @returns {SelectorsData} CSS and ExtCss data for the webpage
     */
    getSelectorsForUrl(url, options) {
      const domain = purify.utils.url.getHost(url);

      const { CSS_INJECTION_ONLY } = purify.rules.CssFilter;
      const cssInjectionOnly =
        (options & CSS_INJECTION_ONLY) === CSS_INJECTION_ONLY;

      if (
        !cssInjectionOnly &&
        purify.webRequestService.isCollectingCosmeticRulesHits()
      ) {
        /**
         * If user has enabled "Send statistics for ad filters usage" option we
         * build CSS with enabled hits stats. In this case style contains "content"
         * with filter identifier and rule text.
         */
        return this.cssFilter.buildCssHits(domain, options);
      }
      return this.cssFilter.buildCss(domain, options);
    },

    /**
     * Builds domain-specific JS injection for the specified page.
     * http://cyberpurify.com/en/filterrules.html#javascriptInjection
     *
     * @param url Page URL
     * @param {boolean} debug enabled or disabled debug
     * @returns {{scriptSource: string, rule: string}[]} Javascript for the specified URL
     */
    getScriptsForUrl(url, debug) {
      const domain = purify.utils.url.getHost(url);
      const config = {
        debug,
        domainName: domain,
        engine: "extension",
        version: purify.app && purify.app.getVersion && purify.app.getVersion(),
      };
      return this.scriptFilter.buildScript(domain, config);
    },

    /**
     * Builds the final output string for the specified page.
     * Depending on the browser we either allow or forbid the new remote rules
     * (see how `scriptSource` is used).
     *
     * @param {string} url Page URL
     * @returns {string} Script to be applied
     */
    getScriptsStringForUrl(url, tab) {
      const debug = purify.filteringLog && purify.filteringLog.isOpen();
      const scriptRules = this.getScriptsForUrl(url, debug);

      const isFirefox = purify.utils.browser.isFirefoxBrowser();
      const isOpera = purify.utils.browser.isOperaBrowser();

      const selectedScriptRules = scriptRules.filter((scriptRule) => {
        if (scriptRule.scriptSource === "local") {
          return true;
        }
        if (scriptRule.scriptSource === "remote") {
          /**
           * Note (!) (Firefox, Opera):
           * In case of Firefox and Opera add-ons,
           * JS filtering rules are hardcoded into add-on code.
           * Look at ScriptFilterRule.getScriptSource to learn more.
           */
          /* @if remoteScripts == false */
          if (!isFirefox && !isOpera) {
            return true;
          }
          /* @endif */

          /* @if remoteScripts == true */
          if (!isOpera) {
            return true;
          }
          /* @endif */
        }
        return false;
      });

      if (debug) {
        const domainName = purify.utils.url.getHost(url);
        scriptRules.forEach((scriptRule) => {
          if (
            scriptRule.rule instanceof purify.rules.ScriptletRule ||
            scriptRule.rule.isDomainSpecific(domainName)
          ) {
            purify.filteringLog.addScriptInjectionEvent(
              tab,
              url,
              purify.RequestTypes.DOCUMENT,
              scriptRule.rule
            );
          }
        });
      }

      const scriptsCode = selectedScriptRules
        .map((scriptRule) => scriptRule.script)
        .join("\r\n");

      return `
            (function () {
                try {
                    ${scriptsCode}
                } catch (ex) {
                    console.error('Error executing AG js: ' + ex);
                }
            })();
            `;
    },

    /**
     * Searches for the whitelist rule for the specified pair (url/referrer)
     *
     * @param requestUrl  Request URL
     * @param referrer    Referrer
     * @param requestType Request type
     * @returns Filter rule found or null
     */
    findWhiteListRule(requestUrl, referrer, requestType) {
      const refHost = purify.utils.url.getHost(referrer);
      const thirdParty = purify.utils.url.isThirdPartyRequest(
        requestUrl,
        referrer
      );

      const cacheItem = this.urlExceptionsCache.searchRequestCache(
        requestUrl,
        refHost,
        requestType
      );

      if (cacheItem) {
        // Element with zero index is a filter rule found last time
        return cacheItem[0];
      }

      const rule = this._checkWhiteList(
        requestUrl,
        refHost,
        requestType,
        thirdParty
      );

      this.urlExceptionsCache.saveResultToCache(
        requestUrl,
        rule,
        refHost,
        requestType
      );
      return rule;
    },

    /**
     * Searches for stealth whitelist rule for the specified pair (url/referrer)
     *
     * @param requestUrl  Request URL
     * @param referrer    Referrer
     * @param requestType Request type
     * @returns Filter rule found or null
     */
    findStealthWhiteListRule(requestUrl, referrer, requestType) {
      const refHost = purify.utils.url.getHost(referrer);
      const thirdParty = purify.utils.url.isThirdPartyRequest(
        requestUrl,
        referrer
      );

      // Check if request is whitelisted with document wide rule
      // e.g. "@@||example.org^$stealth"
      let rule = this.stealthFilter.isFiltered(
        referrer,
        refHost,
        requestType,
        thirdParty
      );

      if (!rule) {
        // Check if request is whitelisted with third-party request
        // e.g. "@@||example.org^$domain=ya.ru,stealth"
        rule = this.stealthFilter.isFiltered(
          requestUrl,
          refHost,
          requestType,
          thirdParty
        );
      }

      return rule;
    },

    /**
     * Searches for the filter rule for the specified request.
     *
     * @param requestUrl            Request URL
     * @param documentUrl           Document URL
     * @param requestType           Request content type (one of UrlFilterRule.contentTypes)
     * @param documentWhitelistRule (optional) Document-level whitelist rule
     * @returns Rule found or null
     */
    findRuleForRequest(
      requestUrl,
      documentUrl,
      requestType,
      documentWhitelistRule
    ) {
      const documentHost = purify.utils.url.getHost(documentUrl);
      const thirdParty = purify.utils.url.isThirdPartyRequest(
        requestUrl,
        documentUrl
      );

      const cacheItem = this.urlBlockingCache.searchRequestCache(
        requestUrl,
        documentHost,
        requestType
      );
      if (cacheItem) {
        // Element with zero index is a filter rule found last time
        return cacheItem[0];
      }

      const rule = this._findRuleForRequest(
        requestUrl,
        documentHost,
        requestType,
        thirdParty,
        documentWhitelistRule
      );

      this.urlBlockingCache.saveResultToCache(
        requestUrl,
        rule,
        documentHost,
        requestType
      );
      return rule;
    },

    /**
     * Searches for content rules for the specified domain
     * @param documentUrl Document URL
     * @returns Collection of content rules
     */
    getContentRulesForUrl(documentUrl) {
      const documentHost = purify.utils.url.getHost(documentUrl);
      return this.contentFilter.getRulesForDomain(documentHost);
    },

    /**
     * Searches for elements in document that matches given content rules
     * @param doc Document
     * @param rules Content rules
     * @returns Matched elements
     */
    getMatchedElementsForContentRules(doc, rules) {
      return this.contentFilter.getMatchedElementsForRules(doc, rules);
    },

    /**
     * Searches for CSP rules for the specified request
     * @param requestUrl Request URL
     * @param documentUrl Document URL
     * @param requestType Request Type (DOCUMENT or SUBDOCUMENT)
     * @returns Collection of CSP rules for applying to the request or null
     */
    findCspRules(requestUrl, documentUrl, requestType) {
      const documentHost = purify.utils.url.getHost(documentUrl);
      const thirdParty = purify.utils.url.isThirdPartyRequest(
        requestUrl,
        documentUrl
      );
      return this.cspFilter.findCspRules(
        requestUrl,
        documentHost,
        thirdParty,
        requestType
      );
    },

    findReplaceRules(requestUrl, documentUrl, requestType) {
      const documentHost = purify.utils.url.getHost(documentUrl);
      const thirdParty = purify.utils.url.isThirdPartyRequest(
        requestUrl,
        documentUrl
      );

      return this.replaceFilter.findReplaceRules(
        requestUrl,
        documentHost,
        thirdParty,
        requestType
      );
    },

    /**
     * Searches for cookie rules matching specified request.
     *
     * @param requestUrl Request URL
     * @param documentUrl Document URL
     * @param requestType   Request content type
     * @returns             Matching rules
     */
    findCookieRules(requestUrl, documentUrl, requestType) {
      const documentHost = purify.utils.url.getHost(documentUrl);
      const thirdParty = purify.utils.url.isThirdPartyRequest(
        requestUrl,
        documentUrl
      );

      return this.cookieFilter.findCookieRules(
        requestUrl,
        documentHost,
        thirdParty,
        requestType
      );
    },

    /**
     * Checks if exception rule is present for the URL/Referrer pair
     *
     * @param requestUrl    Request URL
     * @param documentHost  Document URL host
     * @param requestType   Request content type (one of UrlFilterRule.contentTypes)
     * @param thirdParty    Is request third-party or not
     * @returns Filter rule found or null
     * @private
     */
    _checkWhiteList(requestUrl, documentHost, requestType, thirdParty) {
      if (this.urlWhiteFilter === null || !requestUrl) {
        return null;
      }
      return this.urlWhiteFilter.isFiltered(
        requestUrl,
        documentHost,
        requestType,
        thirdParty
      );
    },

    /**
     * Checks if there is a rule blocking this request
     *
     * @param requestUrl    Request URL
     * @param refHost       Referrer host
     * @param requestType   Request content type (one of UrlFilterRule.contentTypes)
     * @param thirdParty    Is request third-party or not
     * @param genericRulesAllowed    Is generic rules allowed
     * @returns Filter rule found or null
     * @private
     */
    _checkUrlBlockingList(
      requestUrl,
      refHost,
      requestType,
      thirdParty,
      genericRulesAllowed
    ) {
      if (this.urlBlockingFilter === null || !requestUrl) {
        return null;
      }

      return this.urlBlockingFilter.isFiltered(
        requestUrl,
        refHost,
        requestType,
        thirdParty,
        !genericRulesAllowed
      );
    },

    /**
     * Searches the rule for request.
     *
     * @param requestUrl    Request URL
     * @param documentHost  Document host
     * @param requestType   Request content type (one of UrlFilterRule.contentTypes)
     * @param thirdParty    Is request third-party or not
     * @param documentWhiteListRule (optional) Document-level whitelist rule
     * @returns Filter rule found or null
     * @private
     */
    _findRuleForRequest(
      requestUrl,
      documentHost,
      requestType,
      thirdParty,
      documentWhiteListRule
    ) {
      purify.console.debug(
        "Filtering http request for url: {0}, document: {1}, requestType: {2}",
        requestUrl,
        documentHost,
        requestType
      );

      // STEP 1: Looking for exception rule, which could be applied to the current request

      // Checks white list for a rule for this RequestUrl.
      // If something is found - returning it.
      const urlWhiteListRule = this._checkWhiteList(
        requestUrl,
        documentHost,
        requestType,
        thirdParty
      );

      // If UrlBlock is set - than we should not use UrlBlockingFilter against this request.
      // Now check if document rule has $genericblock or $urlblock modifier
      const genericRulesAllowed =
        !documentWhiteListRule || !documentWhiteListRule.isGenericBlock();

      const urlRulesAllowed =
        !documentWhiteListRule || !documentWhiteListRule.isUrlBlock();

      // STEP 2: Looking for blocking rule, which could be applied to the current request

      const ruleForRequest = this._checkUrlBlockingList(
        requestUrl,
        documentHost,
        requestType,
        thirdParty,
        genericRulesAllowed
      );

      // STEP 3: Analyze results, first - basic exception rule

      if (
        urlWhiteListRule &&
        // Please note, that if blocking rule has $important modifier, it could
        // overcome existing exception rule
        (urlWhiteListRule.isImportant ||
          !ruleForRequest ||
          !ruleForRequest.isImportant)
      ) {
        purify.console.debug(
          "White list rule found {0} for url: {1} document: {2}, requestType: {3}",
          urlWhiteListRule.ruleText,
          requestUrl,
          documentHost,
          requestType
        );
        return urlWhiteListRule;
      }

      if (!genericRulesAllowed || !urlRulesAllowed) {
        purify.console.debug(
          "White list rule {0} found for document: {1}",
          documentWhiteListRule.ruleText,
          documentHost
        );
      }

      if (!urlRulesAllowed) {
        // URL whitelisted
        return documentWhiteListRule;
      }

      if (ruleForRequest) {
        purify.console.debug(
          "Black list rule {0} found for url: {1}, document: {2}, requestType: {3}",
          ruleForRequest.ruleText,
          requestUrl,
          documentHost,
          requestType
        );
      }

      return ruleForRequest;
    },
  };

  purify.RequestFilter = RequestFilter;
})(purify);
