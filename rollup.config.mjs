import { buildJSOptions, buildTypesOption } from './utils/rollup-build-target.mjs';

/** @import { RollupOptions } from 'rollup' */

const RED_OUT = '\x1b[31m';
const BOLD_OUT = '\x1b[1m';
const RESET_OUT = '\x1b[0m';

const BUILD_TYPES = /** @type {const} */ (['rel', 'dbg', 'prf', 'min']);
const MODULE_FORMAT = /** @type {const} */ (['umd', 'esm']);
const BUNDLE_STATES = /** @type {const} */ (['unbundled', 'bundled']);

const envBuild = process.env.build ? process.env.build.toLowerCase() : null;
const bundleSource = process.env.bundleSource ? process.env.bundleSource.toLowerCase() : null;

function includeBuild(buildType, moduleFormat, bundleState) {
    return envBuild === null ||
        envBuild === buildType ||
        envBuild === moduleFormat ||
        envBuild === bundleState ||
        envBuild === `${moduleFormat}:${buildType}` ||
        envBuild === `${moduleFormat}:${bundleState}` ||
        envBuild === `${buildType}:${bundleState}` ||
        envBuild === `${moduleFormat}:${buildType}:${bundleState}`;
}

/**
 * @type {RollupOptions[]}
 */
const targets = [];
BUILD_TYPES.forEach((buildType) => {
    MODULE_FORMAT.forEach((moduleFormat) => {
        BUNDLE_STATES.forEach((bundleState) => {
            if (bundleState === 'unbundled' && moduleFormat === 'umd') {
                return;
            }
            if (bundleState === 'unbundled' && buildType === 'min') {
                return;
            }

            if (!includeBuild(buildType, moduleFormat, bundleState)) {
                return;
            }

            targets.push(...buildJSOptions({
                moduleFormat,
                buildType,
                bundleState,
                bundleSource
            }));
        });
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
