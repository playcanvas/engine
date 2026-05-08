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
    dbg: ' (DEBUG)',
    std: ' (RELEASE)',
    prf: ' (PROFILE)',
    min: ' (RELEASE)'
};

const OUT_PREFIX = {
    dbg: 'playcanvas.dbg',
    std: 'playcanvas',
    prf: 'playcanvas.prf',
    min: 'playcanvas.min'
};

const HISTORY = new Map();

/**
 * @param {'dbg'|'std'|'prf'} buildType - The build type.
 * @returns {object} - The JSCC options.
 */
function getJSCCOptions(buildType) {
    const options = {
        dbg: {
            values: {
                _CURRENT_SDK_VERSION: version,
                _CURRENT_SDK_REVISION: revision,
                _DEBUG: 1,
                _PROFILER: 1
            },
            asloader: false,
            keepLines: true
        },
        std: {
            values: {
                _CURRENT_SDK_VERSION: version,
                _CURRENT_SDK_REVISION: revision
            },
            asloader: false
        },
        prf: {
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
 * Build rollup options for JS (bundled and unbundled).
 *
 * For faster subsequent builds, the unbundled and std builds are cached in the HISTORY map to
 * be used for bundled and minified builds. They are stored in the HISTORY map with the key:
 * `<dbg|std|prf>-<umd|esm>-<bundled>`.
 *
 * @param {object} options - The build target options.
 * @param {'umd'|'esm'} options.moduleFormat - The module format.
 * @param {'dbg'|'std'|'prf'|'min'} options.buildType - The build type.
 * @param {'unbundled'|'bundled'} [options.bundleState] - The bundle state.
 * @param {'std'|null} [options.bundleSource] - The generated input source.
 * @param {string} [options.input] - Only used for examples to change it to `../src/index.js`.
 * @param {string} [options.dir] - Only used for examples to change the output location.
 * @returns {RollupOptions[]} Rollup targets.
 */
function buildJSOptions({
    moduleFormat,
    buildType,
    bundleState,
    bundleSource = null,
    input = 'src/index.js',
    dir = 'build'
}) {
    const isUMD = moduleFormat === 'umd';
    const isDebug = buildType === 'dbg';
    const isMin = buildType === 'min';
    const bundled = isUMD || isMin || bundleState === 'bundled';

    const prefix = `${OUT_PREFIX[buildType]}`;
    const file = `${prefix}${isUMD ? '.js' : '.mjs'}`;

    const targets = [];

    // minify from the generated std bundle in a separate turbo task.
    if (isMin && bundleSource === 'std') {
        /**
         * @type {RollupOptions}
         */
        const target = {
            input: `${dir}/${OUT_PREFIX.std}${isUMD ? '.js' : '.mjs'}`,
            plugins: [
                swcPlugin({ swc: swcOptions(isDebug, isMin) })
            ],
            output: {
                banner: isUMD ? getBanner(BANNER[buildType]) : undefined,
                file: `${dir}/${file}`
            },
            context: isUMD ? 'this' : undefined
        };

        HISTORY.set(`${buildType}-${moduleFormat}-${bundled}`, target);
        targets.push(target);

        return targets;
    }

    // bundle from unbundled
    if (bundled && HISTORY.has(`${buildType}-${moduleFormat}-false`)) {
        const unbundled = HISTORY.get(`${buildType}-${moduleFormat}-false`);

        /**
         * @type {RollupOptions}
         */
        const target = {
            input: `${unbundled.output.dir}/src/index.js`,
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

        HISTORY.set(`${buildType}-${moduleFormat}-true`, target);
        targets.push(target);

        return targets;
    }

    // minify from std build
    if (isMin && HISTORY.has(`std-${moduleFormat}-true`)) {
        const std = HISTORY.get(`std-${moduleFormat}-true`);

        /**
         * @type {RollupOptions}
         */
        const target = {
            input: std.output.file,
            plugins: [
                swcPlugin({ swc: swcOptions(isDebug, isMin) })
            ],
            output: {
                banner: isUMD ? getBanner(BANNER[buildType]) : undefined,
                file: `${dir}/${file}`
            },
            context: isUMD ? 'this' : undefined
        };

        HISTORY.set(`${buildType}-${moduleFormat}-${bundled}`, target);
        targets.push(target);

        return targets;
    }

    /**
     * @type {RollupOptions}
     */
    const target = {
        input,
        output: {
            banner: bundled ? getBanner(BANNER[buildType]) : undefined,
            plugins: buildType === 'std' ? getOutPlugins(isUMD ? 'umd' : 'es') : undefined,
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
            jscc(getJSCCOptions(isMin ? 'std' : buildType)),
            isUMD ? dynamicImportLegacyBrowserSupport() : undefined,
            !isDebug ? shaderChunks() : undefined,
            isDebug ? engineLayerImportValidation(input) : undefined,
            !isDebug ? strip({ functions: STRIP_FUNCTIONS }) : undefined,
            swcPlugin({ swc: swcOptions(isDebug, isMin) }),
            !isUMD ? dynamicImportBundlerSuppress() : undefined,
            !isDebug ? spacesToTabs() : undefined
        ]
    };

    HISTORY.set(`${buildType}-${moduleFormat}-${bundled}`, target);
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

export { buildJSOptions, buildTypesOption };
