import regeneratorRuntime from "regenerator-runtime";
import path from "path";
import gulp from "gulp";
import { LOCALES_DIR } from "./consts";

const paths = {
    pages: path.join("src/pages/**/*"),
    libs: path.join("src/lib/libs/**/*"),
    lib_core: path.join("src/lib/core/**/*"),
    lib_content_script: path.join("src/lib/content-script/**/*"),
    lib_filter: path.join("src/lib/filter/**/*"),
    lib_pages: path.join("src/lib/pages/**/*"),
    background_page: path.join("src/lib/background/**/*"),
    lib_tabs: path.join("src/lib/tabs/**/*"),
    lib_utils: path.join("src/lib/utils/**/*"),
    locales: path.join(LOCALES_DIR, "**/*"),
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
                paths.pages,
                paths.background_page,
                ...(exceptLanguages ? [] : [paths.locales]),
            ], { base: "src" }
        )
        .pipe(gulp.dest(pathDest));
};

export default copyCommonFiles;