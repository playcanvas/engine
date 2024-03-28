// 1st party Rollup plugins
import { babel } from '@rollup/plugin-babel';
import strip from '@rollup/plugin-strip';
import terser from '@rollup/plugin-terser';

// 3rd party Rollup plugins
import jscc from 'rollup-plugin-jscc';
import { visualizer } from 'rollup-plugin-visualizer';

// custom Rollup plugins
import { shaderChunks } from './rollup-shader-chunks.mjs';
import { engineLayerImportValidation } from './rollup-import-validation.mjs';
import { spacesToTabs } from './rollup-spaces-to-tabs.mjs';
import { dynamicImportLegacyBrowserSupport, dynamicImportViteSupress } from './rollup-dynamic-import-transform.mjs';

import { version, revision } from './rollup-version-revision.mjs';
import { getBanner } from './rollup-get-banner.mjs';
import { es5Options } from './rollup-es5-options.mjs';
import { moduleOptions } from './rollup-module-options.mjs';

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

const cache = new Map();

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
 * Build a target that rollup is supposed to build.
 *
 * @param {'debug'|'release'|'profiler'|'min'} buildType - The build type.
 * @param {'es5'|'es6'} moduleFormat - The module format.
 * @param {string} input - Only used for Examples to change it to `../src/index.js`.
 * @param {string} [dir] - Only used for examples to change the output location.
 * @param {Boolean} [bundled] - Whether the target should be bundled.
 * @returns {RollupOptions} One rollup target.
 */
function buildTarget(buildType, moduleFormat, input = 'src/index.js', dir = 'build', bundled = true) {
    const isES5 = moduleFormat === 'es5';

    // enforce bundling for es5
    bundled ||= isES5;

    const outputPlugins = {
        release: [],
        min: [
            terser()
        ]
    };

    if (process.env.treemap) {
        outputPlugins.min.push(visualizer({
            filename: 'treemap.html',
            brotliSize: true,
            gzipSize: true
        }));
    }

    if (process.env.treenet) {
        outputPlugins.min.push(visualizer({
            filename: 'treenet.html',
            template: 'network'
        }));
    }

    if (process.env.treesun) {
        outputPlugins.min.push(visualizer({
            filename: 'treesun.html',
            template: 'sunburst'
        }));
    }

    /**
     * @type {RollupOptions}
     */
    const target = {
        input,
        output: {
            banner: bundled ? getBanner(BANNER[buildType]) : undefined,
            plugins: outputPlugins[buildType || outputPlugins.release],
            format: isES5 ? 'umd' : 'es',
            indent: '\t',
            sourcemap: bundled && buildType === 'debug' ? 'inline' : undefined,
            name: 'pc',
            preserveModules: !bundled,
            file: bundled ? `${dir}/${OUT_PREFIX[buildType]}${isES5 ? '.js' : '.mjs'}` : undefined,
            dir: bundled ? undefined : `${dir}/${OUT_PREFIX[buildType]}`
        },
        plugins: [
            jscc(getJSCCOptions(buildType, isES5)),
            isES5 ? dynamicImportLegacyBrowserSupport() : undefined,
            shaderChunks({ enabled: buildType !== 'debug' }),
            engineLayerImportValidation(input, buildType === 'debug'),
            buildType !== 'debug' ? strip({ functions: STRIP_FUNCTIONS }) : undefined,
            babel(moduleFormat === 'es5' ? es5Options(buildType) : moduleOptions(buildType)),
            !isES5 && buildType !== 'debug' ? dynamicImportViteSupress() : undefined,
            spacesToTabs(buildType !== 'debug')
        ]
    };

    cache.set(`${buildType}-${moduleFormat}`, target);

    return target;
}

/**
 * Build a target that rollup is supposed to build.
 *
 * @param {'debug'|'release'|'profiler'|'min'} buildType - The build type.
 * @param {string} input - Only used for Examples to change it to `../src/index.js`.
 * @param {string} [dir] - Only used for examples to change the output location.
 * @returns {RollupOptions} One rollup target.
 */
function buildBundleTarget(buildType, input = 'src/index.js', dir = 'build') {
    const outputPlugins = {
        release: [],
        min: [
            terser()
        ]
    };

    if (process.env.treemap) {
        outputPlugins.min.push(visualizer({
            filename: 'treemap.html',
            brotliSize: true,
            gzipSize: true
        }));
    }

    if (process.env.treenet) {
        outputPlugins.min.push(visualizer({
            filename: 'treenet.html',
            template: 'network'
        }));
    }

    if (process.env.treesun) {
        outputPlugins.min.push(visualizer({
            filename: 'treesun.html',
            template: 'sunburst'
        }));
    }

    const sourceMap = {
        debug: 'inline',
        release: null
    };

    return {
        input,
        output: {
            banner: getBanner(BANNER[buildType]),
            plugins: outputPlugins[buildType || outputPlugins.release],
            format: 'es',
            indent: '\t',
            sourcemap: sourceMap[buildType] || sourceMap.release,
            name: 'pc',
            preserveModules: false,
            file: `${dir}/${OUT_PREFIX[buildType]}.mjs`
        }
    };
}

export { buildTarget, buildBundleTarget };
