

(function (purify, api) {
  "use strict";

  /**
   * Filter that manages JS injection rules.
   * Read here for details: http://cyberpurify.com/en/filterrules.html#javascriptInjection
   */
  const ScriptFilter = function (rules) {
    this.scriptRules = [];
    this.exceptionsRules = [];

    if (rules) {
      for (let i = 0; i < rules.length; i++) {
        this.addRule(rules[i]);
      }
    }
  };

  ScriptFilter.prototype = {
    /**
     * Adds JS injection rule
     *
     * @param rule Rule object
     */
    addRule(rule) {
      if (rule.whiteListRule) {
        this.exceptionsRules.push(rule);
        this._applyExceptionRuleToFilter(rule);
        return;
      }

      this._applyExceptionRulesToRule(rule);
      this.scriptRules.push(rule);
    },

    /**
     * Removes JS injection rule
     *
     * @param rule Rule object
     */
    removeRule(rule) {
      purify.utils.collections.removeRule(this.scriptRules, rule);
      purify.utils.collections.removeRule(this.exceptionsRules, rule);
      this._rollbackExceptionRule(rule);
    },

    /**
     * Removes all rules from this filter
     */
    clearRules() {
      this.scriptRules = [];
      this.exceptionsRules = [];
    },

    /**
     * Returns the array of loaded rules
     */
    getRules() {
      return this.scriptRules.concat(this.exceptionsRules);
    },

    /**
     * Builds script for the specified domain to be injected
     *
     * @param domainName Domain name
     * @param {Object} debugConfig
     * @returns {{scriptSource: string, rule: string}[]} List of scripts to be applied
     * and scriptSource
     */
    buildScript(domainName, debugConfig) {
      const scripts = [];
      for (let i = 0; i < this.scriptRules.length; i += 1) {
        const rule = this.scriptRules[i];
        if (rule.isPermitted(domainName)) {
          const script = rule.getScript(debugConfig);
          if (script) {
            scripts.push({
              scriptSource: rule.scriptSource,
              script,
              rule,
            });
          }
        }
      }
      return scripts;
    },

    /**
     * Rolls back exception rule:
     * http://cyberpurify.com/en/filterrules.html#javascriptInjectionExceptions
     *
     * @param exceptionRule Exception rule
     * @private
     */
    _rollbackExceptionRule(exceptionRule) {
      if (!exceptionRule.whiteListRule) {
        return;
      }

      for (let i = 0; i < this.scriptRules.length; i++) {
        const scriptRule = this.scriptRules[i];
        if (scriptRule.getRuleContent() === exceptionRule.getRuleContent()) {
          scriptRule.removeRestrictedDomains(
            exceptionRule.getPermittedDomains()
          );
        }
      }
    },

    /**
     * Applies exception rule:
     * http://cyberpurify.com/en/filterrules.html#javascriptInjectionExceptions
     *
     * @param exceptionRule Exception rule
     * @private
     */
    _applyExceptionRuleToFilter(exceptionRule) {
      for (let i = 0; i < this.scriptRules.length; i++) {
        this._removeExceptionDomains(this.scriptRules[i], exceptionRule);
      }
    },

    /**
     * Applies exception rules:
     * http://cyberpurify.com/en/filterrules.html#javascriptInjectionExceptions
     *
     * @param scriptRule JS injection rule
     * @private
     */
    _applyExceptionRulesToRule(scriptRule) {
      for (let i = 0; i < this.exceptionsRules.length; i++) {
        this._removeExceptionDomains(scriptRule, this.exceptionsRules[i]);
      }
    },

    _removeExceptionDomains(scriptRule, exceptionRule) {
      if (scriptRule.getRuleContent() !== exceptionRule.getRuleContent()) {
        return;
      }

      scriptRule.addRestrictedDomains(exceptionRule.getPermittedDomains());
    },
  };

  api.ScriptFilter = ScriptFilter;
})(purify, purify.rules);
