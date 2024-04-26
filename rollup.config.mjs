import * as fs from 'node:fs';
import { version, revision } from './utils/rollup-version-revision.mjs';
import { buildTarget } from './utils/rollup-build-target.mjs';

// unofficial package plugins
import dts from 'rollup-plugin-dts';

// custom plugins
import { runTsc } from './utils/plugins/rollup-run-tsc.mjs';
import { typesFixup } from './utils/plugins/rollup-types-fixup.mjs';

/** @typedef {import('rollup').RollupOptions} RollupOptions */

const MAG_OUT = '\x1b[35m';
const BOLD_OUT = `\x1b[1m`;
const REGULAR_OUT = `\x1b[22m`;

/**
 * @type {['release', 'debug', 'profiler', 'min']}
 */
const BUILD_TYPES = ['release', 'debug', 'profiler', 'min'];

/**
 * @type {['umd', 'esm']}
 */
const MODULE_FORMAT = ['umd', 'esm'];

/**
 * @type {['unbundled', 'bundled']}
 */
const BUNDLE_STATES = ['unbundled', 'bundled'];

/**
 * @type {RollupOptions[]}
 */
const TYPES_TARGET = [{
    input: 'build/playcanvas/index.d.ts',
    output: [{
        file: 'build/playcanvas.d.ts',
        footer: 'export as namespace pc;\nexport as namespace pcx;',
        format: 'es'
    }],
    plugins: [
        runTsc('tsconfig.build.json'),
        typesFixup(),
        dts()
    ]
}];


const envTarget = process.env.target ? process.env.target.toLowerCase() : null;

const title = [
    `engine ${BOLD_OUT}v${version}${REGULAR_OUT}`,
    `revision ${BOLD_OUT}${revision}${REGULAR_OUT}`,
    `target ${BOLD_OUT}${envTarget ?? 'all'}${REGULAR_OUT}`
].join('\n');
console.log(`${MAG_OUT}${title}`);

if (envTarget === null && fs.existsSync('build')) {
    // no targets specified, clean build directory
    fs.rmSync('build', { recursive: true });
}

function includeBuild(buildType, moduleFormat, bundleState) {
    return envTarget === null ||
        envTarget === buildType ||
        envTarget === moduleFormat ||
        envTarget === bundleState ||
        envTarget === `${moduleFormat}:${buildType}` ||
        envTarget === `${moduleFormat}:${bundleState}` ||
        envTarget === `${buildType}:${bundleState}` ||
        envTarget === `${moduleFormat}:${buildType}:${bundleState}`;
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

            targets.push(...buildTarget({
                moduleFormat,
                buildType,
                bundleState
            }));
        });
    });
});

if (envTarget === null || envTarget === 'types') {
    targets.push(...TYPES_TARGET);
}

if (!targets.length) {
    console.error('No targets found');
    process.exit(1);
}

export default targets;
