// official package plugins
import { babel } from '@rollup/plugin-babel';
import strip from '@rollup/plugin-strip';
import terser from '@rollup/plugin-terser';

// unoffical package plugins
import jscc from 'rollup-plugin-jscc';
import { visualizer } from 'rollup-plugin-visualizer';

// custom plugins
import { shaderChunks } from './plugins/rollup-shader-chunks.mjs';
import { engineLayerImportValidation } from './rollup-import-validation.mjs';
import { spacesToTabs } from './plugins/rollup-spaces-to-tabs.mjs';
import { dynamicImportLegacyBrowserSupport, dynamicImportViteSupress } from './plugins/rollup-dynamic.mjs';

import { version, revision } from './rollup-version-revision.mjs';
import { getBanner } from './rollup-get-banner.mjs';
import { es5Options, moduleOptions } from './rollup-babel-options.mjs';

/** @typedef {import('rollup').RollupOptions} RollupOptions */
/** @typedef {import('rollup').OutputOptions} OutputOptions */
/** @typedef {import('rollup').ModuleFormat} ModuleFormat */
/** @typedef {import('@rollup/plugin-strip').RollupStripOptions} RollupStripOptions */

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
 * @param {'debug'|'release'|'profiler'|'min'} buildType - The build type.
 * @param {boolean} isES5 - Whether the build is for ES5.
 * @returns {object} - The JSCC options.
 */
function getJSCCOptions(buildType, isES5) {
    const options = {
        debug: {
            values: {
                _CURRENT_SDK_VERSION: version,
                _CURRENT_SDK_REVISION: revision,
                _IS_UMD: +isES5,
                _DEBUG: 1,
                _PROFILER: 1
            },
            asloader: true,
            keepLines: true
        },
        release: {
            values: {
                _CURRENT_SDK_VERSION: version,
                _CURRENT_SDK_REVISION: revision,
                _IS_UMD: +isES5
            },
            asloader: true
        },
        profiler: {
            values: {
                _CURRENT_SDK_VERSION: version,
                _CURRENT_SDK_REVISION: revision,
                _IS_UMD: +isES5,
                _PROFILER: 1
            },
            asloader: true
        }
    };
    return options[buildType] || options.release;
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
 * Build a target that rollup is supposed to build (bundled and unbundled).
 *
 * @param {'debug'|'release'|'profiler'|'min'} buildType - The build type.
 * @param {'es5'|'es6'} moduleFormat - The module format.
 * @param {string} input - Only used for Examples to change it to `../src/index.js`.
 * @param {string} [dir] - Only used for examples to change the output location.
 * @returns {RollupOptions[]} One rollup target.
 */
function buildTarget(buildType, moduleFormat, input = 'src/index.js', dir = 'build') {
    const isDebug = buildType === 'debug';
    const isMin = buildType === 'min';
    const isES5 = moduleFormat === 'es5';
    const bundled = isES5 || isMin;

    const targets = [];

    /**
     * @type {RollupOptions}
     */
    const target = {
        input,
        output: {
            banner: bundled ? getBanner(BANNER[buildType]) : undefined,
            plugins: isMin ? getOutPlugins() : undefined,
            format: isES5 ? 'umd' : 'es',
            indent: '\t',
            sourcemap: bundled && isDebug ? 'inline' : undefined,
            name: 'pc',
            preserveModules: !bundled,
            file: bundled ? `${dir}/${OUT_PREFIX[buildType]}${isES5 ? '.js' : '.mjs'}` : undefined,
            dir: bundled ? undefined : `${dir}/${OUT_PREFIX[buildType]}`
        },
        plugins: [
            jscc(getJSCCOptions(buildType, isES5)),
            isES5 ? dynamicImportLegacyBrowserSupport() : undefined,
            !isDebug ? shaderChunks() : undefined,
            isDebug ? engineLayerImportValidation(input) : undefined,
            !isDebug ? strip({ functions: STRIP_FUNCTIONS }) : undefined,
            babel(isES5 ? es5Options(buildType) : moduleOptions(buildType)),
            !isES5 && !isDebug ? dynamicImportViteSupress() : undefined,
            !isDebug ? spacesToTabs() : undefined
        ]
    };

    HISTORY.set(`${buildType}-${moduleFormat}-${bundled}`, target);
    targets.push(target);

    // check if unbundled target is in history
    if (HISTORY.has(`${buildType}-${moduleFormat}-false`)) {
        const unbundled = HISTORY.get(`${buildType}-${moduleFormat}-false`);

        /**
         * @type {RollupOptions}
         */
        const target = {
            input: `${unbundled.output.dir}/index.js`,
            output: {
                banner: getBanner(BANNER[buildType]),
                format: 'es',
                indent: '\t',
                sourcemap: buildType === 'debug' ? 'inline' : undefined,
                name: 'pc',
                preserveModules: false,
                file: `${dir}/${OUT_PREFIX[buildType]}.mjs`
            }
        };

        HISTORY.set(`${buildType}-${moduleFormat}-${bundled}`, target);
        targets.push(target);
    }


    return targets;
}

export { buildTarget };
