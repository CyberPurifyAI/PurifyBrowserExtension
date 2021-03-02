import gulp from "gulp";
const javascriptObfuscator = require("gulp-javascript-obfuscator");

const secret_paths = ["src/lib/filter/purify-filtering.js", "src/lib/core/*.js"];

/**
 * obfuscator files into `pathDest` directory.
 * `base` param is for saving copying folders structure
 *
 * @param pathDest   destination folder
 * @return stream
 */
const obfuscatorFiles = (pathDest) => {
  return gulp
    .src(secret_paths, { base: "src" })
    .pipe(
      javascriptObfuscator({
        compact: true,
        // controlFlowFlattening: false,
        // deadCodeInjection: false,
        // debugProtection: false,
        // debugProtectionInterval: false,
        // disableConsoleOutput: false,
        // identifierNamesGenerator: 'hexadecimal',
        // log: false,
        // numbersToExpressions: false,
        // renameGlobals: false,
        // rotateStringArray: true,
        // selfDefending: false,
        // shuffleStringArray: true,
        // simplify: true,
        // splitStrings: false,
        // stringArray: true,
        // stringArrayEncoding: [],
        // stringArrayIndexShift: true,
        // stringArrayWrappersCount: 1,
        // stringArrayWrappersChainedCalls: true,
        // stringArrayWrappersParametersMaxCount: 2,
        // stringArrayWrappersType: 'variable',
        // stringArrayThreshold: 0.75,
        unicodeEscapeSequence: true
    })
    )
    .pipe(gulp.dest(pathDest));
};

export default obfuscatorFiles;
