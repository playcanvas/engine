import { buildJSOptions, buildTypesOption } from './utils/rollup-build-target.mjs';

/** @import { RollupOptions } from 'rollup' */

const RED_OUT = '\x1b[31m';
const BOLD_OUT = '\x1b[1m';
const RESET_OUT = '\x1b[0m';

const BUILD_TYPES = /** @type {const} */ (['rel', 'dbg', 'prf', 'min']);
const MODULE_FORMATS = /** @type {const} */ (['umd', 'esm']);

const envBuild = process.env.build ? process.env.build.toLowerCase() : null;

function includeBuild(buildType, moduleFormat) {
    return envBuild === null ||
        envBuild === buildType ||
        envBuild === moduleFormat ||
        envBuild === `${moduleFormat}:${buildType}`;
}

/**
 * @type {RollupOptions[]}
 */
const targets = [];
BUILD_TYPES.forEach((buildType) => {
    MODULE_FORMATS.forEach((moduleFormat) => {
        if (!includeBuild(buildType, moduleFormat)) {
            return;
        }

        targets.push(...buildJSOptions({
            moduleFormat,
            buildType
        }));
    });
});

if (envBuild === null || envBuild === 'types') {
    targets.push(buildTypesOption());
}

if (!targets.length) {
    console.error(`${RED_OUT}${BOLD_OUT}No targets found${RESET_OUT}`);
    process.exit(1);
}

export default targets;
