import replace from '@rollup/plugin-replace';
import pkg from './package.json';

const execSync = require('child_process').execSync;
const revision = execSync("git rev-parse --short HEAD").toString().trim()
const notice = [
    '/*',
    ' * Playcanvas Engine v' + pkg.version + ' revision ' + revision,
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
        replace({
            __REVISION__: revision,
            __CURRENT_SDK_VERSION__: pkg.version
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
