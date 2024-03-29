/**
 * ----------------------------------------------------------------------------------
 * PurifyBrowserExtension test-rule-constructor.js
 * Licensed under MIT (https://github.com/cyberpurify/CyberPurify/blob/main/LICENSE)
 * ----------------------------------------------------------------------------------
 */

QUnit.test("Rules Constructor for Assistant", function (assert) {
  var element = document.getElementById("test-div");
  var elementHref = document.getElementsByClassName("a-test-class")[0];

  var options = {
    ruleType: "CSS",
    urlMask: "test.com/page",
    cssSelectorType: "STRICT_FULL",
    isBlockOneDomain: false,
    url: "http://example.org/test-page.html?param=p1",
  };

  var ruleText = DevToolsRulesConstructor.constructRuleText(element, options);
  assert.equal(ruleText, "example.org###test-div");

  options.ruleType = "URL";
  ruleText = DevToolsRulesConstructor.constructRuleText(element, options);
  assert.equal(ruleText, "test.com/page$domain=example.org");

  options.ruleType = "CSS";
  options.cssSelectorType = "SIMILAR";
  options.isBlockOneDomain = false;
  ruleText = DevToolsRulesConstructor.constructRuleText(element, options);
  assert.equal(ruleText, "example.org##.test-class, .test-class-two");

  options.ruleType = "CSS";
  options.cssSelectorType = "STRICT_FULL";
  options.isBlockOneDomain = true;
  ruleText = DevToolsRulesConstructor.constructRuleText(element, options);
  assert.equal(ruleText, "###test-div");

  options.ruleType = "CSS";
  options.cssSelectorType = "STRICT_FULL";
  options.isBlockOneDomain = true;
  ruleText = DevToolsRulesConstructor.constructRuleText(elementHref, options);
  assert.equal(
    ruleText,
    "###test-div > a.a-test-class.a-test-class-two.a-test-class-three:first-child"
  );
});

QUnit.test("Rules Constructor for DevTools", function (assert) {
  var element = document.getElementById("test-div");
  var elementHref = document.getElementsByClassName("a-test-class")[0];

  var options = {
    ruleType: "CSS",
    urlMask: "test.com/page",
    cssSelectorType: "STRICT_FULL",
    isBlockOneDomain: false,
    url: "http://example.org/test-page.html?param=p1",
    attributes: "",
    excludeId: false,
  };

  var ruleText = DevToolsRulesConstructor.constructRuleText(element, options);
  assert.equal(ruleText, "example.org###test-div");

  options.cssSelectorType = "SIMILAR";
  options.classList = [];
  ruleText = DevToolsRulesConstructor.constructRuleText(element, options);
  assert.equal(ruleText, "example.org");

  options.classList = null;
  options.excludeTagName = false;
  ruleText = DevToolsRulesConstructor.constructRuleText(element, options);
  assert.equal(ruleText, "example.org##.test-class, .test-class-two");

  options.ruleType = "CSS";
  options.cssSelectorType = "SIMILAR";
  options.isBlockOneDomain = true;
  options.excludeTagName = true;
  ruleText = DevToolsRulesConstructor.constructRuleText(element, options);
  assert.equal(ruleText, "##.test-class, .test-class-two");

  options.classList = ["test-class-two"];
  ruleText = DevToolsRulesConstructor.constructRuleText(element, options);
  assert.equal(ruleText, "##.test-class-two");
  options.classList = null;

  options.ruleType = "CSS";
  options.cssSelectorType = "STRICT_FULL";
  options.isBlockOneDomain = true;
  options.attributes = '[title="Share on Twitter"][attribute="aValue"]';
  ruleText = DevToolsRulesConstructor.constructRuleText(element, options);
  assert.equal(
    ruleText,
    '###test-div[title="Share on Twitter"][attribute="aValue"]'
  );

  options.ruleType = "CSS";
  options.cssSelectorType = "STRICT_FULL";
  options.isBlockOneDomain = true;
  options.attributes = "";
  options.excludeTagName = false;
  ruleText = DevToolsRulesConstructor.constructRuleText(elementHref, options);
  assert.equal(
    ruleText,
    "###test-div > a.a-test-class.a-test-class-two.a-test-class-three:first-child"
  );

  options.excludeTagName = true;
  ruleText = DevToolsRulesConstructor.constructRuleText(elementHref, options);
  assert.equal(
    ruleText,
    "###test-div > .a-test-class.a-test-class-two.a-test-class-three:first-child"
  );

  options.classList = ["a-test-class-two", "a-test-class-three"];
  ruleText = DevToolsRulesConstructor.constructRuleText(elementHref, options);
  assert.equal(
    ruleText,
    "###test-div > .a-test-class-two.a-test-class-three:first-child"
  );
});

QUnit.test("Rules Constructor DevTools Id Elements Special Cases", function (
  assert
) {
  var element = document.getElementById("test-div");
  var elementHref = document.getElementsByClassName("a-test-class")[0];

  var options = {
    ruleType: "CSS",
    urlMask: "test.com/page",
    cssSelectorType: "STRICT_FULL",
    isBlockOneDomain: false,
    url: "http://example.org/test-page.html?param=p1",
    attributes: "",
    excludeId: false,
  };

  var ruleText = DevToolsRulesConstructor.constructRuleText(element, options);
  assert.equal(ruleText, "example.org###test-div");

  //Id attribute is checked
  options.attributes = '[title="Share on Twitter"]';
  options.excludeId = false;
  ruleText = DevToolsRulesConstructor.constructRuleText(element, options);
  assert.equal(ruleText, 'example.org###test-div[title="Share on Twitter"]');

  //Element has id but it's not checked
  options.attributes = '[title="Share on Twitter"]';
  options.excludeId = true;
  ruleText = DevToolsRulesConstructor.constructRuleText(element, options);
  assert.equal(ruleText, 'example.org##[title="Share on Twitter"]');

  //Element doesn't have id - option should not have any effect
  options.excludeId = false;
  ruleText = DevToolsRulesConstructor.constructRuleText(elementHref, options);
  assert.equal(
    ruleText,
    'example.org###test-div > a.a-test-class.a-test-class-two.a-test-class-three:first-child[title="Share on Twitter"]'
  );

  options.excludeId = true;
  ruleText = DevToolsRulesConstructor.constructRuleText(elementHref, options);
  assert.equal(
    ruleText,
    'example.org###test-div > a.a-test-class.a-test-class-two.a-test-class-three:first-child[title="Share on Twitter"]'
  );
});

QUnit.test("Rules Constructor for special elements", function (assert) {
  var elementHref = document.querySelector("#test-div h2");
  var options = {
    ruleType: "CSS",
    urlMask: null,
    cssSelectorType: "STRICT_FULL",
    isBlockOneDomain: false,
    url: "https://lenta.ru/",
    attributes: "",
    excludeTagName: false,
    classList: null,
  };

  var ruleText = DevToolsRulesConstructor.constructRuleText(
    elementHref,
    options
  );
  assert.equal(ruleText, "lenta.ru###test-div > h2:last-child");

  var elementDivId = document.getElementById("test-id-div");
  options = {
    ruleType: "CSS",
    urlMask: null,
    cssSelectorType: "STRICT_FULL",
    isBlockOneDomain: false,
    url: "https://lenta.ru/",
    attributes: "",
    excludeTagName: true,
    classList: null,
    excludeId: false,
  };

  ruleText = DevToolsRulesConstructor.constructRuleText(elementDivId, options);
  assert.equal(ruleText, "lenta.ru###test-id-div");

  options.excludeTagName = false;
  ruleText = DevToolsRulesConstructor.constructRuleText(elementDivId, options);
  assert.equal(ruleText, "lenta.ru##div#test-id-div");

  options.attributes = '[title="Share on Twitter"]';
  ruleText = DevToolsRulesConstructor.constructRuleText(elementDivId, options);
  assert.equal(ruleText, 'lenta.ru##div#test-id-div[title="Share on Twitter"]');

  options.attributes = '[someAttr="some-attr-value"][title="Share on Twitter"]';
  ruleText = DevToolsRulesConstructor.constructRuleText(elementDivId, options);
  assert.equal(
    ruleText,
    'lenta.ru##div#test-id-div[someAttr="some-attr-value"][title="Share on Twitter"]'
  );

  options.classList = ["test-class-two"];
  delete options.attributes;
  ruleText = DevToolsRulesConstructor.constructRuleText(elementDivId, options);
  assert.equal(ruleText, "lenta.ru##div#test-id-div.test-class-two");
});

QUnit.test("Rules Constructor for CSS selector", function (assert) {
  var selector;
  selector = DevToolsRulesConstructor.constructRuleCssSelector(
    "lenta.ru##div.test-class-two#test-id-div$domain=example.org"
  );
  assert.equal("div.test-class-two#test-id-div", selector);

  selector = DevToolsRulesConstructor.constructRuleCssSelector(
    "lenta.ru###test-div > h2:last-child"
  );
  assert.equal("#test-div > h2:last-child", selector);

  selector = DevToolsRulesConstructor.constructRuleCssSelector(
    '##div#test-id-div[title="Share on Twitter"]'
  );
  assert.equal('div#test-id-div[title="Share on Twitter"]', selector);

  selector = DevToolsRulesConstructor.constructRuleCssSelector(
    "http://test.com/page$domain=example.org"
  );
  assert.equal(selector, '[src*="http://test.com/page"]');

  selector = DevToolsRulesConstructor.constructRuleCssSelector(
    "||http://rutorads.com^$popup"
  );
  assert.equal(selector, '[src*="http://rutorads.com"]');

  selector = DevToolsRulesConstructor.constructRuleCssSelector(
    "#%#window.AG_onLoad = function(func) { if (window.addEventListener) { window.addEventListener('DOMContentLoaded', func); } };"
  );
  assert.equal(selector);
});

QUnit.test("SVG Elements", function (assert) {
  var element = document.querySelector(".b-header-main__logo-icon use");
  assert.ok(element != null);

  var options = {
    ruleType: "CSS",
    urlMask: null,
    cssSelectorType: "STRICT_FULL",
    isBlockOneDomain: false,
    url: "https://lenta.ru/",
    attributes: "",
    excludeTagName: false,
    classList: null,
  };

  var ruleText = DevToolsRulesConstructor.constructRuleText(element, options);
  assert.equal(
    ruleText,
    "lenta.ru###test-id-div > svg.b-header-main__logo-icon:nth-child(2) > use"
  );
});

QUnit.test("Dot Classes", function (assert) {
  var element = document.querySelector(".test-div-dot-class");
  var options = {
    ruleType: "CSS",
    urlMask: null,
    cssSelectorType: "STRICT_FULL",
    isBlockOneDomain: false,
    url: "https://lenta.ru/",
    attributes: "",
    excludeTagName: false,
    classList: null,
  };

  var ruleText = DevToolsRulesConstructor.constructRuleText(element, options);
  assert.equal(
    ruleText,
    "lenta.ru###test-id-div > div.good-class.bad\\.class:last-child > div.test-div-dot-class"
  );

  element = document.querySelector(".good-class");

  options.cssSelectorType = "SIMILAR";
  var selector = DevToolsRulesConstructor.constructRuleText(element, options);
  assert.equal(selector, "lenta.ru##.good-class, .bad\\.class");
});

QUnit.test("Body selector", (assert) => {
  const element = document.querySelector("body");
  const options = {
    ruleType: "CSS",
    urlMask: null,
    cssSelectorType: "STRICT_FULL",
    isBlockOneDomain: false,
    url: "https://lenta.ru/",
    attributes: "",
    excludeTagName: false,
    classList: null,
  };

  const ruleText = DevToolsRulesConstructor.constructRuleText(element, options);
  assert.equal(ruleText, "lenta.ru##body");

  options.attributes = '[bgcolor="#ffffff"]';
  const selector = DevToolsRulesConstructor.constructRuleText(element, options);
  assert.equal(selector, 'lenta.ru##body[bgcolor="#ffffff"]');
});
