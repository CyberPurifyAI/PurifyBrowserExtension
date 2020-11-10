import path from "path";
import gulp from "gulp";
import { LOCALES_DIR } from "./consts";
const javascriptObfuscator = require("gulp-javascript-obfuscator");

const paths = {
  pages: path.join("Extension/pages/**/*"),
  libs: path.join("Extension/lib/libs/**/*"),
  lib_core: path.join("Extension/lib/core/**/*"),
  lib_content_script: path.join("Extension/lib/content-script/**/*"),
  lib_filter: path.join("Extension/lib/filter/**/*"),
  lib_pages: path.join("Extension/lib/pages/**/*"),
  lib_tabs: path.join("Extension/lib/tabs/**/*"),
  lib_utils: path.join("Extension/lib/utils/**/*"),
  locales: path.join(LOCALES_DIR, "**/*"),
  models: path.join("Extension/models/**/*"),
};

/**
 * Copy common files into `pathDest` directory.
 * `base` param is for saving copying folders structure
 *
 * @param pathDest   destination folder
 * @param {Boolean} exceptLanguages   do not copy languages if true
 * @return stream
 */
const copyCommonFiles = (pathDest, exceptLanguages) => {
  return gulp
    .src(
      [
        paths.lib_core,
        paths.lib_tabs,
        paths.lib_pages,
        paths.lib_utils,
        paths.libs,
        paths.lib_filter,
        paths.lib_content_script,
        paths.pages,
        paths.models,
        ...(exceptLanguages ? [] : [paths.locales]),
      ],
      { base: "Extension" }
    )
    .pipe(gulp.dest(pathDest));
};

export default copyCommonFiles;
