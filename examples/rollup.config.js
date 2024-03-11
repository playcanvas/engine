import * as fs from 'node:fs';
import fse from 'fs-extra';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { execSync } from 'node:child_process';

// 1st party Rollup plugins
import alias from '@rollup/plugin-alias';
import commonjs from "@rollup/plugin-commonjs";
import replace from '@rollup/plugin-replace';
import resolve from "@rollup/plugin-node-resolve";
import terser from '@rollup/plugin-terser';

// engine rollup utils
import { buildTarget } from '../utils/rollup-build-target.mjs';
import { scriptTargetEs6 } from '../utils/rollup-script-target-es6.mjs';

// util functions
import { isModuleWithExternalDependencies } from './utils.mjs';

/** @typedef {import('rollup').RollupOptions} RollupOptions */
/** @typedef {import('rollup').Plugin} RollupPlugin */

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

    // TODO: fflate will not be needed once extras module is rolled up
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

/**
 * @param {string} name - The timer name.
 * @returns {RollupPlugin} The plugin.
 */
function timeStart(name) {
    return {
        name: 'time-start',
        buildStart() {
            console.time(name);
        }
    };
}

/**
 * @param {string} name - The timer name.
 * @returns {RollupPlugin} The plugin.
 */
function timeEnd(name) {
    return {
        name: 'time-end',
        writeBundle() {
            console.timeEnd(name);
        }
    };
}

/**
 * @param {RollupPlugin} plugin - The Rollup plugin.
 * @param {string} src - File or path to watch.
 */
function watch(plugin, src) {
    const srcStats = fs.statSync(src);
    if (srcStats.isFile()) {
        plugin.addWatchFile(path.resolve(__dirname, src));
        return;
    }
    const filesToWatch = fs.readdirSync(src);
    for (const file of filesToWatch) {
        const fullPath = path.join(src, file);
        const stats = fs.statSync(fullPath);
        if (stats.isFile()) {
            plugin.addWatchFile(path.resolve(__dirname, fullPath));
        } else if (stats.isDirectory()) {
            watch(plugin, fullPath);
        }
    }
}

/**
 * This plugin copies static files from source to destination.
 *
 * @param {STATIC_FILES} targets - Array of source and destination objects.
 * @returns {RollupPlugin} The plugin.
 */
function copyStaticFiles(targets) {
    return {
        name: 'copy-and-watch',
        load() {
            return 'console.log("This temp file is created when copying static files, it should be removed during the build process.");';
        },
        buildStart() {
            if (NODE_ENV === 'development') {
                targets.forEach((target) => {
                    watch(this, target.src);
                });
            }
        },
        generateBundle() {
            targets.forEach((target) => {
                fse.copySync(target.src, target.dest, { overwrite: true });
            });
        },
        writeBundle() {
            fs.unlinkSync('dist/copy.tmp');
        }
    };
}

/**
 * This plugin builds the standalone html files.
 *
 * @returns {RollupPlugin} The plugin.
 */
function buildAndWatchStandaloneExamples() {
    return {
        name: 'build-and-watch-standalone-examples',
        buildStart() {
            if (NODE_ENV === 'development') {
                watch(this, 'iframe/example.html');
                watch(this, 'scripts/standalone-html.mjs');
                watch(this, 'src/examples');
            }
        },
        generateBundle() {
            const cmd = `cross-env NODE_ENV=${NODE_ENV} ENGINE_PATH=${ENGINE_PATH} npm run build:standalone`;
            console.log("\x1b[32m%s\x1b[0m", cmd);
            execSync(cmd);
        }
    };
}

function getEngineTargets() {
    const targets = [
        // Outputs: dist/iframe/playcanvas-extras.mjs
        scriptTargetEs6('pcx', '../extras/index.js', 'dist/iframe/playcanvas-extras.mjs')
    ];
    if (ENGINE_PATH) {
        return targets;
    }
    if (NODE_ENV === 'production') {
        // Outputs: dist/iframe/playcanvas.mjs
        targets.push(buildTarget('release', 'es6', '../src/index.js', 'dist/iframe'));
    }
    if (NODE_ENV === 'production' || NODE_ENV === 'development') {
        // Outputs: dist/iframe/playcanvas.dbg.mjs
        targets.push(buildTarget('debug', 'es6', '../src/index.js', 'dist/iframe'));
    }
    if (NODE_ENV === 'production' || NODE_ENV === 'profiler') {
        // Outputs: dist/iframe/playcanvas.prf.mjs
        targets.push(buildTarget('profiler', 'es6', '../src/index.js', 'dist/iframe'));
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
            timeStart('examples'),
            buildAndWatchStandaloneExamples(),
            copyStaticFiles(STATIC_FILES),
            timeEnd('examples')
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
            timeStart('site'),
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
            (NODE_ENV === 'production' && terser()),
            timeEnd('site')
        ]
    },
    ...getEngineTargets()
];
