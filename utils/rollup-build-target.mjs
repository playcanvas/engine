// official package plugins
import { babel } from '@rollup/plugin-babel';
import resolve from '@rollup/plugin-node-resolve';
import strip from '@rollup/plugin-strip';
import terser from '@rollup/plugin-terser';

// unoffical package plugins
import jscc from 'rollup-plugin-jscc';
import { visualizer } from 'rollup-plugin-visualizer';

// custom plugins
import { shaderChunks } from './plugins/rollup-shader-chunks.mjs';
import { engineLayerImportValidation } from './plugins/rollup-import-validation.mjs';
import { spacesToTabs } from './plugins/rollup-spaces-to-tabs.mjs';
import { dynamicImportLegacyBrowserSupport, dynamicImportBundlerSuppress } from './plugins/rollup-dynamic.mjs';
import { treeshakeIgnore } from './plugins/rollup-treeshake-ignore.mjs';

import { version, revision } from './rollup-version-revision.mjs';
import { getBanner } from './rollup-get-banner.mjs';
import { babelOptions } from './rollup-babel-options.mjs';

/** @typedef {import('rollup').RollupOptions} RollupOptions */
/** @typedef {import('rollup').OutputOptions} OutputOptions */
/** @typedef {import('rollup').ModuleFormat} ModuleFormat */
/** @typedef {import('@rollup/plugin-strip').RollupStripOptions} RollupStripOptions */

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
    'Debug.trace',
    'DebugHelper.setName',
    'DebugHelper.setLabel',
    `DebugHelper.setDestroyed`,
    'DebugGraphics.toString',
    'DebugGraphics.clearGpuMarkers',
    'DebugGraphics.pushGpuMarker',
    'DebugGraphics.popGpuMarker',
    'WebgpuDebug.validate',
    'WebgpuDebug.memory',
    'WebgpuDebug.internal',
    'WebgpuDebug.end',
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
 * @returns {OutputOptions['plugins']} - The output plugins.
 */
function getOutPlugins() {
    const plugins = [
        terser()
    ];

    if (process.env.treemap) {
        plugins.push(visualizer({
            filename: 'treemap.html',
            brotliSize: true,
            gzipSize: true
        }));
    }

    if (process.env.treenet) {
        plugins.push(visualizer({
            filename: 'treenet.html',
            template: 'network'
        }));
    }

    if (process.env.treesun) {
        plugins.push(visualizer({
            filename: 'treesun.html',
            template: 'sunburst'
        }));
    }

    return plugins;
}

/**
 * Build a target that Rollup is supposed to build (bundled and unbundled).
 *
 * @param {object} options - The build target options.
 * @param {'umd'|'esm'} options.moduleFormat - The module format.
 * @param {'debug'|'release'|'profiler'|'min'} options.buildType - The build type.
 * @param {'unbundled'|'bundled'} [options.bundleState] - The bundle state.
 * @param {string} [options.input] - Only used for examples to change it to `../src/index.js`.
 * @param {string} [options.dir] - Only used for examples to change the output location.
 * @returns {RollupOptions[]} Rollup targets.
 */
function buildTarget({ moduleFormat, buildType, bundleState, input = 'src/index.js', dir = 'build' }) {
    const isUMD = moduleFormat === 'umd';
    const isDebug = buildType === 'debug';
    const isMin = buildType === 'min';
    const bundled = isUMD || isMin || bundleState === 'bundled';

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
                file: `${dir}/${OUT_PREFIX[buildType]}.mjs`
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
            output: {
                plugins: getOutPlugins(),
                file: `${dir}/${OUT_PREFIX[buildType]}${isUMD ? '.js' : '.mjs'}`
            },
            context: isUMD ? "this" : undefined
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
            plugins: isMin ? getOutPlugins() : undefined,
            format: isUMD ? 'umd' : 'es',
            indent: '\t',
            sourcemap: bundled && isDebug && 'inline',
            name: 'pc',
            preserveModules: !bundled,
            file: bundled ? `${dir}/${OUT_PREFIX[buildType]}${isUMD ? '.js' : '.mjs'}` : undefined,
            dir: !bundled ? `${dir}/${OUT_PREFIX[buildType]}` : undefined,
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
            babel(babelOptions(isDebug, isUMD)),
            !isUMD ? dynamicImportBundlerSuppress() : undefined,
            !isDebug ? spacesToTabs() : undefined
        ]
    };

    HISTORY.set(`${buildType}-${moduleFormat}-${bundled}`, target);
    targets.push(target);

    return targets;
}

export { buildTarget };
