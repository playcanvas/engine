import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// 1st party Rollup plugins
import alias from '@rollup/plugin-alias';
import commonjs from "@rollup/plugin-commonjs";
import replace from '@rollup/plugin-replace';
import resolve from "@rollup/plugin-node-resolve";
import terser from '@rollup/plugin-terser';

// custom plugins
import { copyStatic } from './utils/plugins/rollup-copy-static.mjs';
import { generateStandalone } from './utils/plugins/rollup-generate-standalone.mjs';

// engine rollup utils
import { buildTarget } from '../utils/rollup-build-target.mjs';

// util functions
import { isModuleWithExternalDependencies } from './utils/utils.mjs';

const NODE_ENV = process.env.NODE_ENV ?? '';
const ENGINE_PATH = !process.env.ENGINE_PATH && NODE_ENV === 'development' ?
    '../src/index.js' :
    process.env.ENGINE_PATH ?? '';

const PCUI_PATH = process.env.PCUI_PATH || 'node_modules/@playcanvas/pcui';
const PCUI_REACT_PATH = path.resolve(PCUI_PATH, 'react');
const PCUI_STYLES_PATH = path.resolve(PCUI_PATH, 'styles');


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
    { src: './node_modules/@playcanvas/observer/dist/index.mjs', dest: 'dist/iframe/playcanvas-observer.mjs' },

    // modules (N.B. destination folder is 'modules' as 'node_modules' are automatically excluded by git pages)
    { src: './node_modules/monaco-editor/min/vs', dest: 'dist/modules/monaco-editor/min/vs' },

    // fflate (for when using ENGINE_PATH)
    { src: '../node_modules/fflate/esm/', dest: 'dist/modules/fflate/esm' },

    // engine path
    ...getEnginePathFiles()
];

function getEnginePathFiles() {
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
}

function checkAppEngine() {
    // types
    if (!fs.existsSync('../build/playcanvas.d.ts')) {
        const cmd = `npm run build:types --prefix ../`;
        console.log("\x1b[32m%s\x1b[0m", cmd);
        execSync(cmd);
    }

    // engine
    if (!fs.existsSync('../build/playcanvas/src/index.js')) {
        const cmd = `npm run build:esm:release --prefix ../`;
        console.log("\x1b[32m%s\x1b[0m", cmd);
        execSync(cmd);
    }
}

function getEngineTargets() {
    // Checks for types and engien for app building
    checkAppEngine();

    const targets = [];
    if (ENGINE_PATH) {
        return targets;
    }
    if (NODE_ENV === 'production') {
        // Outputs: dist/iframe/playcanvas.mjs
        targets.push(...buildTarget({
            moduleFormat: 'esm',
            buildType: 'release',
            input: '../src/index.js',
            dir: 'dist/iframe',
            skipBundled: true
        }));
    }
    if (NODE_ENV === 'production' || NODE_ENV === 'development') {
        // Outputs: dist/iframe/playcanvas.dbg.mjs
        targets.push(...buildTarget({
            moduleFormat: 'esm',
            buildType: 'debug',
            input: '../src/index.js',
            dir: 'dist/iframe',
            skipBundled: true
        }));
    }
    if (NODE_ENV === 'production' || NODE_ENV === 'profiler') {
        // Outputs: dist/iframe/playcanvas.prf.mjs
        targets.push(...buildTarget({
            moduleFormat: 'esm',
            buildType: 'profiler',
            input: '../src/index.js',
            dir: 'dist/iframe',
            skipBundled: true
        }));
    }
    return targets;
}

export default [
    {
        input: 'src/static/index.html',
        output: {
            file: `dist/copy.tmp`
        },
        plugins: [
            generateStandalone(NODE_ENV, ENGINE_PATH),
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
        plugins: [
            alias({
                entries: {
                    // define supported module overrides
                    '@playcanvas/pcui/react': PCUI_REACT_PATH,
                    '@playcanvas/pcui/styles': PCUI_STYLES_PATH
                }
            }),
            commonjs(),
            resolve(),
            replace({
                values: {
                    'process.env.NODE_ENV': JSON.stringify(NODE_ENV)
                },
                preventAssignment: true
            }),
            (NODE_ENV === 'production' && terser())
        ]
    },
    ...getEngineTargets()
];
