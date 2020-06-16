import replace from '@rollup/plugin-replace';
import license from 'rollup-plugin-license';
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
    input: 'src/playcanvas.js',
    output: {
        file: 'build/playcanvas.js',
        format: 'umd',
        name: 'pc'
    },
    plugins: [
        replace({
            __REVISION__: revision,
            __CURRENT_SDK_VERSION__: pkg.version
        }),
        license({
            banner: {
                content: notice,
                commentStyle: 'none'
            }
        })
    ]
}];
