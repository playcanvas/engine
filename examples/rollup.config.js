import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import terser from '@rollup/plugin-terser';

import { exampleMetaData } from './cache/metadata.mjs';
import { copy } from './utils/plugins/rollup-copy.mjs';
import { isModuleWithExternalDependencies } from './utils/utils.mjs';
import { treeshakeIgnore } from '../utils/plugins/rollup-treeshake-ignore.mjs';
import { buildTarget } from '../utils/rollup-build-target.mjs';
import { buildHtml } from './utils/plugins/rollup-build-html.mjs';
import { buildShare } from './utils/plugins/rollup-build-share.mjs';
import { removePc } from './utils/plugins/rollup-remove-pc.mjs';

/** @import { RollupOptions } from 'rollup' */

const NODE_ENV = process.env.NODE_ENV ?? '';
const ENGINE_PATH = !process.env.ENGINE_PATH && NODE_ENV === 'development' ?
    '../src/index.js' : process.env.ENGINE_PATH ?? '';

/**
 * Get the engine path files.
 *
 * @returns {{ src: string, dest: string }[]} - The engine path files.
 */
const getEnginePathFiles = () => {
    if (!ENGINE_PATH) {
        return [];
    }

    const src = path.resolve(ENGINE_PATH);
    const content = fs.readFileSync(src, 'utf8');
    const isUnpacked = isModuleWithExternalDependencies(content);
    if (isUnpacked) {
        const srcDir = path.dirname(src);
        const dest = 'dist/iframe/ENGINE_PATH';
        return [{ src: srcDir, dest }];
    }

    // packed module builds
    const dest = 'dist/iframe/ENGINE_PATH/index.js';
    return [{ src, dest }];
};

const STATIC_FILES = [
    // static main page src
    { src: './src/static', dest: 'dist/' },

    // static iframe src
    { src: './iframe', dest: 'dist/iframe' },

    // assets used in examples
    { src: './assets', dest: 'dist/static/assets/' },

    // thumbnails used in examples
    { src: './thumbnails', dest: 'dist/thumbnails/' },

    // external libraries used in examples
    { src: './src/lib', dest: 'dist/static/lib/' },

    // engine scripts
    { src: '../scripts', dest: 'dist/static/scripts/' },

    // playcanvas engine types
    { src: '../build/playcanvas.d.ts', dest: 'dist/playcanvas.d.ts' },

    // playcanvas observer
    {
        src: './node_modules/@playcanvas/observer/dist/index.mjs',
        dest: 'dist/iframe/playcanvas-observer.mjs'
    },

    // monaco loader
    { src: './node_modules/monaco-editor/min/vs', dest: 'dist/modules/monaco-editor/min/vs' },

    // fflate (for when using ENGINE_PATH)
    { src: '../node_modules/fflate/esm/', dest: 'dist/modules/fflate/esm' },

    // engine path
    ...getEnginePathFiles()
];

/**
 * Rollup option for static files.
 *
 * @param {object} item - The static files.
 * @param {string} item.src - The source directory.
 * @param {string} item.dest - The destination directory.
 * @param {boolean} [item.once] - Copy only once.
 * @returns {RollupOptions} - The rollup option.
 */
const staticRollupOption = (item) => {
    return {
        input: 'templates/placeholder.html',
        output: {
            file: 'cache/output.tmp'
        },
        watch: {
            skipWrite: true
        },
        treeshake: false,
        plugins: [
            copy([item], NODE_ENV === 'development')
        ]
    };
};

/**
 * Rollup options for each example.
 *
 * @param {object} data - The example data.
 * @param {string} data.categoryKebab - The category kebab name.
 * @param {string} data.exampleNameKebab - The example kebab name.
 * @param {string} data.path - The path to the example directory.
 * @returns {RollupOptions[]} - The rollup options.
 */
const exampleRollupOptions = ({ categoryKebab, exampleNameKebab, path }) => {
    /** @type {RollupOptions[]} */
    const options = [];

    const name = `${categoryKebab}_${exampleNameKebab}`;
    const dir = fs.readdirSync(path);
    const files = [];
    for (let i = 0; i < dir.length; i++) {
        const file = dir[i];
        if (!file.startsWith(`${exampleNameKebab}.`)) {
            continue;
        }
        files.push(file.replace(`${exampleNameKebab}.`, ''));
    }
    if (!files.includes('controls.mjs')) {
        files.push('controls.mjs');
    }

    fs.mkdirSync('dist/iframe', { recursive: true });
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const input = `${path}/${exampleNameKebab}.${file}`;
        const output = `dist/iframe/${name}.${file}`;
        if (file === 'controls.mjs') {
            options.push({
                input: fs.existsSync(input) ? input : 'templates/controls.mjs',
                output: {
                    file: output,
                    format: 'esm'
                },
                context: 'this',
                external: [
                    'playcanvas',
                    'examples/files',
                    'examples/observer',
                    'examples/utils'
                ],
                plugins: [
                    removePc(),
                    NODE_ENV === 'production' && buildShare({
                        categoryKebab,
                        exampleNameKebab
                    })
                ]
            });
            continue;
        }

        if (file === 'example.mjs') {
            options.push({
                input,
                output: {
                    file: output,
                    format: 'esm'
                },
                context: 'this',
                external: [
                    'playcanvas',
                    'examples/files',
                    'examples/observer',
                    'examples/utils'
                ],
                plugins: [
                    removePc(),
                    buildHtml({
                        categoryKebab,
                        exampleNameKebab,
                        files,
                        engineType: ENGINE_PATH ?
                            'development' : NODE_ENV === 'development' ?
                                'debug' : undefined
                    })
                ]
            });
            continue;
        }

        if (/\.(?:mjs|js)$/.test(file)) {
            options.push({
                input,
                output: {
                    file: output,
                    format: 'esm'
                },
                context: 'this',
                external: [
                    'playcanvas'
                ]
            });
            continue;
        }

        options.push(staticRollupOption({
            src: input,
            dest: output
        }));
    }
    return options;
};

/**
 * Rollup options for the engine.
 *
 * @returns {RollupOptions[]} - The rollup options;
 */
const engineRollupOptions = () => {
    // Checks for types for app building
    if (!fs.existsSync('../build/playcanvas.d.ts')) {
        const cmd = 'npm run build target:types --prefix ../';
        console.log('\x1b[32m%s\x1b[0m', cmd);
        execSync(cmd);
    }

    /** @type {RollupOptions[]} */
    const options = [];
    if (ENGINE_PATH) {
        return options;
    }
    if (NODE_ENV === 'production') {
        // Outputs: dist/iframe/playcanvas.mjs
        options.push(
            ...buildTarget({
                moduleFormat: 'esm',
                buildType: 'release',
                bundleState: 'bundled',
                input: '../src/index.js',
                dir: 'dist/iframe'
            })
        );
    }
    if (NODE_ENV === 'production' || NODE_ENV === 'development') {
        // Outputs: dist/iframe/playcanvas.dbg.mjs
        options.push(
            ...buildTarget({
                moduleFormat: 'esm',
                buildType: 'debug',
                bundleState: 'bundled',
                input: '../src/index.js',
                dir: 'dist/iframe'
            })
        );
    }
    if (NODE_ENV === 'production' || NODE_ENV === 'profiler') {
        // Outputs: dist/iframe/playcanvas.prf.mjs
        options.push(
            ...buildTarget({
                moduleFormat: 'esm',
                buildType: 'profiler',
                bundleState: 'bundled',
                input: '../src/index.js',
                dir: 'dist/iframe'
            })
        );
    }
    return options;
};

export default [
    ...exampleMetaData.flatMap(data => exampleRollupOptions(data)),
    ...engineRollupOptions(),
    ...STATIC_FILES.map(item => staticRollupOption(item)),
    {
        // A debug build is ~2.3MB and a release build ~0.6MB
        input: 'src/app/index.mjs',
        output: {
            dir: 'dist',
            format: 'umd'
        },
        treeshake: 'smallest',
        plugins: [
            // @ts-ignore
            commonjs(),
            treeshakeIgnore([/@playcanvas\/pcui/g]), // ignore PCUI treeshake
            // @ts-ignore
            resolve(),
            // @ts-ignore
            replace({
                values: {
                    'process.env.NODE_ENV': JSON.stringify(NODE_ENV) // for REACT bundling
                },
                preventAssignment: true
            }),
            // @ts-ignore
            NODE_ENV === 'production' && terser()
        ]
    }
];
