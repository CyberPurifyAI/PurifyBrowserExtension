/**
 * ----------------------------------------------------------------------------------
 * PurifyBrowserExtension test-css-hits.js
 * Licensed under MIT (https://github.com/cyberpurify/CyberPurify/blob/main/LICENSE)
 * ----------------------------------------------------------------------------------
 */

var CssFilter = purify.rules.CssFilter;

var genericHide =
  CssFilter.RETRIEVE_TRADITIONAL_CSS +
  CssFilter.RETRIEVE_EXTCSS +
  CssFilter.GENERIC_HIDE_APPLIED;

QUnit.test("Extended Css Build CssHits", function (assert) {
  var rule = new purify.rules.CssFilterRule("purify.com##.sponsored", 1);
  var genericRule = new purify.rules.CssFilterRule("##.banner", 2);
  var extendedCssRule = new purify.rules.CssFilterRule(
    "purify.com##.sponsored[-ext-contains=test]",
    1
  );
  var ruleWithContentAttribute = new purify.rules.CssFilterRule(
    "purify.com#$#.background {content: 'test'}",
    1
  );
  var ruleWithContentInSelector = new purify.rules.CssFilterRule(
    "purify.com#$#.bgcontent {display: none}",
    1
  );
  var filter = new purify.rules.CssFilter([
    rule,
    genericRule,
    extendedCssRule,
    ruleWithContentAttribute,
    ruleWithContentInSelector,
  ]);

  var selectors = filter.buildCssHits("purify.com");
  var css = selectors.css;
  var extendedCss = selectors.extendedCss;
  var commonCss = filter.buildCssHits(null).css;
  assert.equal(commonCss.length, 1);
  assert.equal(
    commonCss[0].trim(),
    ".banner { display: none!important; content: 'purify2%3B%23%23.banner' !important;}"
  );
  assert.equal(css.length, 4);
  assert.equal(
    css[0].trim(),
    ".banner { display: none!important; content: 'purify2%3B%23%23.banner' !important;}"
  );
  assert.equal(
    css[1].trim(),
    ".bgcontent {display: none; content: 'purify1%3Bpurify.com%23%24%23.bgcontent%20%7Bdisplay%3A%20none%7D' !important;}"
  );
  // purify mark is not inserted in the rules with content attribute
  assert.equal(css[2].trim(), ".background {content: 'test'}");
  assert.equal(
    css[3].trim(),
    ".sponsored { display: none!important; content: 'purify1%3Bpurify.com%23%23.sponsored' !important;}"
  );
  assert.equal(extendedCss.length, 1);
  assert.equal(
    extendedCss[0].trim(),
    ".sponsored[-ext-contains=test] { display: none!important; content: 'purify1%3Bpurify.com%23%23.sponsored%5B-ext-contains%3Dtest%5D' !important;}"
  );

  selectors = filter.buildCssHits("purify.com", genericHide);
  css = selectors.css;
  extendedCss = selectors.extendedCss;
  commonCss = filter.buildCssHits(null).css;
  assert.equal(commonCss.length, 1);
  assert.equal(
    commonCss[0].trim(),
    ".banner { display: none!important; content: 'purify2%3B%23%23.banner' !important;}"
  );
  assert.equal(css.length, 3);
  assert.equal(
    css[0].trim(),
    ".bgcontent {display: none; content: 'purify1%3Bpurify.com%23%24%23.bgcontent%20%7Bdisplay%3A%20none%7D' !important;}"
  );
  // purify mark is not inserted in the rules with content attribute
  assert.equal(css[1].trim(), ".background {content: 'test'}");
  assert.equal(
    css[2].trim(),
    ".sponsored { display: none!important; content: 'purify1%3Bpurify.com%23%23.sponsored' !important;}"
  );
  assert.equal(extendedCss.length, 1);
  assert.equal(
    extendedCss[0].trim(),
    ".sponsored[-ext-contains=test] { display: none!important; content: 'purify1%3Bpurify.com%23%23.sponsored%5B-ext-contains%3Dtest%5D' !important;}"
  );
});

// https://github.com/CyberPurify/PurifyBrowserExtension/issues/1079
QUnit.test("Parsing of Extended Css rule with parenthesis", function (assert) {
  var elementWithParenthesisHtml =
    '<div class="withParenthesis" style="background: rgb(0, 0, 0)">element with parenthesis</div>';
  document.body.insertAdjacentHTML("beforeend", elementWithParenthesisHtml);

  var extendedCssRuleWithParenthesis = new purify.rules.CssFilterRule(
    "purify.com#$#.withParenthesis:matches-css(background: rgb(0, 0, 0)) { display: none!important;}",
    1
  );

  var filter = new purify.rules.CssFilter([extendedCssRuleWithParenthesis]);

  var selectors = filter.buildCssHits("purify.com");
  var extendedCss = selectors.extendedCss;
  // Apply extended css rules
  new ExtendedCss({ styleSheet: extendedCss.join("\n") }).apply();

  var elementWithParenthesis = document.querySelector(".withParenthesis");
  var styleOfElementWithParenthesis;
  if (elementWithParenthesis) {
    styleOfElementWithParenthesis = getComputedStyle(elementWithParenthesis);
  }
  assert.equal(styleOfElementWithParenthesis.display, "none");

  elementWithParenthesis.remove();
});

QUnit.test("Count css hits", function (assert) {
  var rule = new purify.rules.CssFilterRule("purify.com##.sponsored", 1);
  var genericRule = new purify.rules.CssFilterRule("purify.com##.banner", 2);
  var extendedCssRule = new purify.rules.CssFilterRule(
    'purify.com##.ads[-ext-contains="ads"]',
    1
  );
  var ruleWithContentAttribute = new purify.rules.CssFilterRule(
    "purify.com#$#.background {content: 'test'}",
    1
  );
  var ruleWithContentInSelector = new purify.rules.CssFilterRule(
    "purify.com#$#.bgcontent {display: none}",
    1
  );
  var filter = new purify.rules.CssFilter([
    rule,
    genericRule,
    extendedCssRule,
    ruleWithContentAttribute,
    ruleWithContentInSelector,
  ]);

  var selectors = filter.buildCssHits("purify.com");

  var css = selectors.css;

  for (var i = 0; i < css.length; i += 1) {
    var styleEl = document.createElement("style");
    styleEl.setAttribute("type", "text/css");
    styleEl.textContent = css[i];
    (document.head || document.documentElement).appendChild(styleEl);
  }

  var extendedCss = selectors.extendedCss;
  new ExtendedCss({ styleSheet: extendedCss.join("") }).apply();

  var done = assert.async();

  function setCssHitsFoundCallback(result) {
    assert.equal(result.length, 5);
    result.sort(function (s1, s2) {
      return s1.ruleText < s2.ruleText ? -1 : 1;
    });
    assert.equal(result[0].ruleText, 'purify.com##.ads[-ext-contains="ads"]');
    assert.equal(result[0].filterId, 1);
    assert.equal(result[1].ruleText, "purify.com##.banner");
    assert.equal(result[1].filterId, 2);
    assert.equal(result[2].ruleText, "purify.com##.sponsored");
    assert.equal(result[2].filterId, 1);
    assert.equal(result[3].ruleText, "purify.com##.sponsored");
    assert.equal(result[3].filterId, 1);
    assert.equal(result[4].ruleText, "purify.com#$#.bgcontent {display: none}");
    assert.equal(result[4].filterId, 1);
    CssHitsCounter.stop();
    done();
  }
  CssHitsCounter.init(setCssHitsFoundCallback);
});

QUnit.test("Count css hits affected by extended css", function (assert) {
  const extendedCssRule = {
    text: 'purify.com##.extended[-ext-contains="ads"]',
    filterId: 1,
  };

  const rules = [
    new purify.rules.CssFilterRule(
      extendedCssRule.text,
      extendedCssRule.filterId
    ),
  ];

  const filter = new purify.rules.CssFilter(rules);

  const selectors = filter.buildCssHits("purify.com");

  const done = assert.async();

  const extendedCss = selectors.extendedCss;

  const beforeStyleApplied = (affectedElement) => {
    const parseResult = CssHitsCounter.parseExtendedStyleInfo(
      affectedElement.rules[0].style.content
    );
    assert.equal(parseResult.filterId, extendedCssRule.filterId);
    assert.equal(parseResult.ruleText, extendedCssRule.text);
    done();
    return affectedElement;
  };

  new ExtendedCss({
    styleSheet: extendedCss.join(""),
    beforeStyleApplied: beforeStyleApplied,
  }).apply();
});

QUnit.test("Save css hits", function (assert) {
  var result = [];
  result.push({
    ruleText: 'purify.com##.ads[-ext-contains="ads"]',
    filterId: 1,
  });
  result.push({
    ruleText: "purify.com##.banner",
    filterId: 2,
  });
  result.push({
    ruleText: "purify.com##.sponsored",
    filterId: 1,
  });
  result.push({
    ruleText: "purify.com##.sponsored",
    filterId: 1,
  });

  window.localStorage.clear();

  purify.hitStats.addDomainView("purify.com");

  for (var i = 0; i < result.length; i++) {
    var stat = result[i];
    purify.hitStats.addRuleHit("purify.com", stat.ruleText, stat.filterId);
  }

  var stats = purify.hitStats.getStats();
  assert.equal(stats.views, 1);
  assert.ok(!!stats.domains["purify.com"]);
  assert.equal(stats.domains["purify.com"].views, 1);
  assert.equal(
    stats.domains["purify.com"].rules["1"][
      'purify.com##.ads[-ext-contains="ads"]'
    ].h,
    1
  );
  assert.equal(
    stats.domains["purify.com"].rules["1"]["purify.com##.sponsored"].h,
    2
  );
  assert.equal(
    stats.domains["purify.com"].rules["2"]["purify.com##.banner"].h,
    1
  );
});
