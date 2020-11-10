/**
 * ----------------------------------------------------------------------------------
 * PurifyBrowserExtension subscription.js
 * Licensed under MIT (https://github.com/CyberPurify/CyberPurify/blob/main/LICENSE)
 * ----------------------------------------------------------------------------------
 */

/* global CryptoJS */

/**
 * Service that loads and parses filters metadata from backend server.
 * For now we just store filters metadata in an XML file within the extension.
 * In future we'll add an opportunity to update metadata along with filter rules update.
 */
purify.subscriptions = (function (purify) {
  "use strict";

  let groups = [];
  let groupsMap = {};
  let filters = [];
  let filtersMap = {};

  /**
   * @param timeUpdatedString String in format 'yyyy-MM-dd'T'HH:mm:ssZ'
   * @returns timestamp from date string
   */
  function parseTimeUpdated(timeUpdatedString) {
    // https://github.com/CyberPurify/PurifyBrowserExtension/issues/1272
    if (Number.isInteger(timeUpdatedString)) {
      return new Date(timeUpdatedString);
    }

    // https://developer.mozilla.org/ru/docs/Web/JavaScript/Reference/Global_Objects/Date/parse
    let timeUpdated = Date.parse(timeUpdatedString);
    if (Number.isNaN(timeUpdated)) {
      // https://github.com/CyberPurify/PurifyBrowserExtension/issues/478
      timeUpdated = Date.parse(
        timeUpdatedString.replace(/\+(\d{2})(\d{2})$/, "+$1:$2")
      );
    }
    if (Number.isNaN(timeUpdated)) {
      timeUpdated = new Date().getTime();
    }
    return timeUpdated;
  }

  /**
   * Group metadata
   */
  const SubscriptionGroup = function (groupId, groupName, displayNumber) {
    this.groupId = groupId;
    this.groupName = groupName;
    this.displayNumber = displayNumber;
  };

  /**
   * object containing filter data
   * @typedef {Object} FilterData
   * @property {number} filterId - filter id
   * @property {number} groupId - filter group id
   * @property {String} name - filter name
   * @property {String} description - filter description
   * @property {String} homepage - filter homepage url
   * @property {String} version - filter version
   * @property {number} timeUpdated - filter update time
   * @property {number} displayNumber - filter display number used to sort filters in the group
   * @property {array.<string>} languages - filter base languages
   * @property {number} expires - filter update interval
   * @property {String} subscriptionUrl - filter update url
   * @property {Boolean} [trusted] - filter is trusted or not
   */

  /**
   * Filter metadata
   * @param {FilterData} filterData
   */
  const SubscriptionFilter = function (filterData) {
    const {
      filterId,
      groupId,
      name,
      description,
      homepage,
      version,
      timeUpdated,
      displayNumber,
      languages,
      expires,
      subscriptionUrl,
      trusted,
      checksum,
    } = filterData;

    this.filterId = filterId;
    this.groupId = groupId;
    this.name = name;
    this.description = description;
    this.homepage = homepage;
    this.version = version;
    this.timeUpdated = timeUpdated;
    this.displayNumber = displayNumber;
    this.languages = languages;
    this.expires = expires;
    this.subscriptionUrl = subscriptionUrl;

    if (typeof trusted !== "undefined") {
      this.trusted = trusted;
    }
    if (typeof checksum !== "undefined") {
      this.checksum = checksum;
    }
  };

  /**
   * Create group from object
   * @param group Object
   * @returns {SubscriptionGroup}
   */
  function createSubscriptionGroupFromJSON(group) {
    const groupId = group.groupId - 0;
    const defaultGroupName = group.groupName;
    const displayNumber = group.displayNumber - 0;

    return new SubscriptionGroup(groupId, defaultGroupName, displayNumber);
  }

  /**
   * Create filter from object
   * @param filter Object
   */
  const createSubscriptionFilterFromJSON = function (filter) {
    const filterId = filter.filterId - 0;
    const groupId = filter.groupId - 0;
    const defaultName = filter.name;
    const defaultDescription = filter.description;
    const { homepage } = filter;
    const { version } = filter;
    const timeUpdated = parseTimeUpdated(filter.timeUpdated);
    const expires = filter.expires - 0;
    const { subscriptionUrl } = filter;
    const { languages } = filter;
    const displayNumber = filter.displayNumber - 0;
    const { trusted } = filter;
    const { checksum } = filter;

    return new SubscriptionFilter({
      filterId,
      groupId,
      name: defaultName,
      description: defaultDescription,
      homepage,
      version,
      timeUpdated,
      displayNumber,
      languages,
      expires,
      subscriptionUrl,
      trusted,
      checksum,
    });
  };

  const parseExpiresStr = (str) => {
    const regexp = /(\d+)\s+(day|hour)/;

    const parseRes = str.match(regexp);

    if (!parseRes) {
      const parsed = Number.parseInt(str, 10);
      return Number.isNaN(parsed) ? 0 : parsed;
    }

    const [, num, period] = parseRes;

    let multiplier = 1;
    switch (period) {
      case "day": {
        multiplier = 24 * 60 * 60;
        break;
      }
      case "hour": {
        multiplier = 60 * 60;
        break;
      }
      default: {
        break;
      }
    }

    return num * multiplier;
  };

  /**
   * Load groups and filters metadata
   * @returns {Promise} returns promise
   */
  async function loadMetadata() {
    const metadata = await purify.backend.loadLocalFiltersMetadata();
    groups = [];
    groupsMap = {};
    filters = [];
    filtersMap = {};

    for (let j = 0; j < metadata.filters.length; j += 1) {
      const filter = createSubscriptionFilterFromJSON(metadata.filters[j]);
      filters.push(filter);
      filtersMap[filter.filterId] = filter;
    }

    for (let k = 0; k < metadata.groups.length; k += 1) {
      const group = createSubscriptionGroupFromJSON(metadata.groups[k]);
      groups.push(group);
      groupsMap[group.groupId] = group;
    }

    filters.sort((f1, f2) => f1.displayNumber - f2.displayNumber);

    groups.sort((f1, f2) => f1.displayNumber - f2.displayNumber);

    purify.console.info("Filters metadata loaded");
  }

  /**
   * Loads script rules from local file
   * @returns {Promise}
   * @private
   */
  async function loadLocalScriptRules() {
    const localScriptRulesService = purify.rules.LocalScriptRulesService;
    if (typeof localScriptRulesService !== "undefined") {
      const json = await purify.backend.loadLocalScriptRules();
      localScriptRulesService.setLocalScriptRules(json);
      purify.console.info("Filters local script rules loaded");
    }
  }

  /**
   * Loads redirect sources from local file
   * @returns {Promise}
   * @private
   */
  async function loadRedirectSources() {
    const redirectSourcesService = purify.rules.RedirectFilterService;
    if (typeof redirectSourcesService !== "undefined") {
      const txt = await purify.backend.loadRedirectSources();
      redirectSourcesService.setRedirectSources(txt);
      purify.console.info("Filters redirect sources loaded");
    }
  }

  /**
   * Initialize subscription service, loading local filters metadata
   * @return {Promise}
   */
  const init = async function () {
    try {
      await loadMetadata();
      await loadLocalScriptRules();
      await loadRedirectSources();
    } catch (e) {
      purify.console.error(`Error loading metadata, cause: ${e.message}`);
    }
  };

  /**
   * @returns Array of Filters metadata
   */
  const getFilters = function () {
    return filters;
  };

  /**
   * Gets filter metadata by filter identifier
   */
  const getFilter = function (filterId) {
    return filtersMap[filterId];
  };

  /**
   * @returns Array of Groups metadata
   */
  const getGroups = () => groups;

  /**
   * @returns Group metadata
   */
  const getGroup = (groupId) => groupsMap[groupId];

  /**
   * Checks if group has enabled status true or false
   * @param groupId
   * @returns {boolean}
   */
  const groupHasEnabledStatus = (groupId) => {
    const group = groupsMap[groupId];
    return typeof group.enabled !== "undefined";
  };

  /**
   * Gets list of filters for the specified languages
   *
   * @param locale Locale to check
   * @returns {Array} List of filters identifiers
   */
  const getFilterIdsForLanguage = function (locale) {
    if (!locale) {
      return [];
    }
    const filterIds = [];
    for (let i = 0; i < filters.length; i += 1) {
      const filter = filters[i];
      const { languages } = filter;
      if (languages && languages.length > 0) {
        const language = purify.utils.i18n.normalize(languages, locale);
        if (language) {
          filterIds.push(filter.filterId);
        }
      }
    }
    return filterIds;
  };

  const getLangSuitableFilters = () => {
    // Get language-specific filters by user locale
    let filterIds = [];

    let localeFilterIds = getFilterIdsForLanguage(purify.app.getLocale());
    filterIds = filterIds.concat(localeFilterIds);

    // Get language-specific filters by navigator languages
    // Get the 2 most commonly used languages
    const languages = purify.utils.browser.getNavigatorLanguages(2);
    for (let i = 0; i < languages.length; i += 1) {
      localeFilterIds = getFilterIdsForLanguage(languages[i]);
      filterIds = filterIds.concat(localeFilterIds);
    }
    return [...new Set(filterIds)];
  };

  return {
    init,
    getFilterIdsForLanguage,
    getGroups,
    getGroup,
    groupHasEnabledStatus,
    getFilters,
    getFilter,
    createSubscriptionFilterFromJSON,
    getLangSuitableFilters,
  };
})(purify);
