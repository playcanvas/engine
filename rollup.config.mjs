import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// 1st party Rollup plugins
import { createFilter } from '@rollup/pluginutils';
import { babel } from '@rollup/plugin-babel';
import resolve from '@rollup/plugin-node-resolve';
import strip from '@rollup/plugin-strip';
import terser from '@rollup/plugin-terser';

// 3rd party Rollup plugins
import dts from 'rollup-plugin-dts';
import jscc from 'rollup-plugin-jscc';
import { visualizer } from 'rollup-plugin-visualizer';

/** @typedef {import('rollup').RollupOptions} RollupOptions */
/** @typedef {import('rollup').Plugin} Plugin */
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
 * This plugin converts every two spaces into one tab. Two spaces is the default the babel plugin
 * outputs, which is independent of the four spaces of the code base.
 *
 * @param {boolean} enable - Enable or disable the plugin.
 * @returns {Plugin} The plugin.
 */
function spacesToTabs(enable) {
    const filter = createFilter([
        '**/*.js'
    ], []);

    return {
        name: "spacesToTabs",
        transform(code, id) {
            if (!enable || !filter(id)) return undefined;
            // ^    = start of line
            // " +" = one or more spaces
            // gm   = find all + multiline
            const regex = /^ +/gm;
            code = code.replace(
                regex,
                startSpaces => startSpaces.replace(/ {2}/g, '\t')
            );
            return {
                code,
                map: null
            };
        }
    };
}

/**
 * Validate and print warning if an engine module on a lower level imports module on a higher level
 *
 * @param {string} rootFile - The root file, typically `src/index.js`.
 * @param {boolean} enable - Enable or disable the plugin.
 * @returns {Plugin} The plugin.
 */
function engineLayerImportValidation(rootFile, enable) {

    const folderLevels = {
        'core': 0,
        'platform': 1,
        'scene': 2,
        'framework': 3
    };

    let rootPath;

    return {
        name: 'engineLayerImportValidation',

        buildStart() {
            rootPath = path.parse(path.resolve(rootFile)).dir;
        },

        resolveId(imported, importer) {
            if (enable) {

                // skip non-relative paths, those are not our imports, for example 'rollupPluginBabelHelpers.js'
                if (importer && imported && imported.includes('./')) {

                    // convert importer path
                    const importerDir = path.parse(importer).dir;
                    const relImporter = path.dirname(path.relative(rootPath, importer));
                    const folderImporter = relImporter.split(path.sep)[0];
                    const levelImporter = folderLevels[folderImporter];

                    // convert imported path
                    const absImported = path.resolve(path.join(importerDir, imported));
                    const relImported = path.dirname(path.relative(rootPath, absImported));
                    const folderImported = relImported.split(path.sep)[0];
                    const levelImported = folderLevels[folderImported];

                    if (levelImporter < levelImported) {
                        console.log(`(!) Incorrect import: [${path.relative(rootPath, importer)}] -> [${imported}]`);
                    }
                }
            }

            // we don't process imports, return null to allow chaining
            return null;
        }
    };
}

/**
 * @param {boolean} enable - Enable or disable the plugin.
 * @returns {Plugin} The plugin.
 */
function shaderChunks(enable) {
    const filter = createFilter([
        '**/*.vert.js',
        '**/*.frag.js'
    ], []);

    return {
        name: 'shaderChunks',
        transform(code, id) {
            if (!enable || !filter(id)) return undefined;

            code = code.replace(/\/\* glsl \*\/\`((.|\r|\n)*)\`/, (match, glsl) => {

                // Remove carriage returns
                glsl = glsl.replace(/\r/g, '');

                // 4 spaces to tabs
                glsl = glsl.replace(/ {4}/g, '\t');

                // Remove comments
                glsl = glsl.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');

                // Trim all whitespace from line endings
                glsl = glsl.split('\n').map(line => line.trimEnd()).join('\n');

                // Restore final new line
                glsl += '\n';

                // Comment removal can leave an empty line so condense 2 or more to 1
                glsl = glsl.replace(/\n{2,}/g, '\n');

                // Remove new line character at the start of the string
                if (glsl.length > 1 && glsl[0] === '\n') {
                    glsl = glsl.substr(1);
                }

                return JSON.stringify(glsl);
            });

            return {
                code: code,
                map: null
            };
        }
    };
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
    'Debug.call',
    'Debug.deprecated',
    'Debug.warn',
    'Debug.warnOnce',
    'Debug.error',
    'Debug.errorOnce',
    'Debug.gpuError',
    'Debug.log',
    'Debug.logOnce',
    'Debug.trace',
    'DebugHelper.setName',
    'DebugHelper.setLabel',
    'DebugGraphics.toString',
    'DebugGraphics.clearGpuMarkers',
    'DebugGraphics.pushGpuMarker',
    'DebugGraphics.popGpuMarker',
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
        debug: ' (DEBUG PROFILER)',
        release: '',
        profiler: ' (PROFILER)',
        min: null
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
        banner: banner[buildType] && getBanner(banner[buildType] || banner.release),
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
            shaderChunks(buildType !== 'debug'),
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
