/**
 * ----------------------------------------------------------------------------------
 * PurifyBrowserExtension content-message-handler.js
 * Licensed under MIT (https://github.com/CyberPurify/CyberPurify/blob/main/LICENSE)
 * ----------------------------------------------------------------------------------
 */

/**
 *  Initialize Content => BackgroundPage messaging
 */
(function (purify) {
  "use strict";

  /**
   * Contains event listeners from content pages
   */
  var eventListeners = Object.create(null);

  /**
   * Adds event listener from content page
   * @param message
   * @param sender
   */
  function processAddEventListener(message, sender) {
    var listenerId = purify.listeners.addSpecifiedListener(
      message.events,
      function () {
        if (sender) {
          purify.tabs.sendMessage(sender.tab.tabId, {
            type: "notifyListeners",
            args: Array.prototype.slice.call(arguments),
          });
        }
      }
    );
    eventListeners[listenerId] = sender;
    return { listenerId: listenerId };
  }

  /**
   * Constructs objects that uses on extension pages, like: options.html, thankyou.html etc
   */
  function processInitializeFrameScriptRequest() {
    var enabledFilters = Object.create(null);

    var AntiBannerFiltersId = purify.utils.filters.ids;

    for (var key in AntiBannerFiltersId) {
      if (AntiBannerFiltersId.hasOwnProperty(key)) {
        var filterId = AntiBannerFiltersId[key];
        var enabled = purify.filters.isFilterEnabled(filterId);
        if (enabled) {
          enabledFilters[filterId] = true;
        }
      }
    }

    return {
      userSettings: purify.settings.getAllSettings(),
      enabledFilters: enabledFilters,
      filtersMetadata: purify.subscriptions.getFilters(),
      requestFilterInfo: purify.requestFilter.getRequestFilterInfo(),
      environmentOptions: {
        isMacOs: purify.utils.browser.isMacOs(),
        isChrome: purify.utils.browser.isChromeBrowser(),
        Prefs: {
          locale: purify.app.getLocale(),
          mobile: purify.prefs.mobile || false,
        },
        appVersion: purify.app.getVersion(),
      },
      constants: {
        AntiBannerFiltersId: purify.utils.filters.ids,
        EventNotifierTypes: purify.listeners.events,
      },
    };
  }

  /**
   * Saves css hits from content-script.
   * Message includes stats field. [{filterId: 1, ruleText: 'rule1'}, {filterId: 2, ruleText: 'rule2'}...]
   * @param tab
   * @param stats
   */
  function processSaveCssHitStats(tab, stats) {
    if (!purify.webRequestService.isCollectingCosmeticRulesHits(tab)) {
      return;
    }
    var frameUrl = purify.frames.getMainFrameUrl(tab);
    for (let i = 0; i < stats.length; i += 1) {
      const stat = stats[i];
      const rule = purify.rules.builder.createRule(
        stat.ruleText,
        stat.filterId
      );
      purify.webRequestService.recordRuleHit(tab, rule, frameUrl);
    }
  }

  /**
   * Main function for processing messages from content-scripts
   *
   * @param message
   * @param sender
   * @param callback
   * @returns {*}
   */
  function handleMessage(message, sender, callback) {
    switch (message.type) {
      case "updateUserInfo":
        purify.parentalControl.updateUser(message.info);
        return { ready: true };
      case "getUserInfo":
        purify.parentalControl.getUser((info) => callback(info));
        return true;
      case "unWhiteListFrame":
        purify.userrules.unWhiteListFrame(message.frameInfo);
        break;
      case "addEventListener":
        return processAddEventListener(message, sender);
      case "removeListener":
        var listenerId = message.listenerId;
        purify.listeners.removeListener(listenerId);
        delete eventListeners[listenerId];
        break;
      case "initializeFrameScript":
        return processInitializeFrameScriptRequest();
      case "changeUserSetting":
        purify.settings.setProperty(message.key, message.value);
        break;
      case "checkRequestFilterReady":
        return { ready: purify.requestFilter.isReady() };
      case "addAndEnableFilter":
        purify.filters.addAndEnableFilters([message.filterId]);
        break;
      case "disableAntiBannerFilter":
        if (message.remove) {
          purify.filters.uninstallFilters([message.filterId]);
        } else {
          purify.filters.disableFilters([message.filterId]);
        }
        break;
      case "removeAntiBannerFilter":
        purify.filters.removeFilter(message.filterId);
        break;
      case "enableFiltersGroup":
        purify.categories.enableFiltersGroup(message.groupId);
        break;
      case "disableFiltersGroup":
        purify.categories.disableFiltersGroup(message.groupId);
        break;
      case "changeDefaultWhiteListMode":
        purify.whitelist.changeDefaultWhiteListMode(message.enabled);
        break;
      case "getWhiteListDomains": {
        const whiteListDomains = purify.whitelist.getWhiteListDomains();
        const appVersion = purify.app.getVersion();
        callback({ content: whiteListDomains.join("\r\n"), appVersion });
        break;
      }
      case "saveWhiteListDomains": {
        const domains = message.content
          .split(/[\r\n]+/)
          .map((string) => string.trim())
          .filter((string) => string.length > 0);
        purify.whitelist.updateWhiteListDomains(domains);
        break;
      }
      case "getUserRules":
        purify.userrules.getUserRulesText((content) => {
          const appVersion = purify.app.getVersion();
          callback({ content, appVersion });
        });
        return true;
      case "saveUserRules":
        purify.userrules.updateUserRulesText(message.content);
        break;
      case "addUserRule":
        purify.userrules.addRules([message.ruleText]);
        break;
      case "removeUserRule":
        purify.userrules.removeRule(message.ruleText);
        break;
      case "checkAntiBannerFiltersUpdate":
        purify.ui.checkFiltersUpdates();
        break;
      case "getFiltersMetadata":
        return purify.categories.getFiltersMetadata();
      case "openThankYouPage":
        purify.ui.openThankYouPage();
        break;
      case "openExtensionStore":
        purify.ui.openExtensionStore();
        break;
      case "openTab":
        purify.ui.openTab(message.url, message.options);
        break;
      case "getSelectorsAndScripts": {
        let urlForSelectors;
        // https://github.com/CyberPurify/PurifyBrowserExtension/issues/1498
        // when document url for iframe is about:blank then we use tab url
        if (
          !purify.utils.url.isHttpOrWsRequest(message.documentUrl) &&
          sender.frameId !== 0
        ) {
          urlForSelectors = sender.tab.url;
        } else {
          urlForSelectors = message.documentUrl;
        }
        return (
          purify.webRequestService.processGetSelectorsAndScripts(
            sender.tab,
            urlForSelectors
          ) || {}
        );
      }
      case "checkPageScriptWrapperRequest":
        var block = purify.webRequestService.checkPageScriptWrapperRequest(
          sender.tab,
          message.elementUrl,
          message.documentUrl,
          message.requestType
        );
        return { block: block, requestId: message.requestId };
      case "processShouldCollapse":
        var collapse = purify.webRequestService.processShouldCollapse(
          sender.tab,
          message.elementUrl,
          message.documentUrl,
          message.requestType
        );
        return { collapse: collapse, requestId: message.requestId };
      case "processShouldCollapseMany":
        var requests = purify.webRequestService.processShouldCollapseMany(
          sender.tab,
          message.documentUrl,
          message.requests
        );
        return { requests: requests };
      case "reloadTabById":
        purify.tabs.reload(message.tabId);
        break;
      case "getTabFrameInfoById":
        if (message.tabId) {
          var frameInfo = purify.frames.getFrameInfo({ tabId: message.tabId });
          return { frameInfo: frameInfo };
        } else {
          purify.tabs.getActive(function (tab) {
            var frameInfo = purify.frames.getFrameInfo(tab);
            callback({ frameInfo: frameInfo });
          });
          return true; // Async
        }
      case "addFilterSubscription": {
        const { url, title } = message;
        const hashOptions = {
          action: "add_filter_subscription",
          title,
          url,
        };
        purify.ui.openSettingsTab("antibanner0", hashOptions);
        break;
      }
      case "showAlertMessagePopup":
        purify.ui.showAlertMessagePopup(message.title, message.text);
        break;
      // Popup methods
      case "addWhiteListDomainPopup":
        purify.tabs.getActive(function (tab) {
          purify.ui.whiteListTab(tab);
        });
        break;
      case "removeWhiteListDomainPopup":
        purify.tabs.getActive(function (tab) {
          purify.ui.unWhiteListTab(tab);
        });
        break;
      case "changeApplicationFilteringDisabled":
        purify.ui.changeApplicationFilteringDisabled(message.disabled);
        break;
      // case "openSiteReportTab":
      //   purify.ui.openSiteReportTab(message.url);
      //   break;
      // case "openAbuseTab":
      //   purify.ui.openAbuseTab(message.url);
      //   break;
      case "openLoginTab":
        purify.ui.openLoginTab();
        break;
      case "openSettingsTab":
        purify.ui.openSettingsTab();
        break;
      case "getTabInfoForPopup":
        purify.tabs.getActive((tab) => {
          const frameInfo = purify.frames.getFrameInfo(tab);
          callback({
            frameInfo,
            options: {
              showStatsSupported: true,
              isFirefoxBrowser: purify.utils.browser.isFirefoxBrowser(),
              isMacOs: purify.utils.browser.isMacOs(),
              isEdgeBrowser:
                purify.utils.browser.isEdgeBrowser() ||
                purify.utils.browser.isEdgeChromiumBrowser(),
              notification: purify.notifications.getCurrentNotification(
                frameInfo
              ),
            },
          });
        });
        return true; // Async
      // case "setNotificationViewed":
      //   purify.notifications.setNotificationViewed(message.withDelay);
      //   break;
      // case "resizePanelPopup":
      //   purify.browserAction.resize(message.width, message.height);
      //   break;
      // case "closePanelPopup":
      //   purify.browserAction.close();
      //   break;
      // case "sendFeedback":
      //   purify.backend.sendUrlReport(
      //     message.url,
      //     message.topic,
      //     message.comment
      //   );
      //   break;
      case "saveCssHitStats":
        processSaveCssHitStats(sender.tab, message.stats);
        break;
      case "requestAnalyzeImage":
        const isWhiteListed = purify.frames.isTabWhiteListed(sender.tab);
        const requestUrl = message.requestUrl;

        if (isWhiteListed) {
          callback({ result: false, requestUrl, err: null });

          return;
        }

        if (message.type === "SIGN_CONNECT") {
          return;
        }

        const tabIdUrl = purify.loadingQueue._buildTabIdUrl(sender.tab);

        purify.loadingQueue
          .predict(requestUrl, tabIdUrl)
          .then((result) => {
            const imagesNum = message.imagesNum;
            const arrPurifyUrl = purify.purifyFiltering.purifyUrlCache.cache.getValue(
              tabIdUrl.tabUrl
            );

            if (
              arrPurifyUrl &&
              ((imagesNum <= 20 && arrPurifyUrl.length > 5) ||
                (imagesNum > 20 && arrPurifyUrl.length / imagesNum > 0.2))
            ) {
              const documentBlockedPage = purify.rules.documentFilterService.getDocumentBlockPageUrl(
                requestUrl,
                "Explicit Content"
              );

              purify.rules.documentFilterService.showDocumentBlockPage(
                sender.tab.tabId,
                documentBlockedPage
              );

              purify.parentalControl.syncData();
            } else {
              callback({ result, requestUrl, err: null });
            }
          })
          .catch((err) => callback({ result: false, requestUrl, err }));

        return true;
      default:
        // Unhandled message
        return true;
    }
  }

  // Add event listener from content-script messages
  purify.runtime.onMessage.addListener(handleMessage);

  /**
   * There is no messaging in Safari popover context,
   * so we have to expose this method to keep the message-like style that is used in other browsers for communication between popup and background page.
   */
  purify.runtime.onMessageHandler = handleMessage;
})(purify);
