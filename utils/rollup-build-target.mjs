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

import { version, revision } from './rollup-version-revision.mjs';
import { getBanner } from './rollup-get-banner.mjs';
import { es5Options } from './rollup-es5-options.mjs';
import { moduleOptions } from './rollup-module-options.mjs';

/** @typedef {import('rollup').RollupOptions} RollupOptions */
/** @typedef {import('rollup').OutputOptions} OutputOptions */
/** @typedef {import('rollup').ModuleFormat} ModuleFormat */
/** @typedef {import('@rollup/plugin-strip').RollupStripOptions} RollupStripOptions */

const stripFunctions = [
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

/**
 * Build a target that rollup is supposed to build.
 *
 * @param {'debug'|'release'|'profiler'|'min'} buildType - The build type.
 * @param {'es5'|'es6'} moduleFormat - The module format.
 * @param {string} input - Only used for Examples to change it to `../src/index.js`.
 * @param {string} [buildDir] - Only used for examples to change the output location.
 * @returns {RollupOptions} One rollup target.
 */
function buildTarget(buildType, moduleFormat, input = 'src/index.js', buildDir = 'build') {
    const banner = {
        debug: ' (DEBUG)',
        release: ' (RELEASE)',
        profiler: ' (PROFILE)',
        min: ' (RELEASE)'
    };

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

    const outputFile = {
        debug: 'playcanvas.dbg',
        release: 'playcanvas',
        profiler: 'playcanvas.prf',
        min: 'playcanvas.min'
    };

    const outputExtension = {
        es5: '.js',
        es6: '.mjs'
    };

    /** @type {Record<string, ModuleFormat>} */
    const outputFormat = {
        es5: 'umd',
        es6: 'es'
    };

    const sourceMap = {
        debug: 'inline',
        release: null
    };
    /** @type {OutputOptions} */
    const outputOptions = {
        banner: moduleFormat === 'es5' && getBanner(banner[buildType]),
        plugins: outputPlugins[buildType || outputPlugins.release],
        format: outputFormat[moduleFormat],
        indent: '\t',
        sourcemap: sourceMap[buildType] || sourceMap.release,
        name: 'pc',
        preserveModules: moduleFormat === 'es6'
    };

    const loc = `${buildDir}/${outputFile[buildType]}${outputExtension[moduleFormat]}`;
    outputOptions[moduleFormat === 'es6' ? 'dir' : 'file'] = loc;

    const sdkVersion = {
        _CURRENT_SDK_VERSION: version,
        _CURRENT_SDK_REVISION: revision
    };

    const jsccOptions = {
        debug: {
            values: {
                ...sdkVersion,
                _DEBUG: 1,
                _PROFILER: 1
            },
            keepLines: true
        },
        release: {
            values: sdkVersion
        },
        profiler: {
            values: {
                ...sdkVersion,
                _PROFILER: 1
            }
        }
    };

    /**
     * @type {RollupStripOptions}
     */
    const stripOptions = {
        functions: stripFunctions
    };

    const babelOptions = {
        es5: es5Options(buildType),
        es6: moduleOptions(buildType)
    };

    return {
        input,
        output: outputOptions,
        plugins: [
            jscc(jsccOptions[buildType] || jsccOptions.release),
            shaderChunks({ enabled: buildType !== 'debug' }),
            engineLayerImportValidation(input, buildType === 'debug'),
            buildType !== 'debug' ? strip(stripOptions) : undefined,
            babel(babelOptions[moduleFormat]),
            spacesToTabs(buildType !== 'debug')
        ]
    };
}

export { buildTarget };
