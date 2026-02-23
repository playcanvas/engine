/**
 * Build helper script using esbuild for JS targets and Rollup for types.
 * Usage: node build.mjs [options]
 *
 * Options:
 * target[:<moduleFormat>][:<buildType>][:<bundleState>] - Specify the target
 *     - moduleFormat (esm, umd)
 *     - buildType (release, debug, profiler, min)
 *     - bundleState (unbundled, bundled)
 * Example: target:esm:release:bundled
 *
 * -w / --watch - Enable watch mode (rebuilds on file changes).
 */

import fs from 'fs';
import { buildTarget, OUT_PREFIX } from './utils/esbuild-build-target.mjs';
import { version, revision } from './utils/rollup-version-revision.mjs';
import { buildTypesOption } from './utils/rollup-build-target.mjs';

const CYAN_OUT = '\x1b[36m';
const BLUE_OUT = '\x1b[34m';
const GREEN_OUT = '\x1b[32m';
const RED_OUT = '\x1b[31m';
const BOLD_OUT = '\x1b[1m';
const REGULAR_OUT = '\x1b[22m';
const RESET_OUT = '\x1b[0m';

const BUILD_TYPES = ['release', 'debug', 'profiler', 'min'];
const MODULE_FORMAT = ['umd', 'esm'];
const BUNDLE_STATES = ['unbundled', 'bundled'];

const args = process.argv.slice(2);

// Extract target and flags
let envTarget = null;
let watchMode = false;
for (const arg of args) {
    if (arg.startsWith('target')) {
        const parts = arg.split(':');
        envTarget = parts.slice(1).join(':').toLowerCase() || null;
    }
    if (arg === '-w' || arg === '--watch') {
        watchMode = true;
    }
}

const title = [
    'Building PlayCanvas Engine',
    `version ${BOLD_OUT}v${version}${REGULAR_OUT}`,
    `revision ${BOLD_OUT}${revision}${REGULAR_OUT}`,
    `target ${BOLD_OUT}${envTarget ?? 'all'}${REGULAR_OUT}`
].join('\n');
console.log(`${BLUE_OUT}${title}${RESET_OUT}`);

if (envTarget === null && fs.existsSync('build')) {
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

// Collect JS build targets
const jsTargets = [];
BUILD_TYPES.forEach((buildType) => {
    MODULE_FORMAT.forEach((moduleFormat) => {
        BUNDLE_STATES.forEach((bundleState) => {
            if (bundleState === 'unbundled' && moduleFormat === 'umd') return;
            if (bundleState === 'unbundled' && buildType === 'min') return;
            if (!includeBuild(buildType, moduleFormat, bundleState)) return;

            jsTargets.push({ moduleFormat, buildType, bundleState });
        });
    });
});

const buildTypes = envTarget === null || envTarget === 'types';

if (!jsTargets.length && !buildTypes) {
    console.error(`${RED_OUT}${BOLD_OUT}No targets found${RESET_OUT}`);
    process.exit(1);
}

/**
 * Get the output path description for a build target (matches Rollup's display).
 *
 * @param {object} target - The build target.
 * @returns {string} The output path.
 */
function getOutputPath(target) {
    const prefix = OUT_PREFIX[target.buildType];
    const isUMD = target.moduleFormat === 'umd';
    const bundled = isUMD || target.buildType === 'min' || target.bundleState === 'bundled';
    if (bundled) {
        return `build/${prefix}${isUMD ? '.js' : '.mjs'}`;
    }
    return `build/${prefix}/`;
}

/**
 * Build all JS targets using esbuild.
 */
async function buildAllJS() {
    await Promise.all(jsTargets.map(async (target) => {
        const output = getOutputPath(target);
        console.log(`${CYAN_OUT}${BOLD_OUT}src/index.js${REGULAR_OUT} \u2192 ${BOLD_OUT}${output}${REGULAR_OUT}...${RESET_OUT}`);
        const buildStart = performance.now();
        try {
            await buildTarget(target);
            const elapsed = ((performance.now() - buildStart) / 1000).toFixed(1);
            console.log(`${GREEN_OUT}created ${BOLD_OUT}${output}${REGULAR_OUT} in ${BOLD_OUT}${elapsed}s${REGULAR_OUT}${RESET_OUT}`);
        } catch (err) {
            console.error(`${RED_OUT}${BOLD_OUT}error building ${output}${REGULAR_OUT}: ${err.message}${RESET_OUT}`);
            throw err;
        }
    }));
}

/**
 * Build TypeScript definitions using Rollup + rollup-plugin-dts.
 */
async function buildAllTypes() {
    const typesOutput = 'build/playcanvas.d.ts';
    console.log(`${CYAN_OUT}${BOLD_OUT}src/index.js${REGULAR_OUT} \u2192 ${BOLD_OUT}${typesOutput}${REGULAR_OUT}...${RESET_OUT}`);
    const startTime = performance.now();

    const { rollup } = await import('rollup');
    const typesConfig = buildTypesOption();

    const bundle = await rollup({
        input: typesConfig.input,
        plugins: typesConfig.plugins
    });

    const outputOptions = Array.isArray(typesConfig.output) ? typesConfig.output : [typesConfig.output];
    await Promise.all(outputOptions.map(output => bundle.write(output)));
    await bundle.close();

    const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
    console.log(`${GREEN_OUT}created ${BOLD_OUT}${typesOutput}${REGULAR_OUT} in ${BOLD_OUT}${elapsed}s${REGULAR_OUT}${RESET_OUT}`);
}

// Main execution
async function main() {
    try {
        if (jsTargets.length) {
            await buildAllJS();
        }

        if (buildTypes) {
            await buildAllTypes();
        }

        if (watchMode) {
            console.log(`${BLUE_OUT}Watching for changes...${RESET_OUT}`);
            let debounceTimer = null;

            fs.watch('src', { recursive: true }, (eventType, filename) => {
                if (!filename?.endsWith('.js')) return;
                if (debounceTimer) clearTimeout(debounceTimer);
                debounceTimer = setTimeout(async () => {
                    console.log(`\n${BLUE_OUT}Change detected: ${filename}${RESET_OUT}`);
                    try {
                        if (jsTargets.length) await buildAllJS();
                        if (buildTypes) await buildAllTypes();
                    } catch (e) {
                        console.error(e.message);
                    }
                }, 100);
            });
        }
    } catch (e) {
        console.error(e.message);
        if (!watchMode) process.exit(1);
    }
}

main();
