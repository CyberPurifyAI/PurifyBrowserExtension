/**
 * ----------------------------------------------------------------------------------
 * PurifyBrowserExtension filter-rule-builder.js
 * Licensed under MIT (https://github.com/CyberPurify/CyberPurify/blob/main/LICENSE)
 * ----------------------------------------------------------------------------------
 */

(function (purify, api) {
  "use strict";

  /**
   * Filters unsupported rules from third-party sources
   *
   * @param ruleText
   */
  const filterUnsupportedRules = function (ruleText) {
    // uBO HTML filters
    if (ruleText.includes("##^")) {
      return false;
    }
    return true;
  };

  /**
   * Checks if rule length is less than minimum rule length.
   * Rules with length less than 4 are ignored
   * https://github.com/CyberPurify/PurifyBrowserExtension/issues/1600
   * @param ruleText
   * @returns {boolean}
   */
  const isRuleTooSmall = function (ruleText) {
    const MIN_RULE_LENGTH = 4;
    return ruleText.length < MIN_RULE_LENGTH;
  };

  /**
   * Method that parses rule text and creates object of a suitable class.
   *
   * @param {string} ruleText Rule text
   * @param {number} filterId Filter identifier
   * @returns Filter rule object. Either UrlFilterRule or CssFilterRule or ScriptFilterRule.
   */
  const _createRule = function (ruleText, filterId) {
    ruleText = ruleText ? ruleText.trim() : null;
    if (!ruleText) {
      return null;
    }

    try {
      const StringUtils = purify.utils.strings;

      if (StringUtils.startWith(ruleText, api.FilterRule.COMMENT)) {
        return null;
      }

      if (isRuleTooSmall(ruleText)) {
        return null;
      }

      if (!filterUnsupportedRules(ruleText)) {
        return null;
      }

      if (StringUtils.startWith(ruleText, api.FilterRule.MASK_WHITE_LIST)) {
        return new api.UrlFilterRule(ruleText, filterId);
      }

      if (
        api.FilterRule.findRuleMarker(
          ruleText,
          api.ContentFilterRule.RULE_MARKERS,
          api.ContentFilterRule.RULE_MARKER_FIRST_CHAR
        )
      ) {
        const responseContentFilteringSupported =
          purify.prefs.features &&
          purify.prefs.features.responseContentFilteringSupported;
        if (!responseContentFilteringSupported) {
          return null;
        }
        return new api.ContentFilterRule(ruleText, filterId);
      }

      if (
        api.FilterRule.findRuleMarker(
          ruleText,
          api.CssFilterRule.RULE_MARKERS,
          api.CssFilterRule.RULE_MARKER_FIRST_CHAR
        )
      ) {
        return new api.CssFilterRule(ruleText, filterId);
      }

      if (
        api.FilterRule.findRuleMarker(
          ruleText,
          api.ScriptFilterRule.RULE_MARKERS,
          api.ScriptFilterRule.RULE_MARKER_FIRST_CHAR
        )
      ) {
        if (api.ScriptletRule.isPurifyScriptletRule(ruleText)) {
          return new api.ScriptletRule(ruleText, filterId);
        }

        return new api.ScriptFilterRule(ruleText, filterId);
      }

      return new api.UrlFilterRule(ruleText, filterId);
    } catch (ex) {
      purify.console.debug(
        "Cannot create rule from filter {0}: {1}, cause {2}",
        filterId || 0,
        ruleText,
        ex
      );
    }

    return null;
  };

  /**
   * Convert rules to CyberPurify syntax and create rule
   *
   * @param {string} ruleText Rule text
   * @param {number} filterId Filter identifier
   * default is true
   * @returns Filter rule object. Either UrlFilterRule or CssFilterRule or ScriptFilterRule.
   */
  const createRule = (ruleText, filterId) => {
    let conversionResult;
    try {
      conversionResult = api.ruleConverter.convertRule(ruleText);
    } catch (ex) {
      purify.console.debug(
        "Cannot convert rule from filter {0}: {1}, cause {2}",
        filterId || 0,
        ruleText,
        ex
      );
    }
    if (!conversionResult) {
      return null;
    }
    if (Array.isArray(conversionResult)) {
      const rules = conversionResult
        .map((rt) => _createRule(rt, filterId))
        .filter((rule) => rule !== null);
      // composite rule shouldn't be with without rules inside it
      if (rules.length === 0) {
        return null;
      }
      return new api.CompositeRule(ruleText, rules);
    }
    const rule = _createRule(conversionResult, filterId);
    if (rule && conversionResult !== ruleText) {
      rule.ruleText = ruleText;
      rule.convertedRuleText = conversionResult;
    }
    return rule;
  };

  api.builder = { createRule };
})(purify, purify.rules);
