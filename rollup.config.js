import replace from '@rollup/plugin-replace';
import { createFilter } from '@rollup/pluginutils';
import cleanup from 'rollup-plugin-cleanup';
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
                code: code.replace(/    /g, '\t'), // eslint-disable-line no-regex-spaces
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
            return {
                code: code,
                map: { mappings: '' }
            };
        }
    };
}

function importAssemblyScriptAsJavaScriptInstead(options) {
    const filter = createFilter([
        '**/*.js'
    ], []);

    return {
        transform(code, id) {
            if (!filter(id)) return;
            code = code.replace(/math\/quat\.js/g, "math_assemblyscript_js/Quat.js");
            code = code.replace(/math\/mat3\.js/g, "math_assemblyscript_js/Mat3.js");
            code = code.replace(/math\/mat4\.js/g, "math_assemblyscript_js/Mat4.js");
            code = code.replace(/math\/vec2\.js/g, "math_assemblyscript_js/Vec2.js");
            code = code.replace(/math\/vec3\.js/g, "math_assemblyscript_js/Vec3.js");
            code = code.replace(/math\/vec4\.js/g, "math_assemblyscript_js/Vec4.js");
            return {
                code: code,
                map: { mappings: '' }
            };
        }
    };
}

var target_release = {
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
        cleanup({
            comments: 'some'
        }),
        spacesToTabs()
    ]
};

var target_debug = {
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
        cleanup({
            comments: 'some'
        }),
        spacesToTabs()
    ]
};

var target_performance = {
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
        cleanup({
            comments: 'some'
        }),
        spacesToTabs()
    ]
};

var target_extras = {
    input: 'extras/index.js',
    output: {
        banner: getBanner(''),
        file: 'build/playcanvas-extras.js',
        format: 'umd',
        indent: '\t',
        name: 'pcx'
    },
    plugins: [
        cleanup({
            comments: 'some'
        }),
        spacesToTabs()
    ]
};

var target_assemblyscript_32 = {
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
        shaderChunks(false),
        replace({
            __REVISION__: revision,
            __CURRENT_SDK_VERSION__: version
        }),
        cleanup({
            comments: 'some'
        }),
        spacesToTabs(),
        importAssemblyScriptInstead()
    ]
};

var target_assemblyscript_64 = {
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
        shaderChunks(false),
        replace({
            __REVISION__: revision,
            __CURRENT_SDK_VERSION__: version
        }),
        cleanup({
            comments: 'some'
        }),
        spacesToTabs(),
        importAssemblyScriptInstead()
    ]
};

var target_assemblyscript_js = {
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
        shaderChunks(false),
        replace({
            __REVISION__: revision,
            __CURRENT_SDK_VERSION__: version
        }),
        cleanup({
            comments: 'some'
        }),
        spacesToTabs(),
        typescript(),
        importAssemblyScriptAsJavaScriptInstead()
    ]
};

var targets = [
    target_release,
    target_debug,
    target_performance,
    target_extras
];

if (process.env.AssemblyScript32) {
    targets = [
        target_assemblyscript_32,
        target_extras
    ];
}

if (process.env.AssemblyScript64) {
    targets = [
        target_assemblyscript_64,
        target_extras
    ];
}

if (process.env.AssemblyScriptJS) {
    targets = [
        target_assemblyscript_js,
        target_extras
    ];
}

export default targets;
