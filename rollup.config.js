import babel from '@rollup/plugin-babel';
import replace from '@rollup/plugin-replace';
import { createFilter } from '@rollup/pluginutils';
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

const babelOptions = {
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
                    "ie": "11"
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

export default [{
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
        babel(babelOptions),
        spacesToTabs()
    ]
}, {
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
        babel(babelOptions),
        spacesToTabs()
    ]
}, {
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
        babel(babelOptions),
        spacesToTabs()
    ]
}, {
    input: 'extras/index.js',
    output: {
        banner: getBanner(''),
        file: 'build/playcanvas-extras.js',
        format: 'umd',
        indent: '\t',
        name: 'pcx'
    },
    plugins: [
        babel(babelOptions),
        spacesToTabs()
    ]
}];
