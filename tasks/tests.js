import gulp from "gulp";
import path from "path";
import { runQunitPuppeteer, printOutput } from "node-qunit-puppeteer";

const runQunit = (testFilePath, done) => {
  const qunitArgs = {
    targetUrl: `file://${path.resolve(__dirname, testFilePath)}`,
    timeout: 20000,
    redirectConsole: true,
  };

  runQunitPuppeteer(qunitArgs)
    .then((result) => {
      printOutput(result, console);
      if (result.stats.failed > 0) {
        done("Some of the unit tests failed");
      }
    })
    .then(done)
    .catch((ex) => {
      done(`Error occurred while running tests: ${ex}`);
    });
};

// Rule constructor tests
const testRule = (done) => {
  runQunit("../tests/rule-constructor/test-rule-constructor.html", done);
};

// Safebrowsing filter tests
const testSB = (done) => {
  runQunit("../tests/sb-filter/test-sb-filter.html", done);
};

// Url filter tests
const testURL = (done) => {
  runQunit("../tests/url-filter/test-url-filter.html", done);
};

// Css filter tests
const testCSSfilter = (done) => {
  runQunit("../tests/css-filter/test-css-filter.html", done);
};

// Content filter tests
const testContent = (done) => {
  runQunit("../tests/content-filter/test-content-filter.html", done);
};

// Cookie filtering tests
const testCookieFiltering = (done) => {
  runQunit("../tests/cookie-filtering/test-cookie-filtering.html", done);
};

// Css hits tests
const testCSShits = (done) => {
  runQunit("../tests/css-filter/test-css-hits.html", done);
};

// Request filter tests
const testReq = (done) => {
  runQunit("../tests/request-filter/test-request-filter.html", done);
};

// Element collapser tests
const testEl = (done) => {
  runQunit("../tests/miscellaneous/test-element-collapser.html", done);
};

// Ring buffer tests
const testRing = (done) => {
  runQunit("../tests/miscellaneous/test-ring-buffer.html", done);
};

// Cookie helper tests
const testCookie = (done) => {
  runQunit("../tests/miscellaneous/test-cookie.html", done);
};

// Encoding tests
const testEncoding = (done) => {
  runQunit("../tests/miscellaneous/test-encoding.html", done);
};

// Request context storage test
const testRequestContextStorage = (done) => {
  runQunit("../tests/miscellaneous/test-request-context-storage.html", done);
};

// Filter rules builder test
const testFilterRuleBuilder = (done) => {
  runQunit("../tests/miscellaneous/test-filter-rule-builder.html", done);
};

// Stats collection test
const testStatsCollection = (done) => {
  runQunit("../tests/stats/test-stats.html", done);
};

// Document filter
const testDocumentFilter = (done) => {
  runQunit("../tests/document-filter/test-document-filter.html", done);
};

// Rules converter
const testConverter = (done) => {
  runQunit("../tests/rule-converter/test-rule-converter.html", done);
};

// Settings provider
const testSettingsProvider = (done) => {
  runQunit("../tests/settings/test-settings.html", done);
};

export default gulp.series(
  testRule,
  testSB,
  testURL,
  testCSSfilter,
  testContent,
  testCookieFiltering,
  testCSShits,
  testReq,
  testEl,
  testCookie,
  testRing,
  testEncoding,
  testRequestContextStorage,
  testFilterRuleBuilder,
  testStatsCollection,
  testDocumentFilter,
  testConverter,
  testSettingsProvider
);
