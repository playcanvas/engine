import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import terser from '@rollup/plugin-terser';

import { exampleMetaData } from './cache/metadata.mjs';
import { copyStatic } from './utils/plugins/rollup-copy-static.mjs';
import { isModuleWithExternalDependencies } from './utils/utils.mjs';
import { treeshakeIgnore } from '../utils/plugins/rollup-treeshake-ignore.mjs';
import { buildTarget } from '../utils/rollup-build-target.mjs';
import { buildHtml } from './utils/plugins/rollup-build-html.mjs';
import { removePc } from './utils/plugins/rollup-remove-pc.mjs';

/** @import { Plugin } from 'rollup' */

const NODE_ENV = process.env.NODE_ENV ?? '';
const ENGINE_PATH = !process.env.ENGINE_PATH && NODE_ENV === 'development' ?
    '../src/index.js' : process.env.ENGINE_PATH ?? '';

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

const checkAppEngine = () => {
    // types
    if (!fs.existsSync('../build/playcanvas.d.ts')) {
        const cmd = 'npm run build target:types --prefix ../';
        console.log('\x1b[32m%s\x1b[0m', cmd);
        execSync(cmd);
    }
};

/**
 * @param {object} data - The example data.
 * @param {string} data.categoryKebab - The category kebab name.
 * @param {string} data.exampleNameKebab - The example kebab name.
 * @param {string} data.path - The path to the example directory.
 * @returns {{ input: string, output: string, plugins?: Plugin[] }[]} The targets.
 */
const getExampleTargets = ({ categoryKebab, exampleNameKebab, path }) => {
    const name = `${categoryKebab}_${exampleNameKebab}`;
    const targets = [];
    const dir = fs.readdirSync(path);
    const files = [];
    for (let i = 0; i < dir.length; i++) {
        const file = dir[i];
        if (!/\.(?:mjs|js)$/.test(file)) {
            continue;
        }
        if (!file.startsWith(`${exampleNameKebab}.`)) {
            continue;
        }
        files.push(file.replace(`${exampleNameKebab}.`, ''));
    }
    if (!files.includes('controls.mjs')) {
        files.push('controls.mjs');
    }

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const input = `${path}/${exampleNameKebab}.${file}`;
        const output = `dist/iframe/${name}.${file}`;
        if (file === 'controls.mjs') {
            targets.push({
                input: fs.existsSync(input) ? input : 'templates/controls.mjs',
                output,
                plugins: [
                    removePc()
                ]
            });
            continue;
        }

        if (file === 'example.mjs') {
            targets.push({
                input,
                output,
                plugins: [
                    removePc(),
                    buildHtml({
                        categoryKebab,
                        exampleNameKebab,
                        files,
                        enginePath: ENGINE_PATH,
                        nodeEnv: NODE_ENV
                    })
                ]
            });
            continue;
        }

        targets.push({
            input,
            output
        });
    }
    return targets;
};

const getEngineTargets = () => {
    // Checks for types and engien for app building
    checkAppEngine();

    const targets = [];
    if (ENGINE_PATH) {
        return targets;
    }
    if (NODE_ENV === 'production') {
        // Outputs: dist/iframe/playcanvas.mjs
        targets.push(
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
        targets.push(
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
        targets.push(
            ...buildTarget({
                moduleFormat: 'esm',
                buildType: 'profiler',
                bundleState: 'bundled',
                input: '../src/index.js',
                dir: 'dist/iframe'
            })
        );
    }
    return targets;
};

const STATIC_FILES = [
    // static main page src
    { src: './src/static', dest: 'dist/' },

    // static iframe src
    { src: './iframe', dest: 'dist/iframe' },

    // assets used in examples
    { src: './assets', dest: 'dist/static/assets/', once: true },

    // thumbnails used in examples
    { src: './thumbnails', dest: 'dist/thumbnails/', once: true },

    // external libraries used in examples
    { src: './src/lib', dest: 'dist/static/lib/', once: true },

    // engine scripts
    { src: '../scripts', dest: 'dist/static/scripts/' },

    // playcanvas engine types
    { src: '../build/playcanvas.d.ts', dest: 'dist/playcanvas.d.ts' },

    // playcanvas observer
    {
        src: './node_modules/@playcanvas/observer/dist/index.mjs',
        dest: 'dist/iframe/playcanvas-observer.mjs',
        once: true
    },

    // monaco loader
    { src: './node_modules/monaco-editor/min/vs', dest: 'dist/modules/monaco-editor/min/vs', once: true },

    // fflate (for when using ENGINE_PATH)
    { src: '../node_modules/fflate/esm/', dest: 'dist/modules/fflate/esm', once: true },

    // engine path
    ...getEnginePathFiles()
];

export default [
    ...exampleMetaData.flatMap((data) => {
        return getExampleTargets(data).map((target) => {
            return {
                input: target.input,
                output: {
                    file: target.output,
                    format: 'esm'
                },
                context: 'this',
                treeshake: 'smallest',
                external: [
                    'playcanvas',
                    'examples/files',
                    'examples/observer',
                    'examples/utils'
                ],
                plugins: target.plugins
            };
        });
    }),
    {
        // used as a placeholder to copy static files
        input: 'src/static/index.html',
        output: {
            file: 'cache/output.tmp'
        },
        watch: {
            skipWrite: true
        },
        treeshake: false,
        plugins: [
            copyStatic(NODE_ENV, STATIC_FILES)
        ]
    },
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
    },
    ...getEngineTargets()
];
