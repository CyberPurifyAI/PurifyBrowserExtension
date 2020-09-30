/**
 * ----------------------------------------------------------------------------------
 * PurifyBrowserExtension filters-categories.js
 * Licensed under MIT (https://github.com/cyberpurify/CyberPurify/blob/main/LICENSE)
 * ----------------------------------------------------------------------------------
 */

/**
 * Filter categories service
 */
purify.categories = (function (purify) {
  "use strict";

  /**
   * @returns {Array.<*>} filters
   */
  var getFilters = function () {
    var result = purify.subscriptions.getFilters().filter(function (f) {
      return !f.removed;
    });

    return result;
  };

  /**
   * Selects filters by groupId
   *
   * @param groupId
   * @param filters
   * @returns {Array.<SubscriptionFilter>}
   */
  const selectFiltersByGroupId = function (groupId, filters) {
    return filters.filter((filter) => filter.groupId === groupId);
  };

  /**
   * Constructs filters metadata for options.html page
   */
  var getFiltersMetadata = function () {
    var groupsMeta = purify.subscriptions.getGroups();
    var filters = getFilters();

    var categories = [];

    for (var i = 0; i < groupsMeta.length; i += 1) {
      var category = groupsMeta[i];
      category.filters = selectFiltersByGroupId(category.groupId, filters);
      categories.push(category);
    }

    return {
      filters: filters,
      categories: categories,
    };
  };

  /**
   * Returns recommended filters, which meet next requirements
   * 1. filter has recommended tag
   * 2. if filter has language tag, tag should match with user locale
   * 3. filter should correspond to platform mobile or desktop
   * @param groupId
   * @returns {Array} recommended filters by groupId
   */
  const getRecommendedFilterIdsByGroupId = function (groupId) {
    const metadata = getFiltersMetadata();
    const result = [];
    for (let i = 0; i < metadata.categories.length; i += 1) {
      const category = metadata.categories[i];
      if (category.groupId === groupId) {
        return result;
      }
    }
    return result;
  };

  /**
   * If group doesn't have enabled property we consider that group is enabled for the first time
   * On first group enable we add and enable recommended filters by groupId
   * On the next calls we just enable group
   * @param {number} groupId
   */
  const enableFiltersGroup = function (groupId) {
    const group = purify.subscriptions.getGroup(groupId);
    if (group && typeof group.enabled === "undefined") {
      const recommendedFiltersIds = getRecommendedFilterIdsByGroupId(groupId);
      purify.filters.addAndEnableFilters(recommendedFiltersIds);
    }
    purify.filters.enableGroup(groupId);
  };

  /**
   * Disables group
   * @param {number} groupId
   */
  const disableFiltersGroup = function (groupId) {
    purify.filters.disableGroup(groupId);
  };

  return {
    getFiltersMetadata: getFiltersMetadata,
    enableFiltersGroup: enableFiltersGroup,
    disableFiltersGroup: disableFiltersGroup,
  };
})(purify);
