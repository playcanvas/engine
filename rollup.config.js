import babel from '@rollup/plugin-babel';
import replace from '@rollup/plugin-replace';
import strip from '@rollup/plugin-strip';
import { createFilter } from '@rollup/pluginutils';
import dts from 'rollup-plugin-dts';
import jscc from 'rollup-plugin-jscc';
import { terser } from 'rollup-plugin-terser';
import { version } from './package.json';
import { visualizer } from 'rollup-plugin-visualizer';

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
            if (!filter(id)) return undefined;
            return {
                code: code.replace(/ {2}/g, '\t'),
                map: null
            };
        }
    };
}

function shaderChunks(removeComments) {
    const filter = createFilter([
        '**/*.vert.js',
        '**/*.frag.js'
    ], []);

    return {
        transform(code, id) {
            if (!filter(id)) return undefined;

            code = code.replace(/\/\* glsl \*\/\`((.|\r|\n)*)\`/, (match, glsl) => {

                // Remove carriage returns
                glsl = glsl.replace(/\r/g, '');

                // 4 spaces to tabs
                glsl = glsl.replace(/ {4}/g, '\t');

                if (removeComments) {
                    // Remove comments
                    glsl = glsl.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');

                    // Trim all whitespace from line endings
                    glsl = glsl.split('\n').map(line => line.trimEnd()).join('\n');

                    // Restore final new line
                    glsl += '\n';

                    // Comment removal can leave an empty line so condense 2 or more to 1
                    glsl = glsl.replace(/\n{2,}/g, '\n');
                }

                // Remove new line character at the start of the string
                if (glsl.length > 1 && glsl[0] === '\n') {
                    glsl = glsl.substr(1);
                }

                return JSON.stringify(glsl);
            });

            return {
                code: code,
                map: null
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
                    ie: '11'
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

const stripFunctions = [
    'Debug.assert',
    'Debug.deprecated',
    'Debug.warn',
    'Debug.warnOnce',
    'Debug.error',
    'Debug.errorOnce',
    'Debug.log',
    'Debug.logOnce',
    'Debug.trace',
    'DebugHelper.setName',
    'DebugGraphics.pushGpuMarker',
    'DebugGraphics.popGpuMarker',
    'WorldClustersDebug.render'
];

// buildType is: 'debug', 'release', 'profile', 'min'
// moduleFormat is: 'es5', 'es6'
function buildTarget(buildType, moduleFormat) {
    const banner = {
        debug: ' (DEBUG PROFILER)',
        release: '',
        profile: ' (PROFILER)'
    };

    const outputPlugins = {
        release: [],
        min: [
            terser()
        ]
    };

    if (process.env.treemap) {
        outputPlugins.min.push(visualizer({
            brotliSize: true,
            gzipSize: true
        }));
    }

    const outputFile = {
        debug: 'build/playcanvas.dbg',
        release: 'build/playcanvas',
        profile: 'build/playcanvas.prf',
        min: 'build/playcanvas.min'
    };

    const outputExtension = {
        es5: '.js',
        es6: '.mjs'
    };

    const outputFormat = {
        es5: 'umd',
        es6: 'es'
    };

    const outputOptions = {
        banner: getBanner(banner[buildType] || banner.release),
        plugins: outputPlugins[buildType || outputPlugins.release],
        file: `${outputFile[buildType]}${outputExtension[moduleFormat]}`,
        format: outputFormat[moduleFormat],
        indent: '\t',
        name: 'pc'
    };

    const jsccOptions = {
        debug: {
            values: {
                _DEBUG: 1,
                _PROFILER: 1
            },
            keepLines: true
        },
        release: {
            values: { }
        },
        profile: {
            values: {
                _PROFILER: 1
            },
            keepLines: true
        }
    };

    const stripOptions = {
        debug: {
            functions: []
        },
        release: {
            functions: stripFunctions
        }
    };

    const babelOptions = {
        es5: es5Options,
        es6: moduleOptions
    };

    const result = {
        input: 'src/index.js',
        output: outputOptions,
        plugins: [
            jscc(jsccOptions[buildType] || jsccOptions.release),
            shaderChunks(buildType === 'release' || buildType === 'min'),
            replace({
                values: {
                    __REVISION__: revision,
                    __CURRENT_SDK_VERSION__: version
                },
                preventAssignment: true
            }),
            strip(stripOptions[buildType] || stripOptions.release),
            babel(babelOptions[moduleFormat]),
            spacesToTabs()
        ]
    };

    return result;
}

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
            spacesToTabs()
        ]
    };
}

const target_extras = [
    scriptTarget('pcx', 'extras/index.js', 'build/playcanvas-extras.js'),
    scriptTarget('VoxParser', 'scripts/parsers/vox-parser.mjs')
];

const target_types = {
    input: 'types/index.d.ts',
    output: [{
        file: 'build/playcanvas.d.ts',
        footer: 'export as namespace pc;',
        format: 'es'
    }],
    plugins: [
        dts()
    ]
};

let targets;

if (process.env.target) { // Build a specific target
    switch (process.env.target.toLowerCase()) {
        case 'es5':      targets = [buildTarget('release', 'es5'), buildTarget('min', 'es5')]; break;
        case 'es6':      targets = [buildTarget('release', 'es6')]; break;
        case 'debug':    targets = [buildTarget('debug', 'es5')]; break;
        case 'profiler': targets = [buildTarget('profile', 'es5')]; break;
        case 'types':    targets = [target_types]; break;
    }
} else if (process.env.buildType && process.env.buildFormat) {
    targets = [buildTarget(process.env.buildType, process.env.buildFormat)];
} else { // Build all targets
    targets = [
        buildTarget('release', 'es5'),
        buildTarget('min', 'es5'),
        buildTarget('release', 'es6'),
        buildTarget('debug', 'es5'),
        buildTarget('profile', 'es5'),
        ...target_extras
    ];
}

export default targets;
