QUnit.test("Build Rules", (assert) => {
  const scriptFilter = new purify.rules.ScriptFilter();

  const ruleText =
    'www.example.org#%#//scriptlet("set-constant", "test", "true")';
  const rule = new purify.rules.ScriptletRule(ruleText);
  scriptFilter.addRule(rule);

  assert.equal(scriptFilter.getRules().length, 1, "Rule has been added");

  const whiteRuleText =
    'example.org#@%#//scriptlet("set-constant", "test", "true")';
  const whiteRule = new purify.rules.ScriptletRule(whiteRuleText);
  scriptFilter.addRule(whiteRule);

  assert.equal(
    scriptFilter.getRules().length,
    2,
    "Whitelist rule has been added"
  );

  assert.notOk(rule.isPermitted("example.org"));
  assert.notOk(rule.isPermitted("www.example.org"));
});

QUnit.test("Build Rules", (assert) => {
  let rule = purify.rules.builder.createRule("example.com", 0);
  assert.ok(rule);
  assert.ok(rule instanceof purify.rules.UrlFilterRule);

  rule = purify.rules.builder.createRule("example.com$important", 0);
  assert.ok(rule);
  assert.ok(rule instanceof purify.rules.UrlFilterRule);

  purify.prefs.features.responseContentFilteringSupported = true;

  rule = purify.rules.builder.createRule(
    'example.org$$script[data-src="banner"]',
    0
  );
  assert.ok(rule);
  assert.ok(rule instanceof purify.rules.ContentFilterRule);

  rule = purify.rules.builder.createRule(
    "example.org#%#window.__gaq = undefined;",
    0
  );
  assert.ok(rule);
  assert.ok(rule instanceof purify.rules.ScriptFilterRule);

  rule = purify.rules.builder.createRule(
    "example.org#%#window.__gaq = undefined;",
    0,
    false
  );
  assert.notOk(rule);

  rule = purify.rules.builder.createRule(
    "||example.org^$replace=/example/trusted/gi",
    0,
    false
  );
  assert.notOk(rule);

  rule = purify.rules.builder.createRule(
    "||example.org^$replace=/example/trusted/gi",
    0
  );
  assert.ok(rule);
});

QUnit.test("Unsupported rules", (assert) => {
  const rule = purify.rules.builder.createRule(
    "#$#body { background: black }",
    0
  );
  assert.ok(rule);
  assert.ok(rule instanceof purify.rules.CssFilterRule);
});

QUnit.test("Invalid Style Syntax", (assert) => {
  const ruleText = "yandex.ru##body:style()";
  assert.throws(() => {
    purify.rules.ruleConverter.convertRule(ruleText);
  }, new Error("Empty :style pseudo class: body:style()"));
});

// https://github.com/PurifyTeam/PurifyBrowserExtension/issues/1600
QUnit.test("Too short rules are ignored", (assert) => {
  let ruleText = "adg";
  let rule = purify.rules.builder.createRule(ruleText, 0);
  assert.notOk(rule);

  ruleText = "||example.org^$image";
  rule = purify.rules.builder.createRule(ruleText, 0);
  assert.ok(rule);
  assert.equal(rule.ruleText, ruleText);
});
