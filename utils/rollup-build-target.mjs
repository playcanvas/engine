// official package plugins
import resolve from '@rollup/plugin-node-resolve';
import strip from '@rollup/plugin-strip';
import swcPlugin from '@rollup/plugin-swc';
import { minify } from '@swc/core';

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
    rel: ' (RELEASE)',
    prf: ' (PROFILE)',
    min: ' (RELEASE)'
};

const OUT_PREFIX = {
    dbg: 'playcanvas.dbg',
    rel: 'playcanvas',
    prf: 'playcanvas.prf',
    min: 'playcanvas.min'
};

/**
 * @param {'rel'|'dbg'|'prf'} buildType - The build type.
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
        rel: {
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
 * Create a Rollup plugin to minify the output using SWC.
 *
 * @param {boolean} esm - Whether the output is an ES module.
 * @param {string} banner - The banner to prepend to the minified code.
 * @returns {import('rollup').Plugin} The Rollup plugin.
 */
function minifyOutput(esm, banner) {
    return {
        name: 'swc-minify',
        async renderChunk(code) {
            const result = await minify(code, {
                sourceMap: true,
                inlineSourcesContent: true,
                module: esm,
                compress: {
                    drop_console: true,
                    pure_funcs: []
                },
                mangle: true,
                format: {
                    comments: false,
                    preamble: `${banner}\n`
                }
            });
            return {
                code: result.code,
                map: result.map ? JSON.parse(result.map) : null
            };
        }
    };
}

/**
 * Build rollup options for JS.
 *
 * @param {object} options - The build target options.
 * @param {'umd'|'esm'} options.moduleFormat - The module format.
 * @param {'rel'|'dbg'|'prf'|'min'} options.buildType - The build type.
 * @param {boolean} [options.preserveModules] - Generate the ESM module tree.
 * @param {string} [options.input] - Only used for examples to change it to `../src/index.js`.
 * @param {string} [options.dir] - Only used for examples to change the output location.
 * @returns {RollupOptions[]} Rollup targets.
 */
function buildJSOptions({
    moduleFormat,
    buildType,
    preserveModules = moduleFormat === 'esm' && buildType !== 'min',
    input = 'src/index.js',
    dir = 'build'
}) {
    const isUMD = moduleFormat === 'umd';
    const isDebug = buildType === 'dbg';
    const isMin = buildType === 'min';
    const preserve = preserveModules && !isUMD && !isMin;

    const prefix = `${OUT_PREFIX[buildType]}`;
    const file = `${prefix}${isUMD ? '.js' : '.mjs'}`;
    const banner = getBanner(BANNER[buildType]);

    /** @type {OutputOptions[]} */
    const output = [{
        banner: isMin ? undefined : banner,
        plugins: buildType === 'rel' ? getOutPlugins(isUMD ? 'umd' : 'es') : undefined,
        format: isUMD ? 'umd' : 'es',
        indent: '\t',
        sourcemap: isDebug && 'inline',
        name: isUMD ? 'pc' : undefined,
        file: `${dir}/${file}`
    }];

    if (preserve) {
        output.push({
            format: 'es',
            indent: '\t',
            preserveModules: true,
            preserveModulesRoot: rootDir,
            dir: `${dir}/${prefix}`,
            entryFileNames: chunkInfo => `${chunkInfo.name.replace(/node_modules/g, 'modules')}.js`
        });
    }

    /**
     * @type {RollupOptions}
     */
    const target = {
        input,
        output,
        context: isUMD ? 'this' : undefined,
        plugins: [
            resolve(),
            jscc(getJSCCOptions(isMin ? 'rel' : buildType)),
            isUMD ? dynamicImportLegacyBrowserSupport() : undefined,
            !isDebug ? shaderChunks() : undefined,
            isDebug ? engineLayerImportValidation(input) : undefined,
            !isDebug ? strip({ functions: STRIP_FUNCTIONS }) : undefined,
            swcPlugin({ swc: swcOptions(isDebug, false) }),
            !isUMD ? dynamicImportBundlerSuppress() : undefined,
            !isDebug ? spacesToTabs() : undefined,
            isMin ? minifyOutput(!isUMD, banner) : undefined
        ]
    };

    return [target];
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
