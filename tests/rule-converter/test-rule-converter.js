/**
 * ----------------------------------------------------------------------------------
 * PurifyBrowserExtension test-rule-converter.js
 * Licensed under MIT (https://github.com/cyberpurify/CyberPurify/blob/main/LICENSE)
 * ----------------------------------------------------------------------------------
 */

/* eslint-disable max-len */
/* global QUnit, purify */

QUnit.test("Test scriptlet purify rule", (assert) => {
  const rule = "example.org#%#//scriptlet('abort-on-property-read', 'I10C')";
  const exp = "example.org#%#//scriptlet('abort-on-property-read', 'I10C')";
  const res = purify.rules.ruleConverter.convertRule(rule);
  assert.equal(res, exp);
});

QUnit.test("Test scriptlet purify rule exception", (assert) => {
  const rule = "example.org#@%#//scriptlet('abort-on-property-read', 'I10C')";
  const exp = "example.org#@%#//scriptlet('abort-on-property-read', 'I10C')";
  const res = purify.rules.ruleConverter.convertRule(rule);
  assert.equal(res, exp);
});

QUnit.test("Test converter scriptlet ubo rule", (assert) => {
  // blocking rule
  const rule = "example.org##+js(setTimeout-defuser.js, [native code], 8000)";
  const exp =
    'example.org#%#//scriptlet("ubo-setTimeout-defuser.js", "[native code]", "8000")';
  const res = purify.rules.ruleConverter.convertRule(rule);
  assert.equal(res, exp);
  // whitelist rule
  let whitelistRule =
    "example.org#@#+js(setTimeout-defuser.js, [native code], 8000)";
  let expectedResult =
    'example.org#@%#//scriptlet("ubo-setTimeout-defuser.js", "[native code]", "8000")';
  assert.equal(
    purify.rules.ruleConverter.convertRule(whitelistRule),
    expectedResult
  );

  whitelistRule =
    "example.org#@#script:inject(abort-on-property-read.js, some.prop)";
  expectedResult =
    'example.org#@%#//scriptlet("ubo-abort-on-property-read.js", "some.prop")';
  assert.equal(
    purify.rules.ruleConverter.convertRule(whitelistRule),
    expectedResult
  );
});

QUnit.test("Test converter scriptlet abp rule", (assert) => {
  const rule =
    "example.org#$#hide-if-contains li.serp-item 'li.serp-item div.label'";
  const exp =
    'example.org#%#//scriptlet("abp-hide-if-contains", "li.serp-item", "li.serp-item div.label")';
  const res = purify.rules.ruleConverter.convertRule(rule);
  assert.equal(res, exp);
});

QUnit.test("Test converter scriptlet multiple abp rule", (assert) => {
  const rule =
    "example.org#$#hide-if-has-and-matches-style 'd[id^=\"_\"]' 'div > s' 'display: none'; hide-if-contains /.*/ .p 'a[href^=\"/ad__c?\"]'";
  const exp1 =
    'example.org#%#//scriptlet("abp-hide-if-has-and-matches-style", "d[id^=\\"_\\"]", "div > s", "display: none")';
  const exp2 =
    'example.org#%#//scriptlet("abp-hide-if-contains", "/.*/", ".p", "a[href^=\\"/ad__c?\\"]")';
  const res = purify.rules.ruleConverter.convertRule(rule);

  assert.equal(res.length, 2);
  assert.equal(res[0], exp1);
  assert.equal(res[1], exp2);
});

QUnit.test("Test converter css purify rule", (assert) => {
  const rule = "firmgoogle.com#$#.pub_300x250 {display:block!important;}";
  const exp = "firmgoogle.com#$#.pub_300x250 {display:block!important;}";
  const res = purify.rules.ruleConverter.convertRule(rule);

  assert.equal(
    res,
    exp,
    "the issue of this test that adg css rule and abp snippet rule has the same mask, but different content"
  );

  // https://github.com/CyberPurify/PurifyBrowserExtension/issues/1412
  const whitelistCssRule = "example.com#@$#h1 { display: none!important; }";
  const expected = "example.com#@$#h1 { display: none!important; }";
  const actual = purify.rules.ruleConverter.convertRule(whitelistCssRule);
  assert.equal(
    actual,
    expected,
    "AG CSS whitelist rules should not be parsed as ABP scriptlet rule"
  );
});

QUnit.test("Composite rules", (assert) => {
  const requestFilter = new purify.RequestFilter();
  const rule =
    "example.org#$#hide-if-has-and-matches-style 'd[id^=\"_\"]' 'div > s' 'display: none'; hide-if-contains /.*/ .p 'a[href^=\"/ad__c?\"]'";
  const compositeRule = purify.rules.builder.createRule(rule, 0);

  assert.ok(compositeRule);
  assert.ok(compositeRule instanceof purify.rules.CompositeRule);

  requestFilter.addRule(compositeRule);
  const rules = requestFilter.getRules();
  assert.equal(rules.length, 2);

  requestFilter.removeRule(compositeRule);
  const rules1 = requestFilter.getRules();
  assert.equal(rules1, 0);
});

QUnit.test("Comments in rule", (assert) => {
  let rule = purify.rules.builder.createRule(
    "! example.com#$#.pub_300x250 {display:block!important;}",
    0
  );
  assert.notOk(rule, "rule with comment mask should return null");

  rule = purify.rules.builder.createRule(
    "! ain.ua#$#body - удаление брендированного фона, отступа сверху",
    0
  );
  assert.notOk(rule, "rule with comment mask should return null");
});

QUnit.test("Converts ABP rules into AG compatible rule", (assert) => {
  let actual = purify.rules.ruleConverter.convertRule(
    "||e9377f.com^$rewrite=abp-resource:blank-mp3,domain=eastday.com"
  );
  let expected = "||e9377f.com^$redirect=blank-mp3,domain=eastday.com";
  assert.equal(actual, expected);

  actual = purify.rules.ruleConverter.convertRule(
    "||lcok.net/2019/ad/$domain=huaren.tv,rewrite=abp-resource:blank-mp3"
  );
  expected = "||lcok.net/2019/ad/$domain=huaren.tv,redirect=blank-mp3";
  assert.equal(actual, expected);

  actual = purify.rules.ruleConverter.convertRule(
    "||lcok.net/2019/ad/$domain=huaren.tv"
  );
  expected = "||lcok.net/2019/ad/$domain=huaren.tv";
  assert.equal(actual, expected);
});

QUnit.test("converts empty and mp4 modifiers into redirect rules", (assert) => {
  let actual = purify.rules.ruleConverter.convertRule(
    "/(pagead2)/$domain=vsetv.com,empty,important"
  );
  let expected = "/(pagead2)/$domain=vsetv.com,redirect=nooptext,important";
  assert.equal(actual, expected);

  actual = purify.rules.ruleConverter.convertRule("||fastmap33.com^$empty");
  expected = "||fastmap33.com^$redirect=nooptext";
  assert.equal(actual, expected);

  actual = purify.rules.ruleConverter.convertRule(
    "||anyporn.com/xml^$media,mp4"
  );
  expected = purify.rules.ruleConverter.convertRule(
    "||anyporn.com/xml^$media,redirect=noopmp4-1s"
  );
  assert.equal(actual, expected);
});

QUnit.test(
  "$mp4 modifier should always go with $media modifier together",
  (assert) => {
    let rule = "||video.example.org^$mp4";
    let actual = purify.rules.ruleConverter.convertRule(rule);
    let expected = "||video.example.org^$redirect=noopmp4-1s,media";
    assert.equal(actual, expected);

    rule = "||video.example.org^$media,mp4";
    actual = purify.rules.ruleConverter.convertRule(rule);
    expected = "||video.example.org^$media,redirect=noopmp4-1s";
    assert.equal(actual, expected);

    rule = "||video.example.org^$media,mp4,domain=example.org";
    actual = purify.rules.ruleConverter.convertRule(rule);
    expected =
      "||video.example.org^$media,redirect=noopmp4-1s,domain=example.org";
    assert.equal(actual, expected);

    rule = "||video.example.org^$mp4,domain=example.org,media";
    actual = purify.rules.ruleConverter.convertRule(rule);
    expected =
      "||video.example.org^$redirect=noopmp4-1s,domain=example.org,media";
    assert.equal(actual, expected);
  }
);

QUnit.test(
  "script[has-text] and script[tag-content] should be converted",
  (assert) => {
    let rule = "example.com##^script:some-another-rule(test)";
    let actual = purify.rules.ruleConverter.convertRule(rule);
    assert.equal(actual, rule, "Should return the same rule");

    rule = "example.com##^script:has-text(12313)";
    actual = purify.rules.ruleConverter.convertRule(rule);
    assert.equal(actual.length, 1, "Single rule check");
    assert.equal(
      actual[0],
      'example.com$$script[tag-content="12313"][max-length="262144"]',
      "Should be converted to adg rule"
    );

    rule = "example.com##^script:has-text(===):has-text(/[wW]{16000}/)";
    actual = purify.rules.ruleConverter.convertRule(rule);
    assert.equal(actual.length, 2, "Two rules, one of then nor supporting");
    assert.equal(
      actual[0],
      'example.com$$script[tag-content="==="][max-length="262144"]',
      "Should be converted to adg rule"
    );
    assert.equal(
      actual[1],
      "example.com##^script:has-text(/[wW]{16000}/)",
      "Should be separated to ubo rule"
    );
  }
);

QUnit.test("converts inline-script modifier into csp rule", (assert) => {
  let rule = "||vcrypt.net^$inline-script";
  let actual = purify.rules.ruleConverter.convertRule(rule);
  // eslint-disable-next-line max-len
  let expected =
    "||vcrypt.net^$csp=script-src 'self' 'unsafe-eval' http: https: data: blob: mediastream: filesystem:";
  assert.equal(actual, expected);

  // test rules with more modifiers
  rule = "||vcrypt.net^$frame,inline-script";
  actual = purify.rules.ruleConverter.convertRule(rule);
  expected =
    "||vcrypt.net^$frame,csp=script-src 'self' 'unsafe-eval' http: https: data: blob: mediastream: filesystem:";
  assert.equal(actual, expected);
});

QUnit.test("converts inline-font modifier into csp rule", (assert) => {
  let rule = "||vcrypt.net^$inline-font";
  let actual = purify.rules.ruleConverter.convertRule(rule);
  // eslint-disable-next-line max-len
  let expected =
    "||vcrypt.net^$csp=font-src 'self' 'unsafe-eval' http: https: data: blob: mediastream: filesystem:";
  assert.equal(actual, expected);

  rule = "||vcrypt.net^$inline-font,domain=example.org";
  actual = purify.rules.ruleConverter.convertRule(rule);
  // eslint-disable-next-line max-len
  expected =
    "||vcrypt.net^$csp=font-src 'self' 'unsafe-eval' http: https: data: blob: mediastream: filesystem:,domain=example.org";
  assert.equal(actual, expected);
});

QUnit.test(
  "converts union of inline-font,inline-script modifier into csp rule",
  (assert) => {
    let rule = "||vcrypt.net^$inline-font,inline-script";
    let actual = purify.rules.ruleConverter.convertRule(rule);
    // eslint-disable-next-line max-len
    let expected =
      "||vcrypt.net^$csp=font-src 'self' 'unsafe-eval' http: https: data: blob: mediastream: filesystem:; script-src 'self' 'unsafe-eval' http: https: data: blob: mediastream: filesystem:";
    assert.equal(actual, expected);

    rule = "||vcrypt.net^$domain=example.org,inline-font,inline-script";
    actual = purify.rules.ruleConverter.convertRule(rule);
    // eslint-disable-next-line max-len
    expected =
      "||vcrypt.net^$domain=example.org,csp=font-src 'self' 'unsafe-eval' http: https: data: blob: mediastream: filesystem:; script-src 'self' 'unsafe-eval' http: https: data: blob: mediastream: filesystem:";
    assert.equal(actual, expected);
  }
);

QUnit.test("converts rules with $all modifier into 4 rules", (assert) => {
  // test simple rule;
  let rule = "||example.org^$all";
  let actual = purify.rules.ruleConverter.convertRule(rule);
  let exp1 = "||example.org^$document,popup";
  let exp2 = "||example.org^";
  let exp3 =
    "||example.org^$csp=script-src 'self' 'unsafe-eval' http: https: data: blob: mediastream: filesystem:";
  let exp4 =
    "||example.org^$csp=font-src 'self' 'unsafe-eval' http: https: data: blob: mediastream: filesystem:";

  assert.equal(actual.length, 4);
  assert.ok(actual.includes(exp1));
  assert.ok(actual.includes(exp2));
  assert.ok(actual.includes(exp3));
  assert.ok(actual.includes(exp4));

  // test rule with more options
  rule = "||example.org^$all,important";
  actual = purify.rules.ruleConverter.convertRule(rule);
  exp1 = "||example.org^$document,popup,important";
  exp2 = "||example.org^$important";
  exp3 =
    "||example.org^$csp=script-src 'self' 'unsafe-eval' http: https: data: blob: mediastream: filesystem:,important";
  exp4 =
    "||example.org^$csp=font-src 'self' 'unsafe-eval' http: https: data: blob: mediastream: filesystem:,important";
  assert.equal(actual.length, 4);
  assert.ok(actual.includes(exp1));
  assert.ok(actual.includes(exp2));
  assert.ok(actual.includes(exp3));
  assert.ok(actual.includes(exp4));
});

QUnit.test("$badfilter is not omitted after rule conversion", (assert) => {
  const badfilterRule =
    "||example.org/favicon.ico$domain=example.org,empty,important,badfilter";
  const actual = purify.rules.ruleConverter.convertRule(badfilterRule);
  const expected =
    "||example.org/favicon.ico$domain=example.org,redirect=nooptext,important,badfilter";
  assert.equal(actual, expected);
});

QUnit.test("converts ghide, ehide options", (assert) => {
  let rule = "@@||example.com^$ghide";
  let actual = purify.rules.ruleConverter.convertRule(rule);
  let expected = "@@||example.com^$generichide";
  assert.equal(actual, expected);

  rule = "@@||example.com^$ehide";
  actual = purify.rules.ruleConverter.convertRule(rule);
  expected = "@@||example.com^$elemhide";
  assert.equal(actual, expected);

  rule = "@@||example.com^$ehide,jsinject";
  actual = purify.rules.ruleConverter.convertRule(rule);
  expected = "@@||example.com^$elemhide,jsinject";
  assert.equal(actual, expected);
});
