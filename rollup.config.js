import babel from '@rollup/plugin-babel';
import replace from '@rollup/plugin-replace';
import strip from '@rollup/plugin-strip';
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
                code = code.split('\n').map(line => line.trimEnd()).join('\n');

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
    functions: ['DeprecatedLog.log']
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
        strip(stripOptions),
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
        strip(stripOptions),
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
            spacesToTabs
        ]
    };
}

const target_extras = [
    scriptTarget('pcx', 'extras/index.js', 'build/playcanvas-extras.js'),
    scriptTarget('VoxParser', 'scripts/parsers/vox-parser.mjs')
];

let targets = [
    target_release_es5,
    target_release_es5min,
    target_release_es6,
    target_debug,
    target_profiler
];

// Build all targets by default, unless a specific target is chosen
if (process.env.target) {
    switch (process.env.target.toLowerCase()) {
        case "es5":      targets = [target_release_es5]; break;
        case "es5min":   targets = [target_release_es5min]; break;
        case "es6":      targets = [target_release_es6]; break;
        case "debug":    targets = [target_debug]; break;
        case "profiler": targets = [target_profiler]; break;
    }
}

// append common targets
targets.push(...target_extras);

export default targets;
