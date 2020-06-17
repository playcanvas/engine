import glslify from 'rollup-plugin-glslify';
import replace from '@rollup/plugin-replace';
import { version } from './package.json';

const execSync = require('child_process').execSync;
const revision = execSync('git rev-parse --short HEAD').toString().trim()
const notice = [
    '/*',
    ' * Playcanvas Engine v' + version + ' revision ' + revision,
    ' * Copyright 2011-' + new Date().getFullYear() + ' PlayCanvas Ltd. All rights reserved.',
    ' */'
].join('\n');

export default [{
    input: 'src/index.js',
    output: {
        banner: notice,
        file: 'build/playcanvas.js',
        format: 'umd',
        name: 'pc'
    },
    plugins: [
        glslify({
            compress: false
        }),
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
