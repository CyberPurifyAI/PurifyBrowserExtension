/* global DevToolsRulesConstructor, contentPage */

/**
 * Helper object that provides methods used in devtools panel's code
 * Methods are invoked via inspectedWindow.eval function.
 * https://developer.chrome.com/extensions/devtools_inspectedWindow#method-eval
 *
 */
const DevToolsHelper = (function () {
  // eslint-disable-line
  const PREVIEW_STYLE_ID = "purify-preview-style";

  /**
   * Add user rule
   * @param options Object {ruleText: 'ruleText'}
   */
  const addRule = function (options) {
    contentPage.sendMessage({
      type: "addUserRule",
      ruleText: options.ruleText,
    });
  };

  /**
   * Add rule preview
   * @param options Object {ruleText: 'ruleText'}
   */
  const applyPreview = function (options) {
    const { ruleText } = options;

    const head = document.getElementsByTagName("head")[0];
    if (!head) {
      return;
    }

    const selector = DevToolsRulesConstructor.constructRuleCssSelector(
      ruleText
    );
    if (!selector) {
      return;
    }

    const style = document.createElement("style");
    style.setAttribute("type", "text/css");
    style.setAttribute("id", PREVIEW_STYLE_ID);
    style.appendChild(
      document.createTextNode(`${selector} {display: none !important;}`)
    );

    head.appendChild(style);
  };

  /**
   * Cancel early applied preview
   */
  const cancelPreview = function () {
    const head = document.getElementsByTagName("head")[0];
    if (!head) {
      return;
    }
    const style = document.getElementById(PREVIEW_STYLE_ID);
    if (style) {
      head.removeChild(style);
    }
  };

  return {
    addRule,
    applyPreview,
    cancelPreview,
  };
})();
