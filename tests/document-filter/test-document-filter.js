/**
 * ----------------------------------------------------------------------------------
 * PurifyBrowserExtension test-document-filter.js
 * Licensed under MIT (https://github.com/cyberpurify/CyberPurify/blob/main/LICENSE)
 * ----------------------------------------------------------------------------------
 */

/* global QUnit */

const { test } = QUnit;
const {
  rules: { documentFilterService },
} = purify;

// Mocks extension api;
purify.getURL = (url) => url;
purify.tabs = {};
purify.tabs.getActive = () => {};

test("document filter service returns url for not trusted url", (assert) => {
  const url = "https://example.org/";
  const ruleText = "||example.org^$document";

  const blockingUrl = documentFilterService.getDocumentBlockPageUrl(
    url,
    ruleText
  );
  assert.equal(
    blockingUrl,
    "pages/blocking-pages/adBlockedPage.html?url=https%3A%2F%2Fexample.org%2F&rule=%7C%7Cexample.org%5E%24document"
  );
});

// test("document filter service adds pages to trusted", (assert) => {
//   const url = "https://example.org/";
//   const ruleText = "||example.org^$document";
//   documentFilterService.addToTrusted(url);
//   const blockingUrl = documentFilterService.getDocumentBlockPageUrl(
//     url,
//     ruleText
//   );
//   assert.equal(blockingUrl, null);
// });
