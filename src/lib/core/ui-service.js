/**
 * ----------------------------------------------------------------------------------
 * PurifyBrowserExtension ui-service.js
 * Licensed under MIT (https://github.com/CyberPurify/CyberPurify/blob/main/LICENSE)
 * ----------------------------------------------------------------------------------
 */

purify.ui = (function (purify) {
  // jshint ignore:line
  const browserActionTitle = purify.i18n.getMessage("name");

  const extensionStoreLink = (function () {
    let browser = "chrome";
    if (purify.utils.browser.isOperaBrowser()) {
      browser = "opera";
    } else if (purify.utils.browser.isFirefoxBrowser()) {
      browser = "firefox";
    } else if (purify.utils.browser.isEdgeChromiumBrowser()) {
      browser = "edge";
    }

    const action = `${browser}_store`;

    return `https://cyberpurify.com/forward.html?action=${action}&from=options_screen&app=browser_extension`;
  })();

  const THANKYOU_PAGE_URL = "https://welcome.cyberpurify.com/v2/thankyou.html";

  /**
   * Update icon for tab
   * @param tab Tab
   * @param options Options for icon or badge values
   */
  function updateTabIcon(tab, options) {
    let icon;
    let badge;
    let badgeColor = "#555";

    if (tab.tabId === purify.BACKGROUND_TAB_ID) {
      return;
    }

    try {
      if (options) {
        icon = options.icon;
        badge = options.badge;
      } else {
        let blocked;
        let disabled;

        const tabInfo = purify.frames.getFrameInfo(tab);
        disabled = tabInfo.applicationFilteringDisabled;
        disabled = disabled || tabInfo.documentWhiteListed;

        if (!disabled) {
          blocked = tabInfo.totalBlockedTab.toString();
        } else {
          blocked = "0";
        }

        if (disabled) {
          icon = purify.prefs.ICONS.ICON_GRAY;
        } else {
          icon = purify.prefs.ICONS.ICON_GREEN;
        }

        badge = purify.utils.workaround.getBlockedCountText(blocked);

        // If there's an active notification, indicate it on the badge
        const notification = purify.notifications.getCurrentNotification(
          tabInfo
        );
        if (notification) {
          badge = notification.badgeText || badge;
          badgeColor = notification.badgeBgColor || badgeColor;

          const hasSpecialIcons = !!notification.icons;

          if (hasSpecialIcons) {
            if (disabled) {
              icon = notification.icons.ICON_GRAY;
            } else {
              icon = notification.icons.ICON_GREEN;
            }
          }
        }
      }

      purify.browserAction.setBrowserAction(
        tab,
        icon,
        badge,
        badgeColor,
        browserActionTitle
      );
    } catch (ex) {
      purify.console.error(
        "Error while updating icon for tab {0}: {1}",
        tab.tabId,
        new Error(ex)
      );
    }
  }

  const updateTabIconAsync = purify.utils.concurrent.debounce((tab) => {
    updateTabIcon(tab);
  }, 250);

  /**
   * Update extension browser action popup window
   * @param tab - active tab
   */
  function updatePopupStats(tab) {
    const tabInfo = purify.frames.getFrameInfo(tab);
    if (!tabInfo) {
      return;
    }
    purify.runtimeImpl.sendMessage({
      type: "updateTotalBlocked",
      tabInfo,
    });
  }

  const updatePopupStatsAsync = purify.utils.concurrent.debounce((tab) => {
    updatePopupStats(tab);
  }, 250);

  function closeAllPages() {
    purify.tabs.forEach((tab) => {
      if (tab.url.indexOf(purify.getURL("")) >= 0) {
        purify.tabs.remove(tab.tabId);
      }
    });
  }

  function getPageUrl(page) {
    return purify.getURL(`pages/${page}`);
  }

  const isPurifyTab = (tab) => {
    const { url } = tab;
    const parsedUrl = new URL(url);
    const schemeUrl = purify.app.getUrlScheme();
    return parsedUrl.protocol.indexOf(schemeUrl) > -1;
  };

  function showAlertMessagePopup(title, text) {
    purify.tabs.getActive((tab) => {
      purify.tabs.sendMessage(tab.tabId, {
        type: "show-alert-popup",
        isPurifyTab: isPurifyTab(tab),
        title,
        text,
      });
    });
  }

  function getFiltersUpdateResultMessage(success, updatedFilters) {
    let title = "";
    let text = "";
    if (success) {
      if (updatedFilters.length === 0) {
        title = "";
        text = purify.i18n.getMessage("options_popup_update_not_found");
      } else {
        title = "";
        text = updatedFilters
          .sort((a, b) => {
            if (a.groupId === b.groupId) {
              return a.displayNumber - b.displayNumber;
            }
            return a.groupId === b.groupId;
          })
          .map((filter) => `"${filter.name}"`)
          .join(", ");
        if (updatedFilters.length > 1) {
          text += ` ${purify.i18n.getMessage("options_popup_update_filters")}`;
        } else {
          text += ` ${purify.i18n.getMessage("options_popup_update_filter")}`;
        }
      }
    } else {
      title = purify.i18n.getMessage("options_popup_update_title_error");
      text = purify.i18n.getMessage("options_popup_update_error");
    }

    return {
      title,
      text,
    };
  }

  function getFiltersEnabledResultMessage(enabledFilters) {
    const title = purify.i18n.getMessage("alert_popup_filter_enabled_title");
    const text = [];
    enabledFilters.sort((a, b) => a.displayNumber - b.displayNumber);
    for (let i = 0; i < enabledFilters.length; i++) {
      const filter = enabledFilters[i];
      text.push(
        purify.i18n
          .getMessage("alert_popup_filter_enabled_text", [filter.name])
          .replace("$1", filter.name)
      );
    }
    return {
      title,
      text,
    };
  }

  /**
   * Open settings tab with hash parameters or without them
   * @param anchor
   * @param hashParameters
   */
  var openSettingsTab = function (anchor, hashParameters = {}) {
    if (anchor) {
      hashParameters.anchor = anchor;
    }

    const options = {
      activateSameTab: true,
      hashParameters,
    };

    openTab(getPageUrl("options.html"), options);
  };

  var openSiteReportTab = function (url) {
    const domain = purify.utils.url.toPunyCode(
      purify.utils.url.getDomainName(url)
    );
    if (domain) {
      openTab(
        `https://cyberpurify.com/site.html?domain=${encodeURIComponent(
          domain
        )}&utm_source=extension&aid=16593`
      );
    }
  };

  /**
   * Opens site complaint report tab
   * https://github.com/CyberPurify/ReportsWebApp#pre-filling-the-app-with-query-parameters
   * @param url
   */
  const openAbuseTab = function (url) {
    let browser;
    let browserDetails;

    const supportedBrowsers = [
      "Chrome",
      "Firefox",
      "Opera",
      "Safari",
      "IE",
      "Edge",
    ];
    if (supportedBrowsers.includes(purify.prefs.browser)) {
      browser = purify.prefs.browser;
    } else {
      browser = "Other";
      browserDetails = purify.prefs.browser;
    }

    const filterIds = purify.filters
      .getEnabledFiltersFromEnabledGroups()
      .map((filter) => filter.filterId);

    openTab(
      `https://reports.cyberpurify.com/new_issue.html?product_type=Ext&product_version=${encodeURIComponent(
        purify.app.getVersion()
      )}&browser=${encodeURIComponent(browser)}${
        browserDetails
          ? `&browser_detail=${encodeURIComponent(browserDetails)}`
          : ""
      }&url=${encodeURIComponent(url)}&filters=${encodeURIComponent(
        filterIds.join(".")
      )}`
    );
  };

  const openLoginTab = function (anchor, hashParameters = {}) {
    if (anchor) {
      hashParameters.anchor = anchor;
    }

    const options = {
      activateSameTab: true,
      hashParameters,
    };

    openTab(getPageUrl("login.html"), options);
  };

  const openThankYouPage = function () {
    const params = purify.utils.browser.getExtensionParams();
    params.push(`_locale=${encodeURIComponent(purify.app.getLocale())}`);
    const thankyouUrl = `${THANKYOU_PAGE_URL}?${params.join("&")}`;

    const filtersDownloadUrl = getPageUrl("filter-download.html");

    purify.tabs.getAll((tabs) => {
      // Finds the filter-download page and reload it within the thank-you page URL
      for (let i = 0; i < tabs.length; i++) {
        const tab = tabs[i];
        if (tab.url === filtersDownloadUrl) {
          // In YaBrowser don't activate found page
          if (!purify.utils.browser.isYaBrowser()) {
            purify.tabs.activate(tab.tabId);
          }
          purify.tabs.reload(tab.tabId, thankyouUrl);
          return;
        }
      }
      openTab(thankyouUrl);
    });
  };

  const openExtensionStore = function () {
    openTab(extensionStoreLink);
  };

  const openFiltersDownloadPage = function () {
    openTab(getPageUrl("filter-download.html"), {
      inBackground: purify.utils.browser.isYaBrowser(),
    });
  };

  var whiteListTab = function (tab) {
    const tabInfo = purify.frames.getFrameInfo(tab);
    purify.whitelist.whiteListUrl(tabInfo.url);
    purify.tabs.reload(tab.tabId);
  };

  var unWhiteListTab = function (tab) {
    const tabInfo = purify.frames.getFrameInfo(tab);
    purify.userrules.unWhiteListFrame(tabInfo);
    purify.tabs.reload(tab.tabId);
  };

  var changeApplicationFilteringDisabled = function (disabled) {
    purify.settings.changeFilteringDisabled(disabled);
    purify.tabs.getActive((tab) => {
      purify.tabs.reload(tab.tabId);
    });
  };

  /**
   * Checks filters updates
   * @param {Object[]} [filters] optional list of filters
   * @param {boolean} [showPopup = true] show update filters popup
   */
  const checkFiltersUpdates = (filters, showPopup = true) => {
    const showPopupEvent = purify.listeners.UPDATE_FILTERS_SHOW_POPUP;
    const successCallback = showPopup
      ? (updatedFilters) => {
          purify.listeners.notifyListeners(
            showPopupEvent,
            true,
            updatedFilters
          );
          purify.listeners.notifyListeners(
            purify.listeners.FILTERS_UPDATE_CHECK_READY
          );
        }
      : (updatedFilters) => {
          if (updatedFilters && updatedFilters.length > 0) {
            const updatedFilterStr = updatedFilters
              .map((f) => `Filter ID: ${f.filterId}`)
              .join(", ");
            purify.console.info(
              `Filters were auto updated: ${updatedFilterStr}`
            );
          }
        };
    const errorCallback = showPopup
      ? () => {
          purify.listeners.notifyListeners(showPopupEvent, false);
          purify.listeners.notifyListeners(
            purify.listeners.FILTERS_UPDATE_CHECK_READY
          );
        }
      : () => {};

    if (filters) {
      purify.filters.checkFiltersUpdates(
        successCallback,
        errorCallback,
        filters
      );
    } else {
      purify.filters.checkFiltersUpdates(successCallback, errorCallback);
    }
  };

  /**
   * Appends hash parameters if they exists
   * @param rowUrl
   * @param hashParameters
   * @returns {string} prepared url
   */
  const appendHashParameters = (rowUrl, hashParameters) => {
    if (!hashParameters) {
      return rowUrl;
    }

    if (rowUrl.indexOf("#") > -1) {
      purify.console.warn(
        `Hash parameters can't be applied to the url with hash: '${rowUrl}'`
      );
      return rowUrl;
    }

    let hashPart;
    const { anchor } = hashParameters;

    if (anchor) {
      delete hashParameters[anchor];
    }

    const hashString = Object.keys(hashParameters)
      .map((key) => `${key}=${hashParameters[key]}`)
      .join("&");

    if (hashString.length <= 0) {
      hashPart = anchor && anchor.length > 0 ? `#${anchor}` : "";
      return rowUrl + hashPart;
    }

    hashPart =
      anchor && anchor.length > 0
        ? `replacement=${anchor}&${hashString}`
        : hashString;
    hashPart = encodeURIComponent(hashPart);
    return `${rowUrl}#${hashPart}`;
  };

  var openTab = function (url, options = {}, callback) {
    const {
      activateSameTab,
      inBackground,
      inNewWindow,
      type,
      hashParameters,
    } = options;

    url = appendHashParameters(url, hashParameters);

    function onTabFound(tab) {
      if (tab.url !== url) {
        purify.tabs.reload(tab.tabId, url);
      }
      if (!inBackground) {
        purify.tabs.activate(tab.tabId);
      }
      if (callback) {
        callback(tab);
      }
    }

    url = purify.utils.strings.contains(url, "://") ? url : purify.getURL(url);
    purify.tabs.getAll((tabs) => {
      // try to find between opened tabs
      if (activateSameTab) {
        for (let i = 0; i < tabs.length; i += 1) {
          const tab = tabs[i];
          if (purify.utils.url.urlEquals(tab.url, url)) {
            onTabFound(tab);
            return;
          }
        }
      }
      purify.tabs.create(
        {
          url,
          type: type || "normal",
          active: !inBackground,
          inNewWindow,
        },
        callback
      );
    });
  };

  const init = () => {
    // update icon on event received
    purify.listeners.addListener((event, tab, reset) => {
      if (event !== purify.listeners.UPDATE_TAB_BUTTON_STATE || !tab) {
        return;
      }

      let options;
      if (reset) {
        options = { icon: purify.prefs.ICONS.ICON_GREEN, badge: "" };
      }

      updateTabIcon(tab, options);
    });

    // Update tab icon and context menu while loading
    purify.tabs.onUpdated.addListener((tab) => {
      const { tabId } = tab;
      // BrowserAction is set separately for each tab
      updateTabIcon(tab);
      purify.tabs.getActive((aTab) => {
        if (aTab.tabId !== tabId) {
          return;
        }
      });
    });
  };

  // Update icon and popup stats on ads blocked
  purify.listeners.addListener((event, rule, tab, blocked) => {
    if (event !== purify.listeners.ADS_BLOCKED || !tab) {
      return;
    }

    purify.pageStats.updateStats(rule.filterId, blocked, new Date());
    const tabBlocked = purify.frames.updateBlockedAdsCount(tab, blocked);
    if (tabBlocked === null) {
      return;
    }
    updateTabIconAsync(tab);

    purify.tabs.getActive((activeTab) => {
      if (tab.tabId === activeTab.tabId) {
        updatePopupStatsAsync(activeTab);
      }
    });
  });

  // on filter auto-enabled event
  purify.listeners.addListener((event, enabledFilters) => {
    if (event === purify.listeners.ENABLE_FILTER_SHOW_POPUP) {
      const result = getFiltersEnabledResultMessage(enabledFilters);
      showAlertMessagePopup(result.title, result.text);
    }
  });

  // on filter enabled event
  purify.listeners.addListener((event, payload) => {
    switch (event) {
      case purify.listeners.FILTER_ENABLE_DISABLE:
        if (payload.enabled) {
          checkFiltersUpdates([payload], false);
        }
        break;
      case purify.listeners.FILTER_GROUP_ENABLE_DISABLE:
        if (payload.enabled && payload.filters) {
          const enabledFilters = payload.filters.filter((f) => f.enabled);
          checkFiltersUpdates(enabledFilters, false);
        }
        break;
      default:
        break;
    }
  });

  // on filters updated event
  purify.listeners.addListener((event, success, updatedFilters) => {
    if (event === purify.listeners.UPDATE_FILTERS_SHOW_POPUP) {
      const result = getFiltersUpdateResultMessage(success, updatedFilters);
      showAlertMessagePopup(result.title, result.text);
    }
  });

  // close all page on unload
  purify.unload.when(closeAllPages);

  return {
    init,
    openSettingsTab,
    openSiteReportTab,
    openThankYouPage,
    openExtensionStore,
    openFiltersDownloadPage,
    openAbuseTab,
    openLoginTab,

    whiteListTab,
    unWhiteListTab,

    changeApplicationFilteringDisabled,
    checkFiltersUpdates,
    openTab,

    showAlertMessagePopup,
  };
})(purify);
