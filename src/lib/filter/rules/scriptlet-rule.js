/**
 * ----------------------------------------------------------------------------------
 * PurifyBrowserExtension scriptlet-rule.js
 * Licensed under MIT (https://github.com/CyberPurify/CyberPurify/blob/main/LICENSE)
 * ----------------------------------------------------------------------------------
 */

(function (purify, api) {
  const stringUtils = purify.utils.strings;

  /**
   * CyberPurify scriptlet rule mask
   */
  const ADG_SCRIPTLET_MASK = "//scriptlet";

  /**
   * Helper to accumulate an array of strings char by char
   */
  function wordSaver() {
    let str = "";
    const strs = [];
    const saveSymb = (s) => (str += s);
    const saveStr = () => {
      strs.push(str);
      str = "";
    };
    const getAll = () => [...strs];
    return { saveSymb, saveStr, getAll };
  }

  /**
   * Iterate over iterable argument and evaluate current state with transitions
   * @param {string} init first transition name
   * @param {Array|Collection|string} iterable
   * @param {Object} transitions transtion functions
   * @param {any} args arguments which should be passed to transition functions
   */
  function iterateWithTransitions(iterable, transitions, init, args) {
    let state = init || Object.keys(transitions)[0];
    for (let i = 0; i < iterable.length; i++) {
      state = transitions[state](iterable, i, args);
    }
    return state;
  }

  /**
   * Parse and validate scriptlet rule
   * @param {*} ruleText
   * @returns {{name: string, args: Array<string>}}
   */
  function parseRule(ruleText) {
    ruleText = stringUtils.substringAfter(ruleText, ADG_SCRIPTLET_MASK);
    /**
     * Transition names
     */
    const TRANSITION = {
      OPENED: "opened",
      PARAM: "param",
      CLOSED: "closed",
    };

    /**
     * Transition function: the current index position in start, end or between params
     * @param {string} rule
     * @param {number} index
     * @param {Object} Object
     * @property {Object} Object.sep contains prop symb with current separator char
     */
    const opened = (rule, index, { sep }) => {
      const char = rule[index];
      switch (char) {
        case " ":
        case "(":
        case ",":
          return TRANSITION.OPENED;
        case "'":
        case '"':
          sep.symb = char;
          return TRANSITION.PARAM;
        case ")":
          return index === rule.length - 1
            ? TRANSITION.CLOSED
            : TRANSITION.OPENED;
      }
    };
    /**
     * Transition function: the current index position inside param
     * @param {string} rule
     * @param {number} index
     * @param {Object} Object
     * @property {Object} Object.sep contains prop `symb` with current separator char
     * @property {Object} Object.saver helper which allow to save strings by car by char
     */
    const param = (rule, index, { saver, sep }) => {
      const char = rule[index];
      switch (char) {
        case "'":
        case '"':
          const before = rule[index - 1];
          if (char === sep.symb && before !== "\\") {
            sep.symb = null;
            saver.saveStr();
            return TRANSITION.OPENED;
          }
        default:
          saver.saveSymb(char);
          return TRANSITION.PARAM;
      }
    };
    const transitions = {
      [TRANSITION.OPENED]: opened,
      [TRANSITION.PARAM]: param,
      [TRANSITION.CLOSED]: () => {},
    };
    const sep = { symb: null };
    const saver = wordSaver();
    const state = iterateWithTransitions(
      ruleText,
      transitions,
      TRANSITION.OPENED,
      { sep, saver }
    );
    if (state !== "closed") {
      throw new Error(`Invalid scriptlet rule ${ruleText}`);
    }

    const args = saver.getAll();
    return {
      name: args[0],
      args: args.slice(1),
    };
  }

  const getScriptletCode = (params) => {
    const { name, args, ruleText, domainName, engine, version, debug } = params;
    if (!scriptlets) {
      // eslint-disable-line no-undef
      return null;
    }
    const scriptletParam = {
      name,
      args,
      ruleText,
      domainName,
      engine,
      version,
    };

    if (debug) {
      scriptletParam.verbose = true;
    }
    /* eslint-enable no-unused-expressions, no-console */
    return scriptlets.invoke(scriptletParam); // eslint-disable-line no-undef
  };

  /**
   * JS Scriplet rule constructor
   * @constructor ScriptletRule
   * @property {string} ruleText
   * @property {number|string} filterId
   */
  function ScriptletRule(ruleText, filterId) {
    this.ruleText = ruleText;
    this.filterId = filterId;
    // Scriptlet rules are marked as "local" because the scriptlets code is built-in
    // the extension
    // See "lib/filter/rules/scriptlets/scriptlets.js" for the details
    this.scriptSource = "local";
    this.whiteListRule = ruleText.includes(
      api.FilterRule.MASK_SCRIPT_EXCEPTION_RULE
    );
    const mask = this.whiteListRule
      ? api.FilterRule.MASK_SCRIPT_EXCEPTION_RULE
      : api.FilterRule.MASK_SCRIPT_RULE;
    const domain = stringUtils.substringBefore(ruleText, mask);
    domain && this.loadDomains(domain);
    this.ruleContent = stringUtils.substringAfter(ruleText, mask);
    this.scriptletParams = parseRule(ruleText);
  }

  /**
   * Scriptlet config provided to build rules with debug capabilities
   * @typedef {Object} ScriptletConfig
   * @property {boolean} debug - indicates whether debug mode is enabled or not
   * @param {string} engine - engine identifier
   * @param {string} version - engine version
   */

  /**
   * Returns script. If debug enabled, rebuilds script with new parameters
   * @param {ScriptletConfig} scriptletConfig
   * @return {string | null}
   */
  function getScript(scriptletConfig) {
    const debugMode = !!(scriptletConfig && scriptletConfig.debug);

    if (debugMode === !!this.scriptletParams.debug && this.script) {
      return this.script;
    }

    this.scriptletParams = Object.assign(
      {},
      this.scriptletParams,
      scriptletConfig,
      { ruleText: this.ruleText }
    );

    this.script = getScriptletCode(this.scriptletParams);
    return this.script;
  }

  /**
   * Check is CyberPurify scriptlet rule
   * @static
   */
  ScriptletRule.isPurifyScriptletRule = (rule) =>
    rule.indexOf(ADG_SCRIPTLET_MASK) > -1;

  /**
   * returns rule content after mask
   * e.g. "example.org#%#//scriptlet("abort-on-property-read", "alert")" ->
   * -> "//scriptlet("abort-on-property-read", "alert")"
   * @return {string}
   */
  function getRuleContent() {
    return this.ruleContent;
  }

  /**
   * Extends BaseFilterRule
   */
  ScriptletRule.prototype = Object.create(api.FilterRule.prototype);
  ScriptletRule.prototype.constructor = ScriptletRule;

  ScriptletRule.prototype.getScript = getScript;

  ScriptletRule.prototype.getRuleContent = getRuleContent;

  /**
   * @static ScriptletRule
   */
  api.ScriptletRule = ScriptletRule;
})(purify, purify.rules);
