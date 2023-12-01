import { exec } from 'node:child_process';
import * as fs from 'node:fs';

// 1st party Rollup plugins
import { babel } from '@rollup/plugin-babel';
import strip from '@rollup/plugin-strip';
import terser from '@rollup/plugin-terser';

// 3rd party Rollup plugins
import dts from 'rollup-plugin-dts';
import jscc from 'rollup-plugin-jscc';
import { visualizer } from 'rollup-plugin-visualizer';

// custom Rollup plugins
import { shaderChunks } from './utils/rollup-shader-chunks.mjs';
import { engineLayerImportValidation } from './utils/rollup-import-validation.mjs';
import { spacesToTabs } from './utils/rollup-spaces-to-tabs.mjs';

import { version, revision } from './utils/rollup-version-revision.mjs';
import { getBanner } from './utils/rollup-get-banner.mjs';
import { es5Options } from './utils/rollup-es5-options.mjs';
import { scriptTarget } from './utils/rollup-script-target.mjs';
import { scriptTargetEs6 } from './utils/rollup-script-target-es6.mjs';
import { moduleOptions } from './utils/rollup-module-options.mjs';

/** @typedef {import('rollup').RollupOptions} RollupOptions */
/** @typedef {import('rollup').OutputOptions} OutputOptions */
/** @typedef {import('rollup').ModuleFormat} ModuleFormat */
/** @typedef {import('@rollup/plugin-babel').RollupBabelInputPluginOptions} RollupBabelInputPluginOptions */
/** @typedef {import('@rollup/plugin-strip').RollupStripOptions} RollupStripOptions */

console.log(`Building PlayCanvas Engine v${version} revision ${revision}`);

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
 * @returns {RollupOptions} One rollup target.
 */
function buildTarget(buildType, moduleFormat) {
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
        debug: 'build/playcanvas.dbg',
        release: 'build/playcanvas',
        profiler: 'build/playcanvas.prf',
        min: 'build/playcanvas.min'
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

    outputOptions[moduleFormat === 'es6' ? 'dir' : 'file'] = `${outputFile[buildType]}${outputExtension[moduleFormat]}`;

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

    const rootFile = 'src/index.js';
    return {
        input: rootFile,
        output: outputOptions,
        plugins: [
            jscc(jsccOptions[buildType] || jsccOptions.release),
            shaderChunks({ enabled: buildType !== 'debug' }),
            engineLayerImportValidation(rootFile, buildType === 'debug'),
            buildType !== 'debug' ? strip(stripOptions) : undefined,
            babel(babelOptions[moduleFormat]),
            spacesToTabs(buildType !== 'debug')
        ]
    };
}

const target_extras = [
    scriptTarget('pcx', 'extras/index.js', 'build/playcanvas-extras.js'),
    scriptTargetEs6('pcx', 'extras/index.js', 'build/playcanvas-extras.mjs'),
    scriptTarget('VoxParser', 'scripts/parsers/vox-parser.mjs')
];

/** @type {RollupOptions} */
const target_types = {
    input: 'types/index.d.ts',
    output: [{
        file: 'build/playcanvas.d.ts',
        footer: 'export as namespace pc;',
        format: 'es'
    }],
    plugins: [
        dts()
    ]
};

function buildTypes() {
    const start = Date.now();
    const child = exec('npm run build:types');
    child.on('exit', function () {
        const end = Date.now();
        const delta = (end - start) / 1000;
        console.log(`created build/playcanvas.d.ts in ${delta}s`);
    });
}

export default (args) => {
    /** @type {RollupOptions[]} */
    const targets = [];

    const envTarget = process.env.target ? process.env.target.toLowerCase() : null;

    if ((envTarget === null) && fs.existsSync('build')) {
        // no targets specified, clean build directory
        fs.rmSync('build', { recursive: true });
    }

    if (envTarget === 'types') {
        targets.push(target_types);
    } else if (envTarget === 'extras') {
        targets.push(...target_extras);
    } else {
        ['release', 'debug', 'profiler', 'min'].forEach((t) => {
            ['es5', 'es6'].forEach((m) => {
                if (envTarget === null || envTarget === t || envTarget === m || envTarget === `${t}_${m}`) {
                    targets.push(buildTarget(t, m));
                }
            });
        });

        if (envTarget === null) {
            // no targets specified, build them all
            buildTypes();
            targets.push(...target_extras);
        }
    }

    return targets;
};

export { buildTarget, scriptTarget };
