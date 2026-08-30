import fs from 'node:fs';
import path from 'node:path';

import { build as viteBuild } from 'vite';

import {
    BUILD_TYPES,
    EXAMPLE_TEMPLATE,
    IFRAME_DIR,
    STATIC_TARGETS,
    TARGET,
    copyFile,
    copyTargets,
    getEnginePath,
    getEnginePathInfo,
    getExampleTargets,
    loadExampleMetaData,
    slash,
    transformSource,
    writeExampleHtml,
    writeShareHtml
} from './build-examples.mjs';
import { createdLog, failedLog, startLog } from './log.mjs';
import { buildTarget } from '../../utils/esbuild-build-target.mjs';
import { revision, version } from '../../utils/rollup-version-revision.mjs';
import { buildTypes } from '../../utils/types-build-target.mjs';

/**
 * @import { InlineConfig as ViteConfig, Plugin as VitePlugin } from 'vite'
 * @import { CopyTarget } from './build-examples.mjs'
 */

/**
 * @typedef {ReturnType<typeof viteBuild>} ViteBuildResult
 */

const NODE_ENV = process.env.NODE_ENV ?? '';
const ENGINE_PATH = getEnginePath(NODE_ENV);
const ENGINE_OUTPUT = {
    rel: 'playcanvas.mjs',
    dbg: 'playcanvas.dbg.mjs',
    prf: 'playcanvas.prf.mjs'
};
/**
 * @template T
 * @param {string} input - source label.
 * @param {string} output - output label.
 * @param {() => T | Promise<T>} task - task to time.
 * @returns {Promise<T>} task result.
 */
const timed = (input, output, task) => {
    startLog(input, output);
    const start = performance.now();
    return Promise.resolve(task()).then((result) => {
        createdLog(output, performance.now() - start);
        return result;
    }, (err) => {
        failedLog(output, performance.now() - start);
        throw err;
    });
};

/**
 * @param {CopyTarget[]} sources - source files.
 * @returns {Promise<void>} completion promise.
 */
const writeSources = async (sources) => {
    await Promise.all(sources.map(async ({ src, dest }) => {
        await fs.promises.mkdir(path.dirname(dest), { recursive: true });
        const source = await fs.promises.readFile(src, 'utf8');
        await fs.promises.writeFile(dest, transformSource(source));
    }));
};

/**
 * @returns {Promise<void>} completion promise.
 */
const buildExampleSupport = async () => {
    const { sources, assets, html, share } = getExampleTargets();
    const tasks = [
        timed('src/examples sources', `${IFRAME_DIR} source files`, () => writeSources(sources)),
        timed('src/examples assets', `${IFRAME_DIR} assets`, () => copyTargets(assets)),
        timed(EXAMPLE_TEMPLATE, `${IFRAME_DIR} html`, () => Promise.all(html.map(({ item, files }) => writeExampleHtml(item, files, {
            nodeEnv: NODE_ENV,
            enginePath: ENGINE_PATH
        })))),
        timed('templates/share.html', 'dist/share pages', () => Promise.all(share.map(writeShareHtml)))
    ];
    await Promise.all(tasks);
};

/**
 * @returns {Promise<void>} completion promise.
 */
const buildExampleTypes = async () => {
    await timed('../src/index.js types', `${IFRAME_DIR}/playcanvas.d.ts`, () => buildTypes({
        root: '..',
        dir: IFRAME_DIR
    }));
    await timed(`${IFRAME_DIR}/playcanvas.d.ts`, 'dist/playcanvas.d.ts', () => copyFile({
        src: `${IFRAME_DIR}/playcanvas.d.ts`,
        dest: 'dist/playcanvas.d.ts'
    }));
};

/**
 * @returns {Promise<void>} completion promise.
 */
const copyEnginePath = async () => {
    const info = await getEnginePathInfo(ENGINE_PATH);
    if (info.unpacked) {
        await timed(info.root, `${IFRAME_DIR}/ENGINE_PATH`, () => copyFile({
            src: info.root,
            dest: `${IFRAME_DIR}/ENGINE_PATH`
        }));
        return;
    }
    await timed(info.src, `${IFRAME_DIR}/ENGINE_PATH/index.js`, () => copyFile({
        src: info.src,
        dest: `${IFRAME_DIR}/ENGINE_PATH/index.js`
    }));
};

/**
 * @param {typeof BUILD_TYPES[number]} type - engine build type.
 * @returns {boolean} true if included.
 */
const includeEngine = (type) => {
    return (type === 'rel' && NODE_ENV === 'production') ||
        (type === 'dbg' && (NODE_ENV === 'production' || NODE_ENV === 'development')) ||
        (type === 'prf' && (NODE_ENV === 'production' || NODE_ENV === 'profiler'));
};

/**
 * @returns {Promise<void>} completion promise.
 */
const buildEngine = async () => {
    const tasks = [
        buildExampleTypes()
    ];

    if (ENGINE_PATH) {
        tasks.push(copyEnginePath());
        await Promise.all(tasks);
        return;
    }

    for (let i = 0; i < BUILD_TYPES.length; i++) {
        const buildType = BUILD_TYPES[i];
        if (!includeEngine(buildType)) {
            continue;
        }
        tasks.push(timed('../src/index.js', `${IFRAME_DIR}/${ENGINE_OUTPUT[buildType]}`, () => buildTarget({
            moduleFormat: 'esm',
            buildType,
            preserveModules: false,
            input: '../src/index.js',
            dir: IFRAME_DIR
        })));
    }
    await Promise.all(tasks);
};

/**
 * @returns {VitePlugin} vite plugin.
 */
const treeshakeIgnorePlugin = () => {
    return {
        name: 'treeshake-ignore',
        transform(code, id) {
            if (/@playcanvas\/pcui/.test(slash(id))) {
                return {
                    code,
                    map: null,
                    moduleSideEffects: 'no-treeshake'
                };
            }
            return null;
        }
    };
};

/**
 * @returns {ViteConfig} vite config.
 */
const appConfig = () => ({
    configFile: false,
    root: process.cwd(),
    mode: NODE_ENV || 'production',
    publicDir: false,
    logLevel: 'warn',
    define: {
        'process.env.NODE_ENV': JSON.stringify(NODE_ENV),
        'process.env.VERSION': JSON.stringify(version),
        'process.env.REVISION': JSON.stringify(revision)
    },
    plugins: [
        treeshakeIgnorePlugin()
    ],
    build: {
        emptyOutDir: false,
        outDir: 'dist',
        target: TARGET,
        minify: NODE_ENV === 'production' ? 'esbuild' : false,
        sourcemap: false,
        lib: {
            entry: path.resolve('src/app/index.mjs'),
            name: 'PlayCanvasExamples',
            formats: ['umd'],
            fileName: () => 'index.js'
        },
        rollupOptions: {
            treeshake: true,
            onwarn(warning, warn) {
                if (warning.code === 'MODULE_LEVEL_DIRECTIVE' && warning.message.includes('"use client"')) {
                    return;
                }
                warn(warning);
            }
        }
    }
});

/**
 * @returns {ViteBuildResult} vite build result.
 */
const buildApp = () => timed('src/app/index.mjs', 'dist/index.js', () => viteBuild(appConfig()));

/**
 * @returns {Promise<void>} completion promise.
 */
export const buildProd = async () => {
    await loadExampleMetaData();
    startLog('examples', 'dist');
    const start = performance.now();
    await timed('static files', 'dist static files', () => copyTargets(STATIC_TARGETS, false));
    await Promise.all([
        buildExampleSupport(),
        buildEngine(),
        buildApp()
    ]);
    createdLog('dist', performance.now() - start);
};
