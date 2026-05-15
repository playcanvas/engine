import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import esbuild from 'esbuild';
import { build as viteBuild } from 'vite';

import { buildTarget } from '../utils/esbuild-build-target.mjs';
import { revision, version } from '../utils/rollup-version-revision.mjs';
import { buildTypes } from '../utils/types-build-target.mjs';
import {
    BUILD_TYPES,
    EXAMPLE_TARGET,
    EXAMPLE_TEMPLATE,
    EXTERNAL_LOCAL,
    IFRAME_DIR,
    STATIC_TARGETS,
    TARGET,
    copyFile,
    copyTargets,
    exists,
    getEnginePath,
    getEnginePathInfo,
    getExampleTargets,
    slash,
    transformSource,
    writeExampleHtml,
    writeShareHtml
} from './utils/build-shared.mjs';
import { createdLog, failedLog, startLog } from './utils/log.mjs';

const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
        help: { type: 'boolean', short: 'h' }
    },
    allowPositionals: false
});

const NODE_ENV = process.env.NODE_ENV ?? '';
const ENGINE_PATH = getEnginePath(NODE_ENV);
const ENGINE_OUTPUT = {
    rel: 'playcanvas.mjs',
    dbg: 'playcanvas.dbg.mjs',
    prf: 'playcanvas.prf.mjs'
};
const USAGE = `Usage: node build.mjs [options]

Options:
  --help, -h`;

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

const writeSources = async (sources) => {
    await Promise.all(sources.map(async ({ src, dest }) => {
        await fs.promises.mkdir(path.dirname(dest), { recursive: true });
        const source = await fs.promises.readFile(src, 'utf8');
        await fs.promises.writeFile(dest, transformSource(source));
    }));
};

const urlExternalPlugin = () => {
    return {
        name: 'url-external',
        setup(build) {
            build.onResolve({ filter: /^https?:\/\// }, args => ({
                path: args.path,
                external: true
            }));
        }
    };
};

const exampleOptions = (entryPoints, external) => ({
    entryPoints,
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: EXAMPLE_TARGET,
    outdir: IFRAME_DIR,
    outExtension: {
        '.js': '.mjs'
    },
    external,
    plugins: [
        urlExternalPlugin()
    ],
    logLevel: 'warning'
});

const buildExampleJs = async () => {
    const { local } = getExampleTargets(NODE_ENV);
    if (Object.keys(local).length) {
        await timed('src/examples modules', `${IFRAME_DIR} modules`, () => esbuild.build(exampleOptions(local, EXTERNAL_LOCAL)));
    }
};

const buildExampleSupport = async () => {
    const { sources, assets, html, share } = getExampleTargets(NODE_ENV);
    const tasks = [
        timed('src/examples sources', `${IFRAME_DIR} source files`, () => writeSources(sources)),
        timed('src/examples assets', `${IFRAME_DIR} assets`, () => copyTargets(assets)),
        timed(EXAMPLE_TEMPLATE, `${IFRAME_DIR} html`, () => Promise.all(html.map(({ item, files }) => writeExampleHtml(item, files, {
            nodeEnv: NODE_ENV,
            enginePath: ENGINE_PATH
        })))),
        NODE_ENV === 'production' ? timed('templates/share.html', 'dist/share pages', () => Promise.all(share.map(writeShareHtml))) : null
    ];
    await Promise.all(tasks.filter(Boolean));
};

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

const includeEngine = (type) => {
    return (type === 'rel' && NODE_ENV === 'production') ||
        (type === 'dbg' && (NODE_ENV === 'production' || NODE_ENV === 'development')) ||
        (type === 'prf' && (NODE_ENV === 'production' || NODE_ENV === 'profiler'));
};

const buildEngine = async () => {
    const tasks = [
        buildExampleTypes()
    ];

    if (ENGINE_PATH) {
        tasks.push(copyEnginePath());
    } else {
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
    }

    await Promise.all(tasks);
};

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
            treeshake: 'smallest',
            onwarn(warning, warn) {
                if (warning.code === 'MODULE_LEVEL_DIRECTIVE' && warning.message.includes('"use client"')) {
                    return;
                }
                warn(warning);
            }
        }
    }
});

const buildApp = () => timed('src/app/index.mjs', 'dist/index.js', () => viteBuild(appConfig()));

const build = async () => {
    startLog('examples', 'dist');
    const start = performance.now();
    await timed('static files', 'dist static files', () => copyTargets(STATIC_TARGETS, false));
    await Promise.all([
        buildExampleSupport(),
        buildExampleJs(),
        buildEngine(),
        buildApp()
    ]);
    createdLog('dist', performance.now() - start);
};

if (values.help) {
    console.log(USAGE);
} else if (!await exists('cache/metadata.mjs')) {
    console.error('cache/metadata.mjs is missing; run npm run build:metadata first');
    process.exitCode = 1;
} else {
    await build();
}
