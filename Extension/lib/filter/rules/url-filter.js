/**
 * ----------------------------------------------------------------------------------
 * PurifyBrowserExtension url-filter.js
 * Licensed under MIT (https://github.com/CyberPurify/CyberPurify/blob/main/LICENSE)
 * ----------------------------------------------------------------------------------
 */

(function (api) {
  "use strict";

  /**
   * Filter for Url filter rules.
   * Read here for details:
   * http://cyberpurify.com/en/filterrules.html#baseRules
   */
  const UrlFilter = function (rules, badFilterRules) {
    this.basicRulesTable = new api.UrlFilterRuleLookupTable();
    this.badFilterRules = badFilterRules;

    if (rules) {
      for (let i = 0; i < rules.length; i += 1) {
        this.addRule(rules[i]);
      }
    }
  };

  UrlFilter.prototype = {
    /**
     * Adds rule to UrlFilter
     *
     * @param rule Rule object
     */
    addRule(rule) {
      this.basicRulesTable.addRule(rule);
    },

    /**
     * Removes rule from UrlFilter
     *
     * @param rule Rule to remove
     */
    removeRule(rule) {
      this.basicRulesTable.removeRule(rule);
    },

    /**
     * Searches for first rule matching specified request
     *
     * @param url           Request url
     * @param documentHost  Document host
     * @param requestType   Request content type (UrlFilterRule.contentTypes)
     * @param thirdParty    true if request is third-party
     * @param skipGenericRules    skip generic rules
     * @return matching rule or null if no match found
     */
    isFiltered(url, documentHost, requestType, thirdParty, skipGenericRules) {
      return this.basicRulesTable.findRule(
        url,
        documentHost,
        thirdParty,
        requestType,
        !skipGenericRules,
        this.badFilterRules
      );
    },

    /**
     * Returns the array of loaded rules
     */
    getRules() {
      return this.basicRulesTable.getRules();
    },
  };

  api.UrlFilter = UrlFilter;
})(purify.rules);
