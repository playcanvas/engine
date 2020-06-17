import glslify from 'rollup-plugin-glslify';
import replace from '@rollup/plugin-replace';
import { version } from './package.json';

const { createFilter } = require('rollup-pluginutils');

const execSync = require('child_process').execSync;
const revision = execSync('git rev-parse --short HEAD').toString().trim()
const notice = [
    '/*',
    ' * Playcanvas Engine v' + version + ' revision ' + revision,
    ' * Copyright 2011-' + new Date().getFullYear() + ' PlayCanvas Ltd. All rights reserved.',
    ' */'
].join('\n');

function shaderChunks() {
    const filter = createFilter([
        '**/*.vert',
        '**/*.frag'
    ], []);

    return {
        transform(code, id) {
            if (!filter(id)) return;

            return {
                code: `export default ${JSON.stringify(code)}; // eslint-disable-line`,
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
