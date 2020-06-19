import replace from '@rollup/plugin-replace';
import { createFilter } from '@rollup/pluginutils';
import { version } from './package.json';
import Preprocessor from 'preprocessor';

const execSync = require('child_process').execSync;
const revision = execSync('git rev-parse --short HEAD').toString().trim()
const notice = [
    '/*',
    ' * Playcanvas Engine v' + version + ' revision ' + revision,
    ' * Copyright 2011-' + new Date().getFullYear() + ' PlayCanvas Ltd. All rights reserved.',
    ' */'
].join('\n');

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
};
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
};

export default [{
    input: 'src/index.js',
    output: {
        banner: notice,
        file: 'build/playcanvas.js',
        format: 'umd',
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
        })
    ]
}, {
    input: 'src/index.js',
    output: {
        banner: notice,
        file: 'build/playcanvas.dbg.js',
        format: 'umd',
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
        })
    ]
}, {
    input: 'src/index.js',
    output: {
        banner: notice,
        file: 'build/playcanvas.prf.js',
        format: 'umd',
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
        })
    ]
}, {
    input: 'extras/index.js',
    output: {
        banner: notice,
        file: 'build/playcanvas-extras.js',
        format: 'umd',
        name: 'pcx'
    }
}];
