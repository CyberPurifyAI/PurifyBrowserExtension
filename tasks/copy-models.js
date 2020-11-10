import path from "path";
import gulp from "gulp";

const paths = {
  models: path.join("filters/models/**/*"),
};

/**
 * Copy common files into `pathDest` directory.
 * `base` param is for saving copying folders structure
 *
 * @param pathDest   destination folder
 * @return stream
 */
const copyModelFiles = (pathDest) => {
  return gulp
    .src(
      [
        paths.models,
      ],
      { base: "filters" }
    )
    .pipe(gulp.dest(pathDest));
};

export default copyModelFiles;
