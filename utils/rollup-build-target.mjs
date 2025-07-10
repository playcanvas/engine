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
import { treeshakeIgnore } from './plugins/rollup-treeshake-ignore.mjs';
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

const TREESHAKE_IGNORE_REGEXES = [
    /polyfill/
];

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

const HISTORY = new Map();

/**
 * @param {'debug'|'release'|'profiler'} buildType - The build type.
 * @param {boolean} isUMD - Whether the build is for UMD.
 * @returns {object} - The JSCC options.
 */
function getJSCCOptions(buildType, isUMD) {
    const options = {
        debug: {
            values: {
                _CURRENT_SDK_VERSION: version,
                _CURRENT_SDK_REVISION: revision,
                _IS_UMD: +isUMD,
                _DEBUG: 1,
                _PROFILER: 1
            },
            asloader: false,
            keepLines: true
        },
        release: {
            values: {
                _CURRENT_SDK_VERSION: version,
                _CURRENT_SDK_REVISION: revision,
                _IS_UMD: +isUMD
            },
            asloader: false
        },
        profiler: {
            values: {
                _CURRENT_SDK_VERSION: version,
                _CURRENT_SDK_REVISION: revision,
                _IS_UMD: +isUMD,
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
 * For faster subsequent builds, the unbundled and release builds are cached in the HISTORY map to
 * be used for bundled and minified builds. They are stored in the HISTORY map with the key:
 * `<debug|release|profiler>-<umd|esm>-<bundled>`.
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

    const prefix = `${OUT_PREFIX[buildType]}`;
    const file = `${prefix}${isUMD ? '.js' : '.mjs'}`;

    const targets = [];

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

    // minify from release build
    if (isMin && HISTORY.has(`release-${moduleFormat}-true`)) {
        const release = HISTORY.get(`release-${moduleFormat}-true`);

        /**
         * @type {RollupOptions}
         */
        const target = {
            input: release.output.file,
            plugins: [
                swcPlugin({ swc: swcOptions(isDebug, isUMD, isMin) })
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
            jscc(getJSCCOptions(isMin ? 'release' : buildType, isUMD)),
            isUMD ? treeshakeIgnore(TREESHAKE_IGNORE_REGEXES) : undefined,
            isUMD ? dynamicImportLegacyBrowserSupport() : undefined,
            !isDebug ? shaderChunks() : undefined,
            isDebug ? engineLayerImportValidation(input) : undefined,
            !isDebug ? strip({ functions: STRIP_FUNCTIONS }) : undefined,
            swcPlugin({ swc: swcOptions(isDebug, isUMD, isMin) }),
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
        plugins: [
            runTsc(`${root}/tsconfig.build.json`),
            typesFixup(root),
            dts()
        ]
    };
}

export { buildJSOptions, buildTypesOption };
