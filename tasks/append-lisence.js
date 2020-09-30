import path from "path";
import tap from "gulp-tap";

const LICENSE_TEMPLATE =
  "/**\n\
 * ----------------------------------------------------------------------------------\n\
 * PurifyBrowserExtension @FILE_NAME@\n\
 * Licensed under MIT (https://github.com/cyberpurify/CyberPurify/blob/main/LICENSE)\n\
 * ----------------------------------------------------------------------------------\n\
 */\n\n";

const appendLisence = () => {
  return tap((file) => {
    if (
      path.extname(file.path) === ".js" ||
      path.extname(file.path) === ".css"
    ) {
      if (file.contents.toString("utf-8").indexOf("Licensed under MIT") < 0) {
        file.contents = Buffer.concat([
          new Buffer(
            LICENSE_TEMPLATE.replace("@FILE_NAME@", path.basename(file.path))
          ),
          file.contents,
        ]);
      }
    }
  });
};

export default appendLisence;
