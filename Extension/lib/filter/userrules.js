/**
 * ----------------------------------------------------------------------------------
 * PurifyBrowserExtension userrules.js
 * Licensed under MIT (https://github.com/CyberPurify/CyberPurify/blob/main/LICENSE)
 * ----------------------------------------------------------------------------------
 */

/**
 * Class for manage user rules
 */
purify.userrules = (function (purify) {
  "use strict";

  /**
   * Wraps access to getter. AntiBannerService hasn't been defined yet.
   * @returns {*}
   */
  function getAntiBannerService() {
    return purify.antiBannerService;
  }

  /**
   * Adds list of rules to the user filter
   *
   * @param rulesText List of rules to add
   */
  const addRules = function (rulesText) {
    const rules = getAntiBannerService().addUserFilterRules(rulesText);
    return rules;
  };

  /**
   * Removes all user's custom rules
   */
  const clearRules = function () {
    getAntiBannerService().updateUserFilterRules([]);
  };

  /**
   * Removes user's custom rule
   *
   * @param ruleText Rule text
   */
  const removeRule = function (ruleText) {
    getAntiBannerService().removeUserFilterRule(ruleText);
  };

  /**
   * Save user rules text to storage
   * @param content Rules text
   */
  const updateUserRulesText = function (content) {
    const lines = content.length > 0 ? content.split(/\n/) : [];
    getAntiBannerService().updateUserFilterRules(lines);
  };

  /**
   * Loads user rules text from storage
   * @param callback Callback function
   */
  const getUserRulesText = function (callback) {
    purify.rulesStorage.read(
      purify.utils.filters.USER_FILTER_ID,
      (rulesText) => {
        const content = (rulesText || []).join("\n");
        callback(content);
      }
    );
  };

  const unWhiteListFrame = function (frameInfo) {
    if (frameInfo.frameRule) {
      if (
        frameInfo.frameRule.filterId ===
        purify.utils.filters.WHITE_LIST_FILTER_ID
      ) {
        purify.whitelist.unWhiteListUrl(frameInfo.url);
      } else {
        removeRule(frameInfo.frameRule.ruleText);
      }
    }
  };

  return {
    addRules,
    clearRules,
    removeRule,
    updateUserRulesText,
    getUserRulesText,
    // TODO: fix
    unWhiteListFrame,
  };
})(purify);
