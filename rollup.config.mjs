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

function getVersion() {
    const text = fs.readFileSync('./package.json', 'utf8');
    const json = JSON.parse(text);
    return json.version;
}

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

function getBanner(config) {
    return [
        '/**',
        ' * @license',
        ' * PlayCanvas Engine v' + version + ' revision ' + revision + config,
        ' * Copyright 2011-' + new Date().getFullYear() + ' PlayCanvas Ltd. All rights reserved.',
        ' */'
    ].join('\n');
}

function spacesToTabs(enable) {
    const filter = createFilter([
        '**/*.js'
    ], []);

    return {
        transform(code, id) {
            if (!enable || !filter(id)) return undefined;
            return {
                code: code.replace(/\G {4}/g, '\t'),
                map: null
            };
        }
    };
}

// Validate and print warning if an engine module on a lower level imports module on a higher level
function engineLayerImportValidation(rootFile, enable) {

    const folderLevels = {
        'core': 0,
        'platform': 1,
        'scene': 2,
        'framework': 3
    };

    let rootPath;

    return {
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

function shaderChunks(enable) {
    const filter = createFilter([
        '**/*.vert.js',
        '**/*.frag.js'
    ], []);

    return {
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

const es5Options = {
    babelHelpers: 'bundled',
    babelrc: false,
    comments: false,
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
};

const moduleOptions = {
    babelHelpers: 'bundled',
    babelrc: false,
    comments: false,
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
};

const stripFunctions = [
    'Debug.assert',
    'Debug.assertDeprecated',
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
    'DebugGraphics.pushGpuMarker',
    'DebugGraphics.popGpuMarker',
    'WorldClustersDebug.render'
];

// buildType is: 'debug', 'release', 'profiler', 'min'
// moduleFormat is: 'es5', 'es6'
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

    const outputFormat = {
        es5: 'umd',
        es6: 'es'
    };

    const sourceMap = {
        debug: 'inline',
        release: null
    };

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

    const stripOptions = {
        debug: {
            functions: []
        },
        release: {
            functions: stripFunctions
        }
    };

    const babelOptions = {
        es5: es5Options,
        es6: moduleOptions
    };

    const rootFile = 'src/index.js';
    return {
        input: rootFile,
        output: outputOptions,
        plugins: [
            jscc(jsccOptions[buildType] || jsccOptions.release),
            shaderChunks(buildType !== 'debug'),
            engineLayerImportValidation(rootFile, buildType === 'debug'),
            strip(stripOptions[buildType] || stripOptions.release),
            babel(babelOptions[moduleFormat]),
            spacesToTabs(buildType !== 'debug')
        ]
    };
}

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
            babel(es5Options),
            spacesToTabs()
        ],
        external: ['playcanvas'],
        cache: false
    };
}

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
            babel(moduleOptions),
            spacesToTabs()
        ],
        external: ['playcanvas', 'fflate']
    };
}

const target_extras = [
    scriptTarget('pcx', 'extras/index.js', 'build/playcanvas-extras.js'),
    scriptTargetEs6('pcx', 'extras/index.js', 'build/playcanvas-extras.mjs'),
    scriptTarget('VoxParser', 'scripts/parsers/vox-parser.mjs')
];

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
