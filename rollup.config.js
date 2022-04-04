import babel from '@rollup/plugin-babel';
import replace from '@rollup/plugin-replace';
import strip from '@rollup/plugin-strip';
import { createFilter } from '@rollup/pluginutils';
import dts from 'rollup-plugin-dts';
import jscc from 'rollup-plugin-jscc';
import { terser } from 'rollup-plugin-terser';
import { version } from './package.json';
import { visualizer } from 'rollup-plugin-visualizer';

const execSync = require('child_process').execSync;
let revision;
try {
    revision = execSync('git rev-parse --short HEAD').toString().trim();
} catch (e) {
    revision = 'unknown';
}

function getBanner(config) {
    return [
        '/**',
        ' * @license',
        ' * PlayCanvas Engine v' + version + ' revision ' + revision + config,
        ' * Copyright 2011-' + new Date().getFullYear() + ' PlayCanvas Ltd. All rights reserved.',
        ' */'
    ].join('\n');
}

function spacesToTabs() {
    const filter = createFilter([
        '**/*.js'
    ], []);

    return {
        transform(code, id) {
            if (!filter(id)) return undefined;
            return {
                code: code.replace(/\G {4}/g, '\t'),
                map: null
            };
        }
    };
}

function shaderChunks(removeComments) {
    const filter = createFilter([
        '**/*.vert.js',
        '**/*.frag.js'
    ], []);

    return {
        transform(code, id) {
            if (!filter(id)) return undefined;

            code = code.replace(/\/\* glsl \*\/\`((.|\r|\n)*)\`/, (match, glsl) => {

                // Remove carriage returns
                glsl = glsl.replace(/\r/g, '');

                // 4 spaces to tabs
                glsl = glsl.replace(/ {4}/g, '\t');

                if (removeComments) {
                    // Remove comments
                    glsl = glsl.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');

                    // Trim all whitespace from line endings
                    glsl = glsl.split('\n').map(line => line.trimEnd()).join('\n');

                    // Restore final new line
                    glsl += '\n';

                    // Comment removal can leave an empty line so condense 2 or more to 1
                    glsl = glsl.replace(/\n{2,}/g, '\n');
                }

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

const stripOptions = {
    functions: [
        'Debug.assert',
        'Debug.deprecated',
        'Debug.warn',
        'Debug.error',
        'Debug.log',
        'DebugGraphics.pushGpuMarker',
        'DebugGraphics.popGpuMarker',
        'WorldClustersDebug.render'
    ]
};

const target_release_es5 = {
    input: 'src/index.js',
    output: [
        {
            banner: getBanner(''),
            file: 'build/playcanvas.js',
            format: 'umd',
            indent: '\t',
            name: 'pc'
        },
        {
            banner: getBanner(''),
            file: 'build/playcanvas.min.js',
            format: 'umd',
            indent: '\t',
            name: 'pc',
            plugins: [
                terser()
            ]
        }
    ],
    plugins: [
        jscc({
            values: {}
        }),
        shaderChunks(true),
        replace({
            values: {
                __REVISION__: revision,
                __CURRENT_SDK_VERSION__: version
            },
            preventAssignment: true
        }),
        strip(stripOptions),
        babel(es5Options),
        spacesToTabs()
    ]
};

if (process.env.treemap) {
    const visualizerPlugin = visualizer({
        brotliSize: true,
        gzipSize: true
    });
    target_release_es5.output[1].plugins.push(visualizerPlugin);
}

const target_release_es6 = {
    input: 'src/index.js',
    output: {
        banner: getBanner(''),
        file: 'build/playcanvas.mjs',
        format: 'es',
        indent: '\t',
        name: 'pc'
    },
    plugins: [
        jscc({
            values: {}
        }),
        shaderChunks(true),
        replace({
            values: {
                __REVISION__: revision,
                __CURRENT_SDK_VERSION__: version
            },
            preventAssignment: true
        }),
        strip(stripOptions),
        babel(moduleOptions),
        spacesToTabs()
    ]
};

const target_debug = {
    input: 'src/index.js',
    output: {
        banner: getBanner(' (DEBUG PROFILER)'),
        file: 'build/playcanvas.dbg.js',
        format: 'umd',
        indent: '\t',
        name: 'pc',
        sourcemap: true
    },
    plugins: [
        jscc({
            values: {
                _DEBUG: 1,
                _PROFILER: 1
            },
            keepLines: true
        }),
        shaderChunks(false),
        replace({
            values: {
                __REVISION__: revision,
                __CURRENT_SDK_VERSION__: version
            },
            preventAssignment: true
        }),
        babel(es5Options),
        spacesToTabs()
    ]
};

const target_profiler = {
    input: 'src/index.js',
    output: {
        banner: getBanner(' (PROFILER)'),
        file: 'build/playcanvas.prf.js',
        format: 'umd',
        indent: '\t',
        name: 'pc'
    },
    plugins: [
        jscc({
            values: {
                _PROFILER: 1
            },
            keepLines: true
        }),
        shaderChunks(false),
        replace({
            values: {
                __REVISION__: revision,
                __CURRENT_SDK_VERSION__: version
            },
            preventAssignment: true
        }),
        strip(stripOptions),
        babel(es5Options),
        spacesToTabs()
    ]
};

function scriptTarget(name, input, output) {
    return {
        input: input,
        output: {
            banner: getBanner(''),
            file: output || input.replace('.mjs', '.js'),
            format: 'umd',
            indent: '\t',
            name: name
        },
        plugins: [
            babel(es5Options),
            spacesToTabs()
        ]
    };
}

const target_extras = [
    scriptTarget('pcx', 'extras/index.js', 'build/playcanvas-extras.js'),
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

let targets;

if (process.env.target) { // Build a specific target
    switch (process.env.target.toLowerCase()) {
        case 'es5':      targets = [target_release_es5]; break;
        case 'es6':      targets = [target_release_es6]; break;
        case 'debug':    targets = [target_debug]; break;
        case 'profiler': targets = [target_profiler]; break;
        case 'types':    targets = [target_types]; break;
    }
} else { // Build all targets
    targets = [
        target_release_es5,
        target_release_es6,
        target_debug,
        target_profiler,
        ...target_extras
    ];
}

export default targets;
