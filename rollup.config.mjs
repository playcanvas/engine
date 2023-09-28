import { execSync } from 'node:child_process';
import * as fs from 'node:fs';

// 1st party Rollup plugins
import { babel } from '@rollup/plugin-babel';
import resolve from '@rollup/plugin-node-resolve';
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

/** @typedef {import('rollup').RollupOptions} RollupOptions */
/** @typedef {import('rollup').OutputOptions} OutputOptions */
/** @typedef {import('@rollup/plugin-babel').RollupBabelInputPluginOptions} RollupBabelInputPluginOptions */
/** @typedef {import('@rollup/plugin-strip').RollupStripOptions} RollupStripOptions */

/**
 * @returns {string} Version string like `1.58.0-dev`
 */
function getVersion() {
    const text = fs.readFileSync('./package.json', 'utf8');
    const json = JSON.parse(text);
    return json.version;
}

/**
 * @returns {string} Revision string like `644d08d39` (9 digits/chars).
 */
function getRevision() {
    let revision;
    try {
        revision = execSync('git rev-parse --short HEAD').toString().trim();
    } catch (e) {
        revision = 'unknown';
    }
    return revision;
}

const version = getVersion();
const revision = getRevision();
console.log(`Building PlayCanvas Engine v${version} revision ${revision}`);

/**
 * Build the banner with build date and revision. Revision only works for git repo, not zip.
 *
 * @param {string} config - A string like `(DEBUG PROFILER)` or even an empty string.
 * @returns {string} - The banner.
 */
function getBanner(config) {
    return [
        '/**',
        ' * @license',
        ' * PlayCanvas Engine v' + version + ' revision ' + revision + config,
        ' * Copyright 2011-' + new Date().getFullYear() + ' PlayCanvas Ltd. All rights reserved.',
        ' */'
    ].join('\n');
}

/**
 * The ES5 options for babel(...) plugin.
 *
 * @param {string} buildType - Only 'debug' requires special handling so far.
 * @returns {RollupBabelInputPluginOptions} The babel options.
 */
const es5Options = buildType => ({
    babelHelpers: 'bundled',
    babelrc: false,
    comments: buildType === 'debug',
    compact: false,
    minified: false,
    presets: [
        [
            '@babel/preset-env', {
                loose: true,
                modules: false,
                targets: {
                    ie: '11'
                }
            }
        ]
    ]
});

/**
 * The ES6 options for babel(...) plugin.
 *
 * @param {string} buildType - Only 'debug' requires special handling so far.
 * @returns {RollupBabelInputPluginOptions} The babel options.
 */
const moduleOptions = buildType => ({
    babelHelpers: 'bundled',
    babelrc: false,
    comments: buildType === 'debug',
    compact: false,
    minified: false,
    presets: [
        [
            '@babel/preset-env', {
                bugfixes: true,
                loose: true,
                modules: false,
                targets: {
                    esmodules: true
                }
            }
        ]
    ]
});

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

    /** @type {Record<string, 'umd'|'es'>} */
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

/**
 * Build an ES5 target that rollup is supposed to build.
 *
 * @param {string} name - The name, like `pcx` or `VoxParser`.
 * @param {string} input - The input file, like `extras/index.js`.
 * @param {string} [output] - If not given, input is used.
 * @returns {RollupOptions} One rollup target.
 */
function scriptTarget(name, input, output) {
    return {
        input: input,
        output: {
            name: name,
            banner: getBanner(''),
            file: output || input.replace('.mjs', '.js'),
            format: 'umd',
            indent: '\t',
            globals: { playcanvas: 'pc' }
        },
        plugins: [
            resolve(),
            babel(es5Options('release')),
            spacesToTabs(true)
        ],
        external: ['playcanvas'],
        cache: false
    };
}

/**
 * Build an ES6 target that rollup is supposed to build.
 *
 * @param {string} name - The name, like `pcx` or `VoxParser`.
 * @param {string} input - The input file, like `extras/index.js`.
 * @param {string} output - The output file, like `build/playcanvas-extras.mjs`.
 * @returns {RollupOptions} One rollup target.
 */
function scriptTargetEs6(name, input, output) {
    return {
        input: input,
        output: {
            name: name,
            banner: getBanner(''),
            dir: output,
            format: 'es',
            indent: '\t',
            preserveModules: true
        },
        plugins: [
            resolve(),
            babel(moduleOptions('release')),
            spacesToTabs(true)
        ],
        external: ['playcanvas', 'fflate']
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

export default (args) => {
    /** @type {RollupOptions[]} */
    let targets = [];

    const envTarget = process.env.target ? process.env.target.toLowerCase() : null;

    if ((envTarget === null) && fs.existsSync('build')) {
        // no targets specified, clean build directory
        fs.rmSync('build', { recursive: true });
    }

    if (envTarget === 'types') {
        targets.push(target_types);
    } else if (envTarget === 'extras') {
        targets = targets.concat(target_extras);
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
            targets = targets.concat(target_extras);
        }
    }

    return targets;
};
