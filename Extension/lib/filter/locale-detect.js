/**
 * ----------------------------------------------------------------------------------
 * PurifyBrowserExtension locale-detect.js
 * Licensed under MIT (https://github.com/CyberPurify/CyberPurify/blob/main/LICENSE)
 * ----------------------------------------------------------------------------------
 */

/**
 * Initialize LocaleDetectService.
 *
 * This service is used to auto-enable language-specific filters.
 */
(function (purify) {
  var browsingLanguages = [];

  var SUCCESS_HIT_COUNT = 3;
  var MAX_HISTORY_LENGTH = 10;

  var domainToLanguagesMap = {
    // English
    com: "en",
    au: "en",
    uk: "en",
    nz: "en",
    // Deutch
    de: "en",
    at: "en",
    // Japanese
    jp: "en",
    // Dutch
    nl: "en",
    // French
    fr: "en",
    // Spanish
    es: "en",
    // Italian
    it: "en",
    // Portuguese
    pt: "en",
    // Polish
    pl: "en",
    // Czech
    cz: "en",
    // Bulgarian
    bg: "en",
    // Lithuanian
    lt: "en",
    // Latvian
    lv: "en",
    // Arabic
    eg: "en",
    dz: "en",
    kw: "en",
    ae: "en",
    // Slovakian
    sk: "en",
    // Romanian
    ro: "en",
    // Suomi
    fi: "en",
    // Icelandic
    is: "en",
    // Norwegian
    no: "en",
    // Greek
    gr: "en",
    // Hungarian
    hu: "en",
    // Hebrew
    il: "en",
    // Chinese
    cn: "en",
    // Indonesian
    id: "en",
  };

  /**
   * Called when LocaleDetectorService has detected language-specific filters we can enable.
   *
   * @param filterIds List of detected language-specific filters identifiers
   * @private
   */
  function onFilterDetectedByLocale(filterIds) {
    if (!filterIds) {
      return;
    }

    const onSuccess = (enabledFilters) => {
      if (enabledFilters.length > 0) {
        purify.listeners.notifyListeners(
          purify.listeners.ENABLE_FILTER_SHOW_POPUP,
          enabledFilters
        );
      }
    };

    purify.filters.addAndEnableFilters(filterIds, onSuccess, {
      forceGroupEnable: true,
    });
  }

  /**
   * Stores language in the special array containing languages of the last visited pages.
   * If user has visited enough pages with a specified language we call special callback
   * to auto-enable filter for this language
   *
   * @param language Page language
   * @private
   */
  function detectLanguage(language) {
    /**
     * For an unknown language "und" will be returned
     * https://developer.mozilla.org/en-US/Add-ons/WebExtensions/API/tabs/detectLanguage
     */
    if (!language || language === "und") {
      return;
    }

    browsingLanguages.push({
      language: language,
      time: Date.now(),
    });
    if (browsingLanguages.length > MAX_HISTORY_LENGTH) {
      browsingLanguages.shift();
    }

    var history = browsingLanguages.filter(function (h) {
      return h.language === language;
    });

    if (history.length >= SUCCESS_HIT_COUNT) {
      var filterIds = purify.subscriptions.getFilterIdsForLanguage(language);
      onFilterDetectedByLocale(filterIds);
    }
  }

  /**
   * Detects language for the specified page
   * @param tab    Tab
   * @param url    Page URL
   */
  function detectTabLanguage(tab, url) {
    if (
      !purify.settings.isAutodetectFilters() ||
      purify.settings.isFilteringDisabled()
    ) {
      return;
    }

    // Check language only for http://... tabs
    if (!purify.utils.url.isHttpRequest(url)) {
      return;
    }

    // tabs.detectLanguage doesn't work in Opera
    // https://github.com/CyberPurify/PurifyBrowserExtension/issues/997
    if (!purify.utils.browser.isOperaBrowser()) {
      /* global browser */
      if (
        tab.tabId &&
        typeof browser != "undefined" &&
        browser.tabs &&
        browser.tabs.detectLanguage
      ) {
        // https://developer.mozilla.org/en-US/Add-ons/WebExtensions/API/tabs/detectLanguage
        browser.tabs.detectLanguage(tab.tabId, function (language) {
          if (browser.runtime.lastError) {
            return;
          }
          detectLanguage(language);
        });
        return;
      }
    }

    // Detecting language by top-level domain if extension API language detection is unavailable
    // Ignore hostnames which length is less or equal to 8
    // https://github.com/CyberPurify/PurifyBrowserExtension/issues/1354
    const host = purify.utils.url.getHost(url);
    if (host && host.length > 8) {
      const parts = host ? host.split(".") : [];
      const tld = parts[parts.length - 1];
      const lang = domainToLanguagesMap[tld];
      detectLanguage(lang);
    }
  }

  // Locale detect
  purify.tabs.onUpdated.addListener((tab) => {
    if (tab.status === "complete") {
      detectTabLanguage(tab, tab.url);
    }
  });
})(purify);
