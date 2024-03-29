/**
 * Creates build.txt file with current extension version
 */
import fs from "fs";
import path from "path";
import { BUILD_DIR, BRANCH_RELEASE } from "./consts";
import { version } from "./parse-package";

const updateBuildInfo = (done) => {
    const filename = "build.txt";
    const content = `version=${version}`;
    const pathname = path.join(BUILD_DIR + '/' + BRANCH_RELEASE, filename);
    fs.writeFileSync(pathname, content);
    done();
};

export default updateBuildInfo;