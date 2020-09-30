

(function (api) {
  /**
   * This rule may contain a list of rules generated from one complex ruleText
   * @constructor
   *
   * @example
   * input
   * ABP snippet rule
   * `example.org#$#hide-if-has-and-matches-style someSelector; hide-if-contains someSelector2`
   *
   * output
   * Purify scriptlet rules
   * `example.org#%#//scriptlet("hide-if-has-and-matches-style", "someSelector")`
   * `example.org#%#//scriptlet("hide-if-contains", "someSelector2")`
   *
   */
  function CompositeRule(ruleText, rules) {
    this.ruleText = ruleText;
    this.rules = rules;
  }

  /**
   * @static ScriptletRule
   */
  api.CompositeRule = CompositeRule;
})(purify.rules);
