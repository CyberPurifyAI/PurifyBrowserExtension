/**
 * ----------------------------------------------------------------------------------
 * PurifyBrowserExtension replace-filter.js
 * Licensed under MIT (https://github.com/cyberpurify/CyberPurify/blob/main/LICENSE)
 * ----------------------------------------------------------------------------------
 */

(function (purify, api) {
  /**
   * Filter for replace filter rules
   * @param rules
   * @param badFilterRules
   * @constructor
   */
  api.ReplaceFilter = function (rules, badFilterRules) {
    const replaceWhiteFilter = new api.UrlFilterRuleLookupTable();
    const replaceBlockFilter = new api.UrlFilterRuleLookupTable();

    /**
     * Add rule to replace filter
     * @param rule Rule object
     */
    function addRule(rule) {
      if (rule.whiteListRule) {
        replaceWhiteFilter.addRule(rule);
      } else {
        replaceBlockFilter.addRule(rule);
      }
    }

    /**
     * Add rules to replace filter
     * @param rules Array of rules
     */
    function addRules(rules) {
      for (let i = 0; i < rules.length; i += 1) {
        const rule = rules[i];
        addRule(rule);
      }
    }

    /**
     * Remove rule from replace filter
     * @param rule Rule object
     */
    function removeRule(rule) {
      if (rule.whiteListRule) {
        replaceWhiteFilter.removeRule(rule);
      } else {
        replaceWhiteFilter.removeRule(rule);
      }
    }

    /**
     * Returns rules from replace filter
     * @returns {Array} array of rules
     */
    function getRules() {
      const whiteRules = replaceWhiteFilter.getRules();
      const blockRules = replaceBlockFilter.getRules();
      return whiteRules.concat(blockRules);
    }

    /**
     * Returns suitable white rule from the list of rules
     * @param whiteRules list of white rules
     * @param blockRule block rule
     * @returns {?object} suitable whiteRule or null
     */
    const getWhitelistingRule = (whiteRules, blockRule) => {
      for (let i = 0; i < whiteRules.length; i += 1) {
        const whiteRule = whiteRules[i];
        if (
          whiteRule.replaceOption.optionText ===
          blockRule.replaceOption.optionText
        ) {
          return whiteRule;
        }
      }
      return null;
    };

    /**
     * Function returns filtered replace block rules
     * @param url
     * @param documentHost
     * @param thirdParty
     * @param requestType
     * @returns {?Array} array of filtered replace blockRules or null
     */
    function findReplaceRules(url, documentHost, thirdParty, requestType) {
      const blockRules = replaceBlockFilter.findRules(
        url,
        documentHost,
        thirdParty,
        requestType,
        badFilterRules
      );

      if (!blockRules) {
        return null;
      }

      const whiteRules = replaceWhiteFilter.findRules(
        url,
        documentHost,
        thirdParty,
        requestType,
        badFilterRules
      );
      if (!whiteRules) {
        return blockRules;
      }

      if (whiteRules.length > 0) {
        const whiteRulesWithEmptyOptionText = whiteRules.filter(
          (whiteRule) => whiteRule.replaceOption.optionText === ""
        );

        // @@||example.org^$replace will disable all $replace rules matching ||example.org^.
        if (whiteRulesWithEmptyOptionText.length > 0) {
          // return first matched rule
          return whiteRulesWithEmptyOptionText.slice(0, 1);
        }

        const foundReplaceRules = [];
        blockRules.forEach((blockRule) => {
          const whitelistingRule = getWhitelistingRule(whiteRules, blockRule);
          if (whitelistingRule) {
            foundReplaceRules.push(whitelistingRule);
          } else {
            foundReplaceRules.push(blockRule);
          }
        });
        return foundReplaceRules;
      }

      return blockRules.length > 0 ? blockRules : null;
    }

    if (rules) {
      addRules(rules);
    }

    return {
      addRules: addRules,
      addRule: addRule,
      removeRule: removeRule,
      getRules: getRules,
      findReplaceRules: findReplaceRules,
    };
  };
})(purify, purify.rules);
