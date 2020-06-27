import replace from '@rollup/plugin-replace';
import { createFilter } from '@rollup/pluginutils';
import cleanup from 'rollup-plugin-cleanup';
import { version } from './package.json';
import Preprocessor from 'preprocessor';

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

function shaderChunks() {
    const filter = createFilter([
        '**/*.vert',
        '**/*.frag'
    ], []);

    return {
        transform(code, id) {
            if (!filter(id)) return;
            return {
                code: `export default ${JSON.stringify(code)};`,
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
        shaderChunks(),
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
        shaderChunks(),
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
        shaderChunks(),
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

var target_wasm = {
    input: 'src/index_assemblyscript.js',
    output: {
        banner: getBanner(''),
        file: 'build/playcanvas.assemblyscript.js',
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
        shaderChunks(),
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

var targets = [
    target_release,
    target_debug,
    target_performance,
    target_extras
];

if (process.env.AssemblyScript) {
    targets = [
        target_wasm,
        target_extras
    ];
}

export default targets;
