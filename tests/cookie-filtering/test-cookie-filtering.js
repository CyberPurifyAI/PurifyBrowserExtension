/**
 * ----------------------------------------------------------------------------------
 * PurifyBrowserExtension test-cookie-filtering.js
 * Licensed under MIT (https://github.com/cyberpurify/CyberPurify/blob/main/LICENSE)
 * ----------------------------------------------------------------------------------
 */

/* global QUnit */

QUnit.test("Test cookie filter", (assert) => {
  const filter = new purify.rules.CookieFilter();
  const rule1 = new purify.rules.UrlFilterRule("$cookie=/__utm[a-z]/");
  const rule2 = new purify.rules.UrlFilterRule("$cookie=__cfduid");
  filter.addRules([rule1, rule2]);

  let rules = filter.findCookieRules(
    "http://example.org",
    "example.org",
    false,
    purify.RequestTypes.DOCUMENT
  );
  assert.equal(2, rules.length);
  assert.equal(rule1.ruleText, rules[0].ruleText);
  assert.equal(rule2.ruleText, rules[1].ruleText);

  const rule3 = new purify.rules.UrlFilterRule("@@$cookie=/__utm[a-z]/");
  filter.addRule(rule3);

  rules = filter.findCookieRules(
    "http://example.org",
    "example.org",
    false,
    purify.RequestTypes.DOCUMENT
  );
  assert.equal(2, rules.length);
  assert.equal(rule3.ruleText, rules[0].ruleText);
  assert.equal(rule2.ruleText, rules[1].ruleText);

  const rule4 = new purify.rules.UrlFilterRule("@@$cookie=__cfduid");
  filter.addRule(rule4);

  rules = filter.findCookieRules(
    "http://example.org",
    "example.org",
    false,
    purify.RequestTypes.DOCUMENT
  );
  assert.equal(2, rules.length);
  assert.equal(rule3.ruleText, rules[0].ruleText);
  assert.equal(rule4.ruleText, rules[1].ruleText);

  const rule5 = new purify.rules.UrlFilterRule("@@$cookie");
  filter.addRule(rule5);

  rules = filter.findCookieRules(
    "http://example.org",
    "example.org",
    false,
    purify.RequestTypes.DOCUMENT
  );
  assert.equal(1, rules.length);
  assert.equal(rule5.ruleText, rules[0].ruleText);

  const rule6 = new purify.rules.UrlFilterRule("@@$cookie=/__cfd[a-z]/");
  filter.removeRule(rule5);
  filter.removeRule(rule4);
  filter.addRule(rule6);

  rules = filter.findCookieRules(
    "http://example.org",
    "example.org",
    false,
    purify.RequestTypes.DOCUMENT
  );
  assert.equal(2, rules.length);
  assert.equal(rule3.ruleText, rules[0].ruleText);
  assert.equal(rule6.ruleText, rules[1].ruleText);
});

// QUnit.test("Test cookie filtering", function (assert) {
//
//     // TODO: Implement tests
//
//     purify.cookieFiltering.filterRequestHeaders({});
//     purify.cookieFiltering.filterResponseHeaders({});
//
//     assert.ok(true);
// });
