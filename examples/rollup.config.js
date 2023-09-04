import date from 'date-and-time';
import * as fs from 'node:fs';
import fse from 'fs-extra';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// 1st party Rollup plugins
import alias from '@rollup/plugin-alias';
import commonjs from "@rollup/plugin-commonjs";
import replace from '@rollup/plugin-replace';
import resolve from "@rollup/plugin-node-resolve";
import terser from '@rollup/plugin-terser';

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
    { src: '../build/playcanvas.js', dest: 'dist/iframe/playcanvas.js' },
    { src: '../build/playcanvas.dbg.js', dest: 'dist/iframe/playcanvas.dbg.js' },
    { src: '../build/playcanvas.prf.js', dest: 'dist/iframe/playcanvas.prf.js' },
    { src: '../build/playcanvas-extras.js', dest: 'dist/iframe/playcanvas-extras.js' },
    { src: './node_modules/@playcanvas/observer/dist/index.js', dest: 'dist/iframe/playcanvas-observer.js' },
];

if (process.env.ENGINE_PATH) {
    const src = path.dirname(path.resolve(process.env.ENGINE_PATH));
    const dest = 'dist/iframe/ENGINE_PATH';
    staticFiles.push({ src, dest });
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
 * This plugin copies static files from source to destination.
 *
 * @param {staticFiles} targets - Array of source and destination objects.
 * @returns {RollupPlugin} The plugin.
 */
function copyStaticFiles(targets) {
    function watch(src) {
        const srcStats = fs.statSync(src);
        if (srcStats.isFile()) {
            this.addWatchFile(path.resolve(__dirname, src));
            return;
        }

        const filesToWatch = fs.readdirSync(src);

        for (const file of filesToWatch) {
            const fullPath = path.join(src, file);
            const stats = fs.statSync(fullPath);

            if (stats.isFile()) {
                this.addWatchFile(path.resolve(__dirname, fullPath));

            } else if (stats.isDirectory()) {
                watch.bind(this)(fullPath);
            }
        }
    }
    return {
        name: 'copy-and-watch',
        load() {
            return 'console.log("This temp file is created when copying static files, it should be removed during the build process.");';
        },
        buildStart() {
            if (process.env.NODE_ENV !== 'development') return;
            targets.forEach((target) => {
                watch.bind(this)(target.src, target.dest);
            });
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

// define supported module overrides
const aliasEntries = {
    '@playcanvas/pcui/react': PCUI_REACT_PATH,
    '@playcanvas/pcui/styles': PCUI_STYLES_PATH
};

/** @type {RollupOptions[]} */
const builds = [
    {
        input: 'src/app/index.mjs',
        output: {
            dir: 'dist',
            format: 'es'
        },
        plugins: [
            alias({ entries: aliasEntries }),
            commonjs(),
            resolve(),
            replace({
                values: {
                    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV)
                },
                preventAssignment: true
            }),
            (process.env.NODE_ENV === 'production' && terser()),
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
            timestamp()
        ]
    }
];

export default builds;
