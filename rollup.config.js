import babel from '@rollup/plugin-babel';
import replace from '@rollup/plugin-replace';
import { createFilter } from '@rollup/pluginutils';
import jscc from 'rollup-plugin-jscc';
import { terser } from 'rollup-plugin-terser';
import { version } from './package.json';

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
            if (!filter(id)) return;
            return {
                code: code.replace(/  /g, '\t'), // eslint-disable-line no-regex-spaces
                map: { mappings: '' }
            };
        }
    };
}

function shaderChunks(removeComments) {
    const filter = createFilter([
        '**/*.vert',
        '**/*.frag'
    ], []);

    return {
        transform(code, id) {
            if (!filter(id)) return;

            // Remove carriage returns
            code = code.replace(/\r/g, '');

            // 4 spaces to tabs
            code = code.replace(/    /g, '\t'); // eslint-disable-line no-regex-spaces

            if (removeComments) {
                // Remove comments
                code = code.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');

                // Trim all whitespace from line endings
                code = code.split('\n').map((line) => line.trimEnd()).join('\n');

                // Restore final new line
                code += '\n';

                // Comment removal can leave an empty line so condense 2 or more to 1
                code = code.replace(/\n{2,}/g, '\n');
            }

            return {
                code: `export default ${JSON.stringify(code)};`,
                map: { mappings: '' }
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
                    ie: "11"
                }
            }
        ]
    ],
    plugins: [
        [
            '@babel/plugin-proposal-class-properties', {
                loose: true
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
    ],
    plugins: [
        [
            '@babel/plugin-proposal-class-properties', {
                loose: true
            }
        ]
    ]
};

const target_release_es5 = {
    input: 'src/index.js',
    output: {
        banner: getBanner(''),
        file: 'build/playcanvas.js',
        format: 'umd',
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
        babel(es5Options),
        spacesToTabs()
    ]
};

const target_release_es5min = {
    input: 'src/index.js',
    output: {
        banner: getBanner(''),
        file: 'build/playcanvas.min.js',
        format: 'umd',
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
        babel(es5Options),
        terser()
    ]
};

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
        name: 'pc'
    },
    plugins: [
        jscc({
            values: {
                _DEBUG: 1,
                _PROFILER: 1
            }
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
            }
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

const target_extras = {
    input: 'extras/index.js',
    output: {
        banner: getBanner(''),
        file: 'build/playcanvas-extras.js',
        format: 'umd',
        indent: '\t',
        name: 'pcx'
    },
    plugins: [
        babel(es5Options),
        spacesToTabs()
    ]
};

let targets = [
    target_release_es5,
    target_release_es5min,
    target_release_es6,
    target_debug,
    target_profiler,
    target_extras
];

// Build all targets by default, unless a specific target is chosen
if (process.env.target) {
    switch (process.env.target.toLowerCase()) {
        case "es5":      targets = [target_release_es5,    target_extras]; break;
        case "es5min":   targets = [target_release_es5min, target_extras]; break;
        case "es6":      targets = [target_release_es6,    target_extras]; break;
        case "debug":    targets = [target_debug,          target_extras]; break;
        case "profiler": targets = [target_profiler,       target_extras]; break;
    }
}

export default targets;
