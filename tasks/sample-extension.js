/**
 * Build sample-extension with the CyberPurify API, which can be included to another extension.
 * 1. Copying assistant scripts
 * 2. Copying sample-extension directory
 * 3. Concat scripts from `document_start` and `document_end` params getting from manifest.json
 * 4. Concat all scripts from `API_SCRIPTS` files and save in 'purify-api.js'
 * 5. Copying filters files
 * 6. Updating version of an extension in manifest
 * 7. Creating zip archive of an extension
 */

import fs from "fs";
import path from "path";
import gulp from "gulp";
import concatFiles from "gulp-concat";
import zip from "gulp-zip";
import rename from "gulp-rename";
import { BUILD_DIR, LOCALES_DIR, BRANCH_BETA } from "./consts";
import { version } from "./parse-package";

const API_SCRIPTS = [
  // Third party libraries
  "src/lib/libs/deferred.js",
  "src/lib/libs/sha256.js",
  "src/lib/utils/punycode.js",
  "src/lib/libs/filter-downloader.js",
  "src/lib/libs/crypto-js/core.js",
  "src/lib/libs/crypto-js/md5.js",
  "src/lib/filter/rules/scriptlets/redirects.js",
  "src/lib/filter/rules/scriptlets/scriptlets.js",
  // Purify Global and preExtension/ferences
  "src/lib/core/purify.js",
  "src/browser/webkit/lib/prefs.js",
  // Utils libraries
  "src/lib/utils/common.js",
  "src/lib/utils/log.js",
  "src/lib/utils/public-suffixes.js",
  "src/lib/utils/url.js",
  "src/lib/utils/notifier.js",
  "src/lib/utils/browser-utils.js",
  "src/lib/utils/service-client.js",
  "src/lib/utils/page-stats.js",
  "src/lib/utils/user-settings.js",
  "src/lib/utils/frames.js",
  "src/lib/utils/cookie.js",
  // Local storage and rules storage libraries
  "src/browser/chrome/lib/utils/local-storage.js",
  "src/browser/chrome/lib/utils/rules-storage.js",
  "src/lib/core/storage.js",
  // Chromium api adapter libraries
  "src/browser/chrome/lib/content-script/common-script.js",
  "src/browser/chrome/lib/api/background-page.js",
  // Tabs api library
  "src/browser/chrome/lib/api/tabs.js",
  "src/lib/tabs/tabs-api.js",
  // Rules and filters libraries
  "src/lib/filter/rules/rules.js",
  "src/lib/filter/rules/shortcuts-lookup-table.js",
  "src/lib/filter/rules/domains-lookup-table.js",
  "src/lib/filter/rules/url-filter-lookup-table.js",
  "src/lib/filter/rules/simple-regex.js",
  "src/lib/filter/rules/base-filter-rule.js",
  "src/lib/filter/rules/css-filter-rule.js",
  "src/lib/filter/rules/css-filter.js",
  "src/lib/filter/rules/script-filter-rule.js",
  "src/lib/filter/rules/script-filter.js",
  "src/lib/filter/rules/url-filter-rule.js",
  "src/lib/filter/rules/url-filter.js",
  "src/lib/filter/rules/content-filter-rule.js",
  "src/lib/filter/rules/content-filter.js",
  "src/lib/filter/rules/csp-filter.js",
  "src/lib/filter/rules/cookie-filter.js",
  "src/lib/filter/rules/redirect-filter.js",
  "src/lib/filter/rules/replace-filter.js",
  "src/lib/filter/rules/filter-rule-builder.js",
  "src/lib/filter/rules/scriptlet-rule.js",
  "src/lib/filter/rules/redirect-filter.js",
  "src/lib/filter/rules/composite-rule.js",
  // Filters metadata and filtration modules
  "src/lib/filter/subscription.js",
  "src/lib/filter/update-service.js",
  "src/lib/filter/whitelist.js",
  "src/lib/filter/userrules.js",
  "src/lib/filter/filters.js",
  "src/lib/filter/antibanner.js",
  "src/lib/filter/request-blocking.js",
  "src/lib/filter/cookie-filtering.js",
  "src/lib/filter/request-context-storage.js",
  "src/lib/filter/rule-converter.js",
  // Content messaging
  "src/lib/core/content-message-handler.js",
  "src/lib/core/stealth.js",
  "src/lib/core/webrequest.js",
  "src/api/chrome/lib/api.js",
];

// set current type of build
const BRANCH = process.env.NODE_ENV || "";

const paths = {
  sample: path.join("src/api/sample-extension/**/*"),
  locales: path.join(`${LOCALES_DIR}**/*`),
  sourceManifest: path.join("src/api/chrome/manifest.json"),
  contentScriptsStartFile: path.join("purify/purify-content.js"),
  filters: [
    // path.join("filters/filters/filters_i18n.json"),
    path.join("filters/filters/filters.json"),
  ],
  redirects: [path.join("src/lib/filter/rules/scriptlets/redirects.yml")],
  dest: path.join(BUILD_DIR, BRANCH, "purify-api"),
};

const dest = {
  purify: path.join(paths.dest, "purify"),
  inner: path.join(paths.dest, "**/*"),
  buildDir: path.join(BUILD_DIR, BRANCH),
  manifest: path.join(paths.dest, "manifest.json"),
};

// copy sample files
const sampleApi = () => gulp.src(paths.sample).pipe(gulp.dest(paths.dest));

//  copy filters
const copyFilters = () => gulp.src(paths.filters).pipe(gulp.dest(dest.purify));

// copy redirects sources
const copyRedirects = () =>
  gulp.src(paths.redirects).pipe(gulp.dest(dest.purify));

const apiConcat = () =>
  gulp
    .src(API_SCRIPTS)
    .pipe(concatFiles("purify-api.js"))
    .pipe(gulp.dest(dest.purify));

/**
 * Concat scripts from `document_start` and `document_end` params getting from manifest.json
 * Scripts from 'document_start' param concatenates in purify-content.js script.
 * Scripts from 'document_end' param concatenates in purify-assistant.js script.
 *
 * @param runAt   'document_start' or 'document_start' param
 * @param srcFileName   name of concatenate file to save
 * @return stream
 */
const concat = (runAt, srcFileName) => {
  const manifest = JSON.parse(fs.readFileSync(paths.sourceManifest));
  let files = [];
  // eslint-disable-next-line no-restricted-syntax
  for (const i of manifest.content_scripts) {
    if (i.run_at === runAt) {
      files = i.js;
    }
  }

  files = files.map((file) => {
    if (
      file.indexOf("common-script.js") > 0 ||
      file.indexOf("content-script.js") > 0
    ) {
      return `src/browser/chrome/${file}`;
    }
    return `src/${file}`;
  });

  return gulp
    .src(files)
    .pipe(concatFiles(srcFileName))
    .pipe(gulp.dest(dest.purify));
};

const concatStartFiles = () => concat("document_start", "purify-content.js");

const updateManifest = (done) => {
  const manifest = JSON.parse(fs.readFileSync(dest.manifest));
  manifest.version = version;
  fs.writeFileSync(dest.manifest, JSON.stringify(manifest, null, 4));
  return done();
};

const createArchive = (done) => {
  if (BRANCH !== BRANCH_BETA) {
    return done();
  }

  return (
    gulp
      .src(dest.inner)
      .pipe(zip(`purify-api-${BRANCH}.zip`))
      .pipe(gulp.dest(dest.buildDir))
      // purify-api.zip artifact
      .pipe(rename("purify-api.zip"))
      .pipe(gulp.dest(BUILD_DIR))
  );
};

export default gulp.series(
  sampleApi,
  concatStartFiles,
  apiConcat,
  copyFilters,
  copyRedirects,
  updateManifest,
  createArchive
);
