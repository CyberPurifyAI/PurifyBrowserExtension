/**
 * ----------------------------------------------------------------------------------
 * PurifyBrowserExtension user-settings.js
 * Licensed under MIT (https://github.com/CyberPurify/CyberPurify/blob/main/LICENSE)
 * ----------------------------------------------------------------------------------
 */

/**
 * Object that manages user settings.
 * @constructor
 */
purify.settings = (function (purify) {
  "use strict";

  const DEFAULT_FILTERS_UPDATE_PERIOD = -1; // Old -1;
  const DEFAULT_FIRST_PARTY_COOKIES_SELF_DESTRUCT_MIN = 4320;
  const DEFAULT_THIRD_PARTY_COOKIES_SELF_DESTRUCT_MIN = 2880;
  const DEFAULT_TRACKING_PARAMETERS =
    "utm_source,utm_medium,utm_term,utm_campaign,utm_content,utm_name,utm_cid,utm_reader,utm_viz_id,utm_pubreferrer,utm_swu,utm_referrer,utm_social,utm_social-type,utm_place,utm_userid,utm_channel,fb_action_ids,fb_action_types,fb_ref,fb_source";

  const settings = {
    BLOCK_PORN: "block-porn",
    BLOCK_SEXY: "block-sexy",
    BLOCK_BLOODY: "block-bloody",
    BLOCK_BLOODSHED: "block-bloodshed",
    BLOCK_BLACKLIST: "block-blacklist",
    BLOCK_ADS: "block-ads",
    DISABLE_SAFEBROWSING: "safebrowsing-disabled",
    DISABLE_FILTERING: "purify-disabled",
    DISABLE_COLLECT_HITS: "hits-count-disabled",
    DEFAULT_WHITE_LIST_MODE: "default-whitelist-mode",
    FILTERS_UPDATE_PERIOD: "filters-update-period",
    DISABLE_STEALTH_MODE: "stealth_disable_stealth_mode",
    HIDE_REFERRER: "stealth-hide-referrer",
    HIDE_SEARCH_QUERIES: "stealth-hide-search-queries",
    SEND_DO_NOT_TRACK: "stealth-send-do-not-track",
    BLOCK_CHROME_CLIENT_DATA: "stealth-remove-x-client",
    BLOCK_WEBRTC: "stealth-block-webrtc",
    SELF_DESTRUCT_THIRD_PARTY_COOKIES: "stealth-block-third-party-cookies",
    SELF_DESTRUCT_THIRD_PARTY_COOKIES_TIME:
      "stealth-block-third-party-cookies-time",
    SELF_DESTRUCT_FIRST_PARTY_COOKIES: "stealth-block-first-party-cookies",
    SELF_DESTRUCT_FIRST_PARTY_COOKIES_TIME:
      "stealth-block-first-party-cookies-time",
    STRIP_TRACKING_PARAMETERS: "strip-tracking-parameters",
    TRACKING_PARAMETERS: "tracking-parameters",
  };

  const properties = Object.create(null);
  const propertyUpdateChannel = purify.utils.channels.newChannel();

  /**
   * Lazy default properties
   */
  const defaultProperties = {
    get defaults() {
      return purify.lazyGet(this, "defaults", () => {
        // Initialize default properties
        const defaults = Object.create(null);
        for (const name in settings) {
          if (settings.hasOwnProperty(name)) {
            defaults[settings[name]] = false;
          }
        }
        defaults[settings.BLOCK_PORN] = true;
        defaults[settings.BLOCK_SEXY] = true;
        defaults[settings.BLOCK_BLOODY] = true;
        defaults[settings.BLOCK_BLOODSHED] = true;
        defaults[settings.BLOCK_BLACKLIST] = true;
        defaults[settings.BLOCK_ADS] = true;
        defaults[settings.DISABLE_SAFEBROWSING] = false;
        defaults[settings.DISABLE_COLLECT_HITS] = true;
        defaults[settings.DEFAULT_WHITE_LIST_MODE] = true;
        defaults[
          settings.FILTERS_UPDATE_PERIOD
        ] = DEFAULT_FILTERS_UPDATE_PERIOD;
        defaults[settings.DISABLE_STEALTH_MODE] = false;
        defaults[settings.HIDE_REFERRER] = true;
        defaults[settings.HIDE_SEARCH_QUERIES] = true;
        defaults[settings.SEND_DO_NOT_TRACK] = true;
        defaults[
          settings.BLOCK_CHROME_CLIENT_DATA
        ] = !!purify.utils.browser.isChromeBrowser();
        defaults[settings.BLOCK_WEBRTC] = false;
        defaults[settings.SELF_DESTRUCT_THIRD_PARTY_COOKIES] = true;
        defaults[
          settings.SELF_DESTRUCT_THIRD_PARTY_COOKIES_TIME
        ] = DEFAULT_THIRD_PARTY_COOKIES_SELF_DESTRUCT_MIN;
        defaults[settings.SELF_DESTRUCT_FIRST_PARTY_COOKIES] = false;
        defaults[
          settings.SELF_DESTRUCT_FIRST_PARTY_COOKIES_TIME
        ] = DEFAULT_FIRST_PARTY_COOKIES_SELF_DESTRUCT_MIN;
        defaults[settings.STRIP_TRACKING_PARAMETERS] = true;
        defaults[settings.TRACKING_PARAMETERS] = DEFAULT_TRACKING_PARAMETERS;
        return defaults;
      });
    },
  };

  const getProperty = function (propertyName) {
    if (propertyName in properties) {
      return properties[propertyName];
    }

    /**
     * Don't cache values in case of uninitialized storage
     */
    if (!purify.localStorage.isInitialized()) {
      return defaultProperties.defaults[propertyName];
    }

    let propertyValue = null;

    if (purify.localStorage.hasItem(propertyName)) {
      try {
        propertyValue = JSON.parse(purify.localStorage.getItem(propertyName));
      } catch (ex) {
        purify.console.error(
          "Error get property {0}, cause: {1}",
          propertyName,
          ex
        );
      }
    } else if (propertyName in defaultProperties.defaults) {
      propertyValue = defaultProperties.defaults[propertyName];
    }

    properties[propertyName] = propertyValue;

    return propertyValue;
  };

  const setProperty = (propertyName, propertyValue) => {
    purify.localStorage.setItem(propertyName, JSON.stringify(propertyValue));
    properties[propertyName] = propertyValue;
    propertyUpdateChannel.notify(propertyName, propertyValue);
    purify.listeners.notifyListeners(purify.listeners.SETTING_UPDATED, {
      propertyName,
      propertyValue,
    });
  };

  const getAllSettings = function () {
    const result = {
      names: Object.create(null),
      values: Object.create(null),
      defaultValues: Object.create(null),
    };

    for (const key in settings) {
      if (settings.hasOwnProperty(key)) {
        const setting = settings[key];
        result.names[key] = setting;
        result.values[setting] = getProperty(setting);
        result.defaultValues[setting] = defaultProperties.defaults[setting];
      }
    }

    return result;
  };

  /**
   * True if filtering is disabled globally.
   *
   * @returns {boolean} true if disabled
   */
  const isFilteringDisabled = function () {
    return getProperty(settings.DISABLE_FILTERING);
  };

  const changeFilteringDisabled = function (disabled) {
    setProperty(settings.DISABLE_FILTERING, disabled);
  };

  const collectHitsCount = function () {
    return !getProperty(settings.DISABLE_COLLECT_HITS);
  };

  const changeCollectHitsCount = function (enabled, options) {
    setProperty(settings.DISABLE_COLLECT_HITS, !enabled, options);
  };

  const isDefaultWhiteListMode = function () {
    return getProperty(settings.DEFAULT_WHITE_LIST_MODE);
  };

  const changeDefaultWhiteListMode = function (enabled) {
    setProperty(settings.DEFAULT_WHITE_LIST_MODE, enabled);
  };

  /**
   * Sets filters update period after conversion in number
   * @param period
   */
  const setFiltersUpdatePeriod = function (period) {
    let parsed = Number.parseInt(period, 10);
    if (Number.isNaN(parsed)) {
      parsed = DEFAULT_FILTERS_UPDATE_PERIOD;
    }
    setProperty(settings.FILTERS_UPDATE_PERIOD, parsed);
  };

  /**
   * Returns filter update period, converted in number
   * @returns {number}
   */
  const getFiltersUpdatePeriod = function () {
    const value = getProperty(settings.FILTERS_UPDATE_PERIOD);
    let parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) {
      parsed = DEFAULT_FILTERS_UPDATE_PERIOD;
    }
    return parsed;
  };

  const isWebRTCDisabled = function () {
    return getProperty(settings.BLOCK_WEBRTC);
  };

  const api = {};

  // Expose settings to api
  for (const key in settings) {
    if (settings.hasOwnProperty(key)) {
      api[key] = settings[key];
    }
  }

  api.getProperty = getProperty;
  api.setProperty = setProperty;
  api.getAllSettings = getAllSettings;

  api.onUpdated = propertyUpdateChannel;

  api.isFilteringDisabled = isFilteringDisabled;
  api.changeFilteringDisabled = changeFilteringDisabled;
  api.collectHitsCount = collectHitsCount;
  api.changeCollectHitsCount = changeCollectHitsCount;
  api.isDefaultWhiteListMode = isDefaultWhiteListMode;
  api.changeDefaultWhiteListMode = changeDefaultWhiteListMode;
  api.getFiltersUpdatePeriod = getFiltersUpdatePeriod;
  api.setFiltersUpdatePeriod = setFiltersUpdatePeriod;
  api.isWebRTCDisabled = isWebRTCDisabled;
  api.DEFAULT_FILTERS_UPDATE_PERIOD = DEFAULT_FILTERS_UPDATE_PERIOD;

  return api;
})(purify);
