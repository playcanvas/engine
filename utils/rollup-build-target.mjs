// official package plugins
import resolve from '@rollup/plugin-node-resolve';
import strip from '@rollup/plugin-strip';
import swcPlugin from '@rollup/plugin-swc';

// unofficial package plugins
import dts from 'rollup-plugin-dts';
import jscc from 'rollup-plugin-jscc';
import { visualizer } from 'rollup-plugin-visualizer';

// custom plugins
import { shaderChunks } from './plugins/rollup-shader-chunks.mjs';
import { engineLayerImportValidation } from './plugins/rollup-import-validation.mjs';
import { spacesToTabs } from './plugins/rollup-spaces-to-tabs.mjs';
import { dynamicImportLegacyBrowserSupport, dynamicImportBundlerSuppress } from './plugins/rollup-dynamic.mjs';
import { runTsc } from './plugins/rollup-run-tsc.mjs';
import { typesFixup } from './plugins/rollup-types-fixup.mjs';

import { version, revision } from './rollup-version-revision.mjs';
import { getBanner } from './rollup-get-banner.mjs';
import { swcOptions } from './rollup-swc-options.mjs';

import { dirname, resolve as pathResolve } from 'path';
import { fileURLToPath } from 'url';

/** @import { RollupOptions, OutputOptions } from 'rollup' */

// Find path to the repo root
// @ts-ignore import.meta not allowed by tsconfig module:es6, but it works
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = pathResolve(__dirname, '..');


const STRIP_FUNCTIONS = [
    'Debug.assert',
    'Debug.assertDeprecated',
    'Debug.assertDestroyed',
    'Debug.call',
    'Debug.deprecated',
    'Debug.warn',
    'Debug.warnOnce',
    'Debug.error',
    'Debug.errorOnce',
    'Debug.log',
    'Debug.logOnce',
    'Debug.removed',
    'Debug.trace',
    'DebugHelper.setName',
    'DebugHelper.setLabel',
    'DebugHelper.setDestroyed',
    'DebugGraphics.toString',
    'DebugGraphics.clearGpuMarkers',
    'DebugGraphics.pushGpuMarker',
    'DebugGraphics.popGpuMarker',
    'WebgpuDebug.validate',
    'WebgpuDebug.memory',
    'WebgpuDebug.internal',
    'WebgpuDebug.end',
    'WebgpuDebug.endShader',
    'WorldClustersDebug.render'
];

const BANNER = {
    debug: ' (DEBUG)',
    release: ' (RELEASE)',
    profiler: ' (PROFILE)',
    min: ' (RELEASE)'
};

const OUT_PREFIX = {
    debug: 'playcanvas.dbg',
    release: 'playcanvas',
    profiler: 'playcanvas.prf',
    min: 'playcanvas.min'
};

/**
 * @param {'debug'|'release'|'profiler'} buildType - The build type.
 * @returns {object} - The JSCC options.
 */
function getJSCCOptions(buildType) {
    const options = {
        debug: {
            values: {
                _CURRENT_SDK_VERSION: version,
                _CURRENT_SDK_REVISION: revision,
                _DEBUG: 1,
                _PROFILER: 1
            },
            asloader: false,
            keepLines: true
        },
        release: {
            values: {
                _CURRENT_SDK_VERSION: version,
                _CURRENT_SDK_REVISION: revision
            },
            asloader: false
        },
        profiler: {
            values: {
                _CURRENT_SDK_VERSION: version,
                _CURRENT_SDK_REVISION: revision,
                _PROFILER: 1
            },
            asloader: false
        }
    };
    return options[buildType];
}

/**
 * @param {string} type - The type of the output (e.g., 'umd', 'es').
 * @returns {OutputOptions['plugins']} - The output plugins.
 */
function getOutPlugins(type) {
    const plugins = [];

    if (process.env.treemap) {
        plugins.push(visualizer({
            filename: `treemap.${type}.html`,
            brotliSize: true,
            gzipSize: true
        }));
    }

    if (process.env.treenet) {
        plugins.push(visualizer({
            filename: `treenet.${type}.html`,
            template: 'network'
        }));
    }

    if (process.env.treesun) {
        plugins.push(visualizer({
            filename: `treesun.${type}.html`,
            template: 'sunburst'
        }));
    }

    if (process.env.treeflame) {
        plugins.push(visualizer({
            filename: `treeflame.${type}.html`,
            template: 'flamegraph'
        }));
    }

    return plugins;
}

/**
 * Get the output path for a given build configuration.
 * This allows parallel builds to reference each other's outputs by computed paths
 * rather than relying on a shared HISTORY map.
 *
 * @param {'debug'|'release'|'profiler'|'min'} buildType - The build type.
 * @param {'umd'|'esm'} moduleFormat - The module format.
 * @param {boolean} bundled - Whether bundled.
 * @param {string} dir - The output directory.
 * @returns {{ file?: string, dir?: string }} The output paths.
 */
function getOutputPaths(buildType, moduleFormat, bundled, dir = 'build') {
    const isUMD = moduleFormat === 'umd';
    const prefix = OUT_PREFIX[buildType];

    if (bundled || isUMD) {
        return {
            file: `${dir}/${prefix}${isUMD ? '.js' : '.mjs'}`
        };
    }
    return {
        dir: `${dir}/${prefix}`
    };
}

/**
 * Build rollup options for JS (bundled and unbundled).
 *
 * The build system supports parallel execution by computing input paths directly
 * rather than relying on a shared state map. Dependencies between builds are:
 * - ESM bundled depends on ESM unbundled (uses unbundled output as input)
 * - Minified depends on release bundled (uses release output as input)
 *
 * @param {object} options - The build target options.
 * @param {'umd'|'esm'} options.moduleFormat - The module format.
 * @param {'debug'|'release'|'profiler'|'min'} options.buildType - The build type.
 * @param {'unbundled'|'bundled'} [options.bundleState] - The bundle state.
 * @param {string} [options.input] - Only used for examples to change it to `../src/index.js`.
 * @param {string} [options.dir] - Only used for examples to change the output location.
 * @returns {RollupOptions[]} Rollup targets.
 */
function buildJSOptions({
    moduleFormat,
    buildType,
    bundleState,
    input = 'src/index.js',
    dir = 'build'
}) {
    const isUMD = moduleFormat === 'umd';
    const isDebug = buildType === 'debug';
    const isMin = buildType === 'min';
    const bundled = isUMD || isMin || bundleState === 'bundled';

    const prefix = OUT_PREFIX[buildType];
    const file = `${prefix}${isUMD ? '.js' : '.mjs'}`;

    const targets = [];

    // ESM bundled: bundle from unbundled output
    if (!isUMD && !isMin && bundleState === 'bundled') {
        // Compute the unbundled output path directly
        const unbundledDir = getOutputPaths(buildType, moduleFormat, false, dir).dir;

        /** @type {RollupOptions} */
        const target = {
            input: `${unbundledDir}/src/index.js`,
            output: {
                banner: getBanner(BANNER[buildType]),
                format: 'es',
                indent: '\t',
                sourcemap: isDebug && 'inline',
                name: 'pc',
                preserveModules: false,
                file: `${dir}/${prefix}.mjs`
            }
        };

        targets.push(target);
        return targets;
    }

    // Minified: minify from release build
    if (isMin) {
        // Compute the release output path directly
        const releaseOutput = getOutputPaths('release', moduleFormat, true, dir);

        /** @type {RollupOptions} */
        const target = {
            input: releaseOutput.file,
            plugins: [
                swcPlugin({ swc: swcOptions(false, true) })
            ],
            output: {
                banner: isUMD ? getBanner(BANNER[buildType]) : undefined,
                file: `${dir}/${file}`
            },
            context: isUMD ? 'this' : undefined
        };

        targets.push(target);
        return targets;
    }

    // Primary build from source
    /** @type {RollupOptions} */
    const target = {
        input,
        output: {
            banner: bundled ? getBanner(BANNER[buildType]) : undefined,
            plugins: buildType === 'release' ? getOutPlugins(isUMD ? 'umd' : 'es') : undefined,
            format: isUMD ? 'umd' : 'es',
            indent: '\t',
            sourcemap: bundled && isDebug && 'inline',
            name: 'pc',
            preserveModules: !bundled,
            preserveModulesRoot: !bundled ? rootDir : undefined,
            file: bundled ? `${dir}/${file}` : undefined,
            dir: !bundled ? `${dir}/${prefix}` : undefined,
            entryFileNames: chunkInfo => `${chunkInfo.name.replace(/node_modules/g, 'modules')}.js`
        },
        plugins: [
            resolve(),
            jscc(getJSCCOptions(isMin ? 'release' : buildType)),
            isUMD ? dynamicImportLegacyBrowserSupport() : undefined,
            !isDebug ? shaderChunks() : undefined,
            isDebug ? engineLayerImportValidation(input) : undefined,
            !isDebug ? strip({ functions: STRIP_FUNCTIONS }) : undefined,
            swcPlugin({ swc: swcOptions(isDebug, false) }),
            !isUMD ? dynamicImportBundlerSuppress() : undefined,
            !isDebug ? spacesToTabs() : undefined
        ]
    };

    targets.push(target);
    return targets;
}

/**
 * Build rollup options for TypeScript definitions.
 *
 * @param {object} options - The build target options.
 * @param {string} [options.root] - The root directory for finding the TypeScript definitions.
 * @param {string} [options.dir] - The output directory for the TypeScript definitions.
 * @returns {RollupOptions} Rollup targets.
 */
function buildTypesOption({
    root = '.',
    dir = 'build'
} = {}) {
    return {
        input: `${root}/build/playcanvas/src/index.d.ts`,
        output: [{
            file: `${dir}/playcanvas.d.ts`,
            footer: 'export as namespace pc;\nexport as namespace pcx;',
            format: 'es'
        }],
        watch: {
            include: `${root}/src/**`
        },
        plugins: [
            runTsc(`${root}/tsconfig.build.json`),
            typesFixup(root),
            dts()
        ]
    };
}

export { buildJSOptions, buildTypesOption, getOutputPaths };
