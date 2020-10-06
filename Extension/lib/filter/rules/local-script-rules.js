/**
 * ----------------------------------------------------------------------------------
 * PurifyBrowserExtension local-script-rules.js
 * Licensed under MIT (https://github.com/CyberPurify/CyberPurify/blob/main/LICENSE)
 * ----------------------------------------------------------------------------------
 */

/**
 * By the rules of AMO and addons.opera.com we cannot use remote scripts
 * (and our JS injection rules could be counted as remote scripts).
 *
 * So what we do:
 * 1. We gather all current JS rules in the DEFAULT_SCRIPT_RULES object
 * 2. We disable JS rules got from remote server
 * 3. We allow only custom rules got from the User filter (which user creates manually)
 *    or from this DEFAULT_SCRIPT_RULES object
 */

(function (api) {
  let DEFAULT_SCRIPT_RULES = Object.create(null);

  /**
   * Saves local script rules to object
   * @param json JSON object loaded from the filters/local_script_rules.json file
   */
  const setLocalScriptRules = function (json) {
    DEFAULT_SCRIPT_RULES = Object.create(null);

    const rules = json.rules;
    for (let i = 0; i < rules.length; i += 1) {
      const rule = rules[i];
      const { domains, script } = rule;
      let ruleText = "";
      if (domains !== "<any>") {
        ruleText = domains;
      }
      ruleText += api.FilterRule.MASK_SCRIPT_RULE + script;
      DEFAULT_SCRIPT_RULES[ruleText] = true;
    }
  };

  /**
   * Checks js rule is local
   * @param ruleText Rule text
   * @returns {boolean}
   */
  const isLocal = function (ruleText) {
    return ruleText in DEFAULT_SCRIPT_RULES;
  };

  api.LocalScriptRulesService = {
    setLocalScriptRules,
    isLocal,
  };
})(purify.rules);
