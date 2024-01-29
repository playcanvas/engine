import date from 'date-and-time';
import * as fs from 'node:fs';
import fse from 'fs-extra';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { exec } from 'node:child_process';

// 1st party Rollup plugins
import alias from '@rollup/plugin-alias';
import commonjs from "@rollup/plugin-commonjs";
import replace from '@rollup/plugin-replace';
import resolve from "@rollup/plugin-node-resolve";
import terser from '@rollup/plugin-terser';

import { buildTarget } from '../utils/rollup-build-target.mjs';
import { scriptTarget } from '../utils/rollup-script-target.mjs';

/** @typedef {import('rollup').RollupOptions} RollupOptions */
/** @typedef {import('rollup').Plugin} RollupPlugin */

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PCUI_PATH = process.env.PCUI_PATH || 'node_modules/@playcanvas/pcui';
const PCUI_REACT_PATH = path.resolve(PCUI_PATH, 'react');
const PCUI_STYLES_PATH = path.resolve(PCUI_PATH, 'styles');

const staticFiles = [
    { src: './src/static', dest: 'dist/' },
    { src: './src/iframe/arkit.png', dest: 'dist/iframe/arkit.png' },
    { src: './src/example.css', dest: 'dist/iframe/example.css' },
    { src: './src/pathes.js', dest: 'dist/iframe/pathes.js' },
    { src: './src/lib', dest: 'dist/static/lib/' },
    { src: './assets', dest: 'dist/static/assets/' },
    { src: '../scripts', dest: 'dist/static/scripts/' },
    { src: '../build/playcanvas.d.ts', dest: 'dist/playcanvas.d.ts' },
    { src: './node_modules/@playcanvas/observer/dist/index.js', dest: 'dist/iframe/playcanvas-observer.js' },

    // Note: destination folder is 'modules' as 'node_modules' are automatically excluded by git pages
    { src: './node_modules/monaco-editor/min/vs', dest: 'dist/modules/monaco-editor/min/vs' }
];

// ^ = beginning of line
// \s* = whitespace
// $ = end of line
// .* = any character
const regexpExportStarFrom =  /^\s*export\s*\*\s*from\s*.+\s*;\s*$/gm;
const regexpExportFrom     =  /^\s*export\s*{.*}\s*from\s*.+\s*;\s*$/gm;
const regexpImport         =  /^\s*import\s*.+\s*;\s*$/gm;
/**
 * If one of this RegExp's match, it's likely an ESM with external dependencies.
 * @example
 * isModuleWithExternalDependencies(`
 *    // Testing variants:
 *    export * from './index.mjs';
 *    export { Ray } from './core/shape/ray.js';
 *    import './polyfill/OESVertexArrayObject.js';
 *`);
 * @param {string} content - The file content to test.
 * @returns {boolean} Whether content is a module.
 */
function isModuleWithExternalDependencies(content) {
    const a = regexpExportStarFrom.test(content);
    const b = regexpExportFrom.test(content);
    const c = regexpImport.test(content);
    // console.log('isModuleWithExternalDependencies', { a, b, c });
    return a || b || c;
}

const { NODE_ENV = '' } = process.env;
let { ENGINE_PATH = '' } = process.env;

// If we don't set ENGINE_PATH and NODE_ENV is 'development', we use ../src/index.js, which
// requires no additional build shells.
if (!ENGINE_PATH && NODE_ENV === 'development') {
    ENGINE_PATH = '../src/index.js';
}

if (ENGINE_PATH) {
    const src = path.resolve(ENGINE_PATH);
    const content = fs.readFileSync(src, 'utf8');
    const copyDir = isModuleWithExternalDependencies(content);
    if (copyDir) {
        // Copy entire folder for MJS versions with external dependencies
        const srcDir = path.dirname(src);
        const dest = 'dist/iframe/ENGINE_PATH';
        staticFiles.push({ src: srcDir, dest });
    } else {
        // This can be both UMD/ESM as a single file
        const entryPoint = ENGINE_PATH.split("/").pop();
        const dest = 'dist/iframe/ENGINE_PATH/' + entryPoint;
        staticFiles.push({ src, dest });
    }
}

function timestamp() {
    return {
        name: 'timestamp',
        writeBundle() {
            console.log("\x1b[32m", "Finished at: " + date.format(new Date(), 'HH:mm:ss'));
        }
    };
}

/**
 * @param {import('rollup').Plugin} plugin - The Rollup plugin.
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
 * @param {staticFiles} targets - Array of source and destination objects.
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
                watch(this, 'scripts/generate-standalone-files.mjs');
                watch(this, 'src/examples');
            }
        },
        generateBundle() {
            const cmd = `cross-env NODE_ENV=${NODE_ENV} ENGINE_PATH=${ENGINE_PATH} npm run build:standalone`;
            console.log(cmd);
            exec(cmd);
        }
    };
}

// define supported module overrides
const aliasEntries = {
    '@playcanvas/pcui/react': PCUI_REACT_PATH,
    '@playcanvas/pcui/styles': PCUI_STYLES_PATH
};

/** @type {RollupOptions[]} */
const targets = [
    {
        // A debug build is ~2.3MB and a release build ~0.6MB
        input: 'src/app/index.mjs',
        output: {
            dir: 'dist',
            format: 'umd'
        },
        plugins: [
            alias({ entries: aliasEntries }),
            commonjs(),
            resolve(),
            replace({
                values: {
                    'process.env.NODE_ENV': JSON.stringify(NODE_ENV)
                },
                preventAssignment: true
            }),
            (NODE_ENV === 'production' && terser()),
            timestamp()
        ]
    },
    {
        input: 'src/static/index.html',
        output: {
            file: `dist/copy.tmp`
        },
        plugins: [
            copyStaticFiles(staticFiles),
            buildAndWatchStandaloneExamples(),
            timestamp()
        ]
    },
    scriptTarget('pcx', '../extras/index.js', 'dist/iframe/playcanvas-extras.js')
];

// We skip building PlayCanvas ourselves when ENGINE_PATH is given.
// In that case we have a watcher which copies all necessary files.
if (ENGINE_PATH === '') {
    /** @type {buildTarget} */
    const pushTarget = (...args) => {
        targets.push(buildTarget(...args));
    };
    if (NODE_ENV === 'production') {
        // Outputs: dist/iframe/playcanvas.js
        pushTarget('release', 'es5', '../src/index.js', 'dist/iframe');
        // Outputs: dist/iframe/playcanvas.dbg.js
        pushTarget('debug', 'es5', '../src/index.js', 'dist/iframe');
        // Outputs: dist/iframe/playcanvas.prf.js
        pushTarget('profiler', 'es5', '../src/index.js', 'dist/iframe');
    } else if (NODE_ENV === 'development') {
        // Outputs: dist/iframe/playcanvas.dbg.js
        pushTarget('debug', 'es5', '../src/index.js', 'dist/iframe');
    } else if (NODE_ENV === 'profiler') {
        // Outputs: dist/iframe/playcanvas.prf.js
        pushTarget('profiler', 'es5', '../src/index.js', 'dist/iframe');
    } else {
        console.warn("NODE_ENV is neither production, development nor profiler.");
    }
}

export default targets;
