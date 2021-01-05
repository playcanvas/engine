import babel from '@rollup/plugin-babel';
import replace from '@rollup/plugin-replace';
import { createFilter } from '@rollup/pluginutils';
import { version } from './package.json';
import Preprocessor from 'preprocessor';
import typescript from 'rollup-plugin-typescript';

const execSync = require('child_process').execSync;
const revision = execSync('git rev-parse --short HEAD').toString().trim();

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

function preprocessor(options) {
    const filter = createFilter([
        '**/*.js'
    ], []);

    return {
        transform(code, id) {
            if (!filter(id)) return;
            return {
                code: new Preprocessor(code).process(options),
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

function importAssemblyScriptInstead(options) {
    const filter = createFilter([
        '**/*.js'
    ], []);

    return {
        transform(code, id) {
            if (!filter(id)) return;
            code = code.replace(/math\/quat\.js/g, "math_assemblyscript/quat.js");
            code = code.replace(/math\/mat3\.js/g, "math_assemblyscript/mat3.js");
            code = code.replace(/math\/mat4\.js/g, "math_assemblyscript/mat4.js");
            code = code.replace(/math\/vec2\.js/g, "math_assemblyscript/vec2.js");
            code = code.replace(/math\/vec3\.js/g, "math_assemblyscript/vec3.js");
            code = code.replace(/math\/vec4\.js/g, "math_assemblyscript/vec4.js");
            // code = code.replace(/scene\/graph-node\.js/g, "scene_assemblyscript/graph-node.ts");
            return {
                code: code,
                map: { mappings: '' }
            };
        }
    };
}

function importAssemblyScriptAsJavaScriptInstead(options) {
    const filter = createFilter([
        '**/*.js',
        '**/*.ts'
    ], []);

    return {
        transform(code, id) {
            if (!filter(id)) return;
            code = code.replace(/math\/quat\.js/g, "math_assemblyscript_js/quat.ts");
            code = code.replace(/math\/mat3\.js/g, "math_assemblyscript_js/mat3.ts");
            code = code.replace(/math\/mat4\.js/g, "math_assemblyscript_js/mat4.ts");
            code = code.replace(/math\/vec2\.js/g, "math_assemblyscript_js/vec2.ts");
            code = code.replace(/math\/vec3\.js/g, "math_assemblyscript_js/vec3.ts");
            code = code.replace(/math\/vec4\.js/g, "math_assemblyscript_js/vec4.ts");
            return {
                code: code,
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
        preprocessor({
            PROFILER: false,
            DEBUG: false,
            RELEASE: true
        }),
        shaderChunks(true),
        replace({
            __REVISION__: revision,
            __CURRENT_SDK_VERSION__: version
        }),
        babel(es5Options),
        spacesToTabs()
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
        preprocessor({
            PROFILER: false,
            DEBUG: false,
            RELEASE: true
        }),
        shaderChunks(true),
        replace({
            __REVISION__: revision,
            __CURRENT_SDK_VERSION__: version
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
        preprocessor({
            PROFILER: true,
            DEBUG: true,
            RELEASE: false
        }),
        shaderChunks(false),
        replace({
            __REVISION__: revision,
            __CURRENT_SDK_VERSION__: version
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
        preprocessor({
            PROFILER: true,
            DEBUG: false,
            RELEASE: false
        }),
        shaderChunks(false),
        replace({
            __REVISION__: revision,
            __CURRENT_SDK_VERSION__: version
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


const target_as32 = {
    input: 'src/index.js',
    output: {
        banner: getBanner(''),
        file: 'build/playcanvas.assemblyscript_32.js',
        format: 'umd',
        indent: '\t',
        name: 'pc'
    },
    plugins: [
        preprocessor({
            PROFILER: false,
            DEBUG: false,
            RELEASE: true,
            X32: true
        }),
        shaderChunks(true),
        replace({
            __REVISION__: revision,
            __CURRENT_SDK_VERSION__: version
        }),
        babel(es5Options),
        spacesToTabs(),
        importAssemblyScriptInstead()
    ]
};

const target_as64 = {
    input: 'src/index.js',
    output: {
        banner: getBanner(''),
        file: 'build/playcanvas.assemblyscript_64.js',
        format: 'umd',
        indent: '\t',
        name: 'pc'
    },
    plugins: [
        preprocessor({
            PROFILER: false,
            DEBUG: false,
            RELEASE: true,
            X64: true
        }),
        shaderChunks(true),
        replace({
            __REVISION__: revision,
            __CURRENT_SDK_VERSION__: version
        }),
        babel(es5Options),
        spacesToTabs(),
        importAssemblyScriptInstead()
    ]
};

const target_asjs = {
    input: 'src/index.js',
    output: {
        banner: getBanner(''),
        file: 'build/playcanvas.assemblyscriptjs.js',
        format: 'umd',
        indent: '\t',
        name: 'pc'
    },
    plugins: [
        preprocessor({
            PROFILER: false,
            DEBUG: false,
            RELEASE: true
        }),
        shaderChunks(true),
        replace({
            __REVISION__: revision,
            __CURRENT_SDK_VERSION__: version
        }),
        babel(es5Options),
        spacesToTabs(),
        typescript(),
        importAssemblyScriptAsJavaScriptInstead()
    ]
};

let targets = [
    target_release_es5,
    target_release_es6,
    target_debug,
    target_profiler,
    target_extras
];

// Build all targets by default, unless a specific target is chosen
if (process.env.target) {
    switch (process.env.target.toLowerCase()) {
        case "es5":      targets = [target_release_es5, target_extras]; break;
        case "es6":      targets = [target_release_es6, target_extras]; break;
        case "debug":    targets = [target_debug,       target_extras]; break;
        case "profiler": targets = [target_profiler,    target_extras]; break;
        case "as32":     targets = [target_as32,        target_extras]; break;
        case "as64":     targets = [target_as64,        target_extras]; break;
        case "asjs":     targets = [target_asjs,        target_extras]; break;
    }
}

export default targets;
