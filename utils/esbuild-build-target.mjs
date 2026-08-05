import esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'acorn';
import { fileURLToPath } from 'node:url';

import { importValidationPlugin } from './plugins/esbuild-import-validation.mjs';
import {
    applyTransforms,
    createStripTransform,
    transformPipelinePlugin
} from './plugins/esbuild-transform-pipeline.mjs';
import { getBanner } from './rollup-get-banner.mjs';
import { revision, version } from './rollup-version-revision.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const STRIP_FUNCTIONS = [
    'Debug.assert',
    'Debug.assertDeprecated',
    'Debug.assertDestroyed',
    'Debug.call',
    'Debug.deprecated',
    'Debug.warn',
    'Debug.warnOnce',
    'Debug.error',
    'Debug.errorOnce',
    'Debug.log',
    'Debug.logOnce',
    'Debug.removed',
    'Debug.trace',
    'DebugHelper.setName',
    'DebugHelper.setLabel',
    'DebugHelper.setDestroyed',
    'DebugGraphics.toString',
    'DebugGraphics.clearGpuMarkers',
    'DebugGraphics.pushGpuMarker',
    'DebugGraphics.popGpuMarker',
    'WebgpuDebug.validate',
    'WebgpuDebug.memory',
    'WebgpuDebug.internal',
    'WebgpuDebug.end',
    'WebgpuDebug.endShader',
    'WorldClustersDebug.render'
];

const BANNER = {
    dbg: ' (DEBUG)',
    rel: ' (RELEASE)',
    prf: ' (PROFILE)',
    min: ' (RELEASE)'
};

const OUT_PREFIX = {
    dbg: 'playcanvas.dbg',
    rel: 'playcanvas',
    prf: 'playcanvas.prf',
    min: 'playcanvas.min'
};

const EXTERNALS = ['node:worker_threads', 'url'];
const FFLATE = 'fflate';
const TARGET = 'es2020';
const FFLATE_EXPORTS = ['zipSync', 'strToU8'];
const BUNDLE_SECTION_COMMENT = /^\/\/ (?:\.\.\/)?(?:src|node_modules|modules)\/.*\n/gm;
const CLASS_FIELD_SUPPORT = {
    'class-field': true,
    'class-static-field': true
};
const PRUNABLE_IMPORTS = new Set([
    'Debug',
    'DebugGraphics',
    'DebugHelper',
    'WebgpuDebug',
    'WorldClustersDebug',
    'validateUserChunks'
]);

const compactIndent = code => code.replace(/^ +/gm, spaces => spaces.replace(/ {2}/g, '\t'));

const shouldCompactIndent = ({ buildType, sourcemaps }) => {
    return !sourcemaps && (buildType === 'rel' || buildType === 'prf');
};

const parseModule = source => parse(source, {
    ecmaVersion: 'latest',
    sourceType: 'module'
});

const getJSCCOptions = (type) => {
    const base = {
        _CURRENT_SDK_VERSION: version,
        _CURRENT_SDK_REVISION: revision
    };

    return {
        dbg: {
            values: {
                ...base,
                _DEBUG: 1,
                _PROFILER: 1
            },
            keepLines: true
        },
        rel: {
            values: base,
            keepLines: false
        },
        prf: {
            values: {
                ...base,
                _PROFILER: 1
            },
            keepLines: false
        }
    }[type];
};

const getImportMetaUrl = (file) => {
    return /* js */ `(typeof document === 'undefined' && typeof location === 'undefined' ? require('u' + 'rl').pathToFileURL(__filename).href : typeof document === 'undefined' ? location.href : (_documentCurrentScript && _documentCurrentScript.tagName.toUpperCase() === 'SCRIPT' && _documentCurrentScript.src || new URL('${file}', document.baseURI).href))`;
};

const getUmdBanner = (banner) => {
    return /* js */ `${banner}
(function (global, factory) {
\ttypeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
\ttypeof define === 'function' && define.amd ? define(['exports'], factory) :
\t(global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.pc = {}));
})(this, (function (exports) { 'use strict';
\tvar _documentCurrentScript = typeof document !== 'undefined' ? document.currentScript : null;`;
};

const getUmdFooter = () => {
    // Bridge the bundled namespace onto the UMD `exports` object. Each export getter is wrapped in
    // an accessor that:
    //   - delegates reads to the live binding, so mutable exports (e.g. `app`, which is null until
    //     an application is created) update on the UMD namespace. A plain `Object.assign` would
    //     snapshot each getter to its load-time value, leaving `pc.app` permanently null
    //     (see https://github.com/playcanvas/engine/issues/8836).
    //   - keeps the property writable, so consumers can still override members of `pc` (e.g. the
    //     Editor's classic-script worker reassigns `pc.createScript`). The getter-only descriptor
    //     copy introduced in #8837 breaks such overrides
    //     (see https://github.com/playcanvas/engine/pull/8837).
    return /* js */ `for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(pc))) {
\tObject.defineProperty(exports, key, descriptor.get ? {
\t\tget: descriptor.get,
\t\tset: (value) => Object.defineProperty(exports, key, { value, writable: true, enumerable: descriptor.enumerable, configurable: true }),
\t\tenumerable: descriptor.enumerable,
\t\tconfigurable: true
\t} : descriptor);
}
}));`;
};

const getPlugins = ({
    input,
    buildType,
    moduleFormat,
    file
}) => {
    const isDebug = buildType === 'dbg';
    const isUMD = moduleFormat === 'umd';
    const jscc = getJSCCOptions(buildType === 'min' ? 'rel' : buildType);
    const plugins = [
        transformPipelinePlugin({
            jsccValues: jscc.values,
            jsccKeepLines: jscc.keepLines,
            stripFunctions: !isDebug ? STRIP_FUNCTIONS : null,
            processShaders: !isDebug,
            dynamicImportLegacy: isUMD,
            dynamicImportSuppress: !isUMD,
            stripComments: !isDebug,
            importMetaUrl: isUMD ? getImportMetaUrl(file) : null
        })
    ];

    if (isDebug) {
        plugins.push(importValidationPlugin(input));
    }

    return plugins;
};

const getBundledOptions = ({
    moduleFormat,
    buildType,
    input = 'src/index.js',
    dir = 'build',
    sourcemaps = false,
    watch = false,
    metafile = false
}) => {
    const isUMD = moduleFormat === 'umd';
    const isDebug = buildType === 'dbg';
    const isMin = buildType === 'min';
    const prefix = OUT_PREFIX[buildType];
    const file = `${prefix}${isUMD ? '.js' : '.mjs'}`;
    const outfile = `${dir}/${file}`;
    const banner = getBanner(BANNER[buildType]);
    const preserveClassFields = moduleFormat === 'esm' && (buildType === 'rel' || buildType === 'prf');

    return {
        entryPoints: [input],
        bundle: true,
        outfile,
        format: isUMD ? 'iife' : 'esm',
        globalName: isUMD ? 'pc' : undefined,
        target: TARGET,
        metafile,
        ...(preserveClassFields ? { supported: CLASS_FIELD_SUPPORT } : {}),
        sourcemap: sourcemaps ? true : isDebug ? 'inline' : false,
        minify: isMin,
        drop: isMin ? ['console'] : undefined,
        legalComments: 'none',
        banner: {
            js: isUMD ? getUmdBanner(banner) : banner
        },
        footer: isUMD ? {
            js: getUmdFooter()
        } : undefined,
        plugins: getPlugins({
            input,
            buildType,
            moduleFormat,
            file
        }),
        external: EXTERNALS,
        logLevel: watch ? 'silent' : 'warning'
    };
};

const buildBundled = async (options) => {
    const opts = getBundledOptions(options);
    const result = await esbuild.build(opts);
    const stripSections = !options.sourcemaps && options.moduleFormat === 'esm' && options.buildType !== 'dbg';
    if (stripSections || shouldCompactIndent(options)) {
        let code = await fs.promises.readFile(opts.outfile, 'utf8');
        if (stripSections) {
            code = code.replace(BUNDLE_SECTION_COMMENT, '');
        }
        if (shouldCompactIndent(options)) {
            code = compactIndent(code);
        }
        await fs.promises.writeFile(opts.outfile, code);
    }
    if (!options.sourcemaps) {
        await fs.promises.rm(`${opts.outfile}.map`, { force: true });
    }

    return result;
};

const watchBundled = async (options, startLog, log) => {
    const opts = getBundledOptions({
        ...options,
        watch: true
    });
    const input = options.input ?? 'src/index.js';
    const output = opts.outfile;
    if (!options.sourcemaps) {
        await fs.promises.rm(`${output}.map`, { force: true });
    }
    const ctx = await esbuild.context({
        ...opts,
        plugins: [
            ...(opts.plugins ?? []),
            {
                name: 'watch-log',
                setup(build) {
                    let start = 0;
                    build.onStart(() => {
                        start = performance.now();
                        startLog(input, output);
                    });
                    build.onEnd(async (result) => {
                        const stripSections = !options.sourcemaps &&
                            options.moduleFormat === 'esm' &&
                            options.buildType !== 'dbg';
                        if (!result.errors.length && (stripSections || shouldCompactIndent(options))) {
                            let code = await fs.promises.readFile(output, 'utf8');
                            if (stripSections) {
                                code = code.replace(BUNDLE_SECTION_COMMENT, '');
                            }
                            if (shouldCompactIndent(options)) {
                                code = compactIndent(code);
                            }
                            await fs.promises.writeFile(output, code);
                        }
                        log(output, performance.now() - start, result.errors.length);
                        if (!result.errors.length) {
                            await options.end?.(result);
                        }
                    });
                }
            }
        ]
    });
    await ctx.watch();

    return ctx;
};

const collectIdentifiers = (node, used) => {
    if (!node || typeof node !== 'object' || node.type === 'ImportDeclaration') {
        return;
    }
    if (node.type === 'Identifier') {
        used.add(node.name);
    }

    for (const key in node) {
        if (key === 'start' || key === 'end' || key === 'loc' || key === 'range') {
            continue;
        }

        const value = node[key];
        if (Array.isArray(value)) {
            value.forEach(item => collectIdentifiers(item, used));
            continue;
        }
        collectIdentifiers(value, used);
    }
};

const pruneUnusedImports = (source) => {
    const ast = parseModule(source);
    const used = new Set();
    ast.body.forEach(node => collectIdentifiers(node, used));

    const ranges = [];
    for (const node of ast.body) {
        if (node.type !== 'ImportDeclaration' || !node.specifiers.length) {
            continue;
        }

        const removable = node.specifiers.every((spec) => {
            return PRUNABLE_IMPORTS.has(spec.local.name) && !used.has(spec.local.name);
        });
        if (removable) {
            let end = node.end;
            while (source[end] === '\r' || source[end] === '\n') {
                end++;
            }
            ranges.push([node.start, end]);
        }
    }

    for (const [start, end] of ranges.reverse()) {
        source = `${source.slice(0, start)}${source.slice(end)}`;
    }

    return source;
};

const collectImports = (source, file) => {
    const ast = parseModule(source);
    const imports = [];

    for (const node of ast.body) {
        const name = node.source?.value;
        if (!name || name === FFLATE) {
            continue;
        }

        if (name.startsWith('.')) {
            const resolved = path.resolve(path.dirname(file), name);
            imports.push(path.extname(resolved) ? resolved : `${resolved}.js`);
        }
    }

    return imports.sort();
};

const rewriteFflate = (source, file, input) => {
    if (!source.includes(`from '${FFLATE}'`) && !source.includes(`from "${FFLATE}"`)) {
        return source;
    }

    const root = path.dirname(path.resolve(input));
    const rel = path.relative(path.dirname(file), root).split(path.sep).join('/');
    const modulePath = path.posix.join(rel, '..', 'modules', FFLATE, 'esm', 'browser.js');

    return source.replace(/from ['"]fflate['"]/g, `from '${modulePath}'`);
};

const writeFflate = async (outDir) => {
    const dest = path.join(outDir, 'modules', FFLATE, 'esm', 'browser.js');

    await fs.promises.mkdir(path.dirname(dest), { recursive: true });
    await esbuild.build({
        stdin: {
            contents: /* js */ `export { ${FFLATE_EXPORTS.join(', ')} } from '${FFLATE}';`,
            resolveDir: rootDir,
            sourcefile: `${FFLATE}.js`
        },
        bundle: true,
        write: true,
        outfile: dest,
        format: 'esm',
        target: TARGET,
        minify: true,
        legalComments: 'none',
        logLevel: 'silent'
    });
};

const getUnbundledContext = ({
    buildType,
    input = 'src/index.js',
    dir = 'build',
    sourcemaps = false
}) => {
    const isDebug = buildType === 'dbg';
    const prefix = OUT_PREFIX[buildType];
    const jscc = getJSCCOptions(buildType);

    return {
        input,
        output: `${dir}/${prefix}`,
        outDir: path.resolve(`${dir}/${prefix}`),
        sourcemaps,
        compact: shouldCompactIndent({ buildType, sourcemaps }),
        preserveClassFields: buildType === 'rel' || buildType === 'prf',
        isDebug,
        jscc,
        strip: !isDebug ? createStripTransform(STRIP_FUNCTIONS) : null
    };
};

const transformFile = async (file, ctx) => {
    let source = await fs.promises.readFile(file, 'utf8');
    source = applyTransforms(source, {
        jsccValues: ctx.jscc.values,
        jsccKeepLines: ctx.jscc.keepLines,
        strip: ctx.strip,
        processShaders: !ctx.isDebug,
        dynamicImportLegacy: false,
        dynamicImportSuppress: true,
        stripComments: !ctx.isDebug,
        importMetaUrl: null
    }, file);
    source = pruneUnusedImports(source);
    const imports = collectImports(source, file);
    source = rewriteFflate(source, file, ctx.input);

    const result = await esbuild.transform(source, {
        loader: 'js',
        target: TARGET,
        format: 'esm',
        ...(ctx.preserveClassFields ? { supported: CLASS_FIELD_SUPPORT } : {}),
        sourcemap: ctx.sourcemaps,
        sourcefile: path.relative(rootDir, file),
        legalComments: 'none'
    });
    const rel = path.relative(rootDir, file);

    return {
        file,
        imports,
        code: ctx.compact ? compactIndent(result.code) : result.code,
        map: result.map,
        dest: path.join(ctx.outDir, rel)
    };
};

const buildGraph = async (ctx) => {
    const graph = new Map();
    const pending = new Map();

    const walk = (file) => {
        file = path.resolve(file);
        if (graph.has(file)) {
            return graph.get(file);
        }

        const queued = pending.get(file);
        if (queued) {
            return queued;
        }

        const promise = transformFile(file, ctx).then(async (item) => {
            graph.set(file, item);
            await Promise.all(item.imports.map(walk));
            pending.delete(file);
            return item;
        });
        pending.set(file, promise);

        return promise;
    };

    await walk(ctx.input);

    return graph;
};

const writeItem = async (item, sourcemaps) => {
    await fs.promises.writeFile(item.dest, item.code);
    if (sourcemaps && item.map) {
        await fs.promises.writeFile(`${item.dest}.map`, item.map);
        await fs.promises.appendFile(item.dest, `\n//# sourceMappingURL=${path.basename(item.dest)}.map\n`);
    }
};

const writeGraph = async (graph, sourcemaps) => {
    const dirs = new Set([...graph.values()].map(item => path.dirname(item.dest)));

    await Promise.all([...dirs].map(dir => fs.promises.mkdir(dir, { recursive: true })));
    await Promise.all([...graph.values()].map(item => writeItem(item, sourcemaps)));
};

const cleanOutDir = async (dir, preserveTypes) => {
    if (!preserveTypes) {
        await fs.promises.rm(dir, { recursive: true, force: true });
        return;
    }

    const entries = await fs.promises.readdir(dir, { withFileTypes: true }).then(value => value, () => []);
    await Promise.all(entries.map(async (entry) => {
        const file = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            await cleanOutDir(file, true);
            const left = await fs.promises.readdir(file).then(value => value, () => []);
            if (!left.length) {
                await fs.promises.rm(file, { recursive: true, force: true });
            }
            return;
        }
        if (!file.endsWith('.d.ts')) {
            await fs.promises.rm(file, { force: true });
        }
    }));
};

const buildUnbundled = async ({
    buildType,
    input = 'src/index.js',
    dir = 'build',
    sourcemaps = false
}) => {
    const ctx = getUnbundledContext({
        buildType,
        input,
        dir,
        sourcemaps
    });
    const graph = await buildGraph(ctx);

    await cleanOutDir(ctx.outDir, buildType === 'rel');
    await writeGraph(graph, sourcemaps);
    await writeFflate(ctx.outDir);
};

const watchUnbundled = async (options, startLog, log) => {
    const input = options.input ?? 'src/index.js';
    const ctx = getUnbundledContext({
        ...options,
        input
    });
    let graph = null;
    let active = false;
    let pending = false;
    let timer = null;

    const fullBuild = async () => {
        graph = await buildGraph(ctx);
        await cleanOutDir(ctx.outDir, options.buildType === 'rel');
        await writeGraph(graph, ctx.sourcemaps);
        await writeFflate(ctx.outDir);
    };

    const update = async (file) => {
        if (!file || !graph?.has(file)) {
            await fullBuild();
            return;
        }

        const stat = await fs.promises.stat(file).then(value => value, () => null);
        if (!stat?.isFile()) {
            await fullBuild();
            return;
        }

        const next = await transformFile(file, ctx);
        const prev = graph.get(file);
        if (
            prev.imports.length !== next.imports.length ||
            !prev.imports.every((value, i) => value === next.imports[i])
        ) {
            await fullBuild();
            return;
        }

        graph.set(file, next);
        await fs.promises.mkdir(path.dirname(next.dest), { recursive: true });
        await writeItem(next, ctx.sourcemaps);
    };

    const queue = (file) => {
        pending = !file || pending === true || (pending && pending !== file) ? true : file;
    };

    const run = (file) => {
        startLog(input, ctx.output);
        const start = performance.now();
        return update(file).then(() => {
            log(ctx.output, performance.now() - start, 0);
        }, (err) => {
            console.error(err.message);
            log(ctx.output, performance.now() - start, 1);
        });
    };

    const rebuild = (file) => {
        if (active) {
            queue(file);
            return;
        }

        active = true;
        run(file).then(() => {
            active = false;
            if (pending) {
                const file = pending === true ? null : pending;
                pending = false;
                rebuild(file);
            }
        });
    };

    await run(null);

    const watcher = fs.watch(path.dirname(options.input ?? 'src/index.js'), { recursive: true }, (event, file) => {
        if (!file?.endsWith('.js')) {
            return;
        }
        const source = path.resolve(path.dirname(input), file);
        clearTimeout(timer);
        timer = setTimeout(() => rebuild(source), 100);
    });

    return {
        dispose() {
            clearTimeout(timer);
            watcher.close();
        }
    };
};

const buildTarget = async ({
    moduleFormat,
    buildType,
    input = 'src/index.js',
    dir = 'build',
    preserveModules = moduleFormat === 'esm' && buildType !== 'min',
    sourcemaps = false,
    metafile = false
}) => {
    const tasks = [buildBundled({
        moduleFormat,
        buildType,
        input,
        dir,
        sourcemaps,
        metafile
    })];

    if (preserveModules) {
        tasks.push(buildUnbundled({
            buildType,
            input,
            dir,
            sourcemaps
        }));
    }

    const [result] = await Promise.all(tasks);

    return result;
};

const watchTarget = async ({
    moduleFormat,
    buildType,
    input = 'src/index.js',
    dir = 'build',
    preserveModules = moduleFormat === 'esm' && buildType !== 'min',
    sourcemaps = false,
    metafile = false,
    start,
    log,
    end
}) => {
    const watchers = [
        await watchBundled({
            moduleFormat,
            buildType,
            input,
            dir,
            sourcemaps,
            metafile,
            end
        }, start, log)
    ];

    if (preserveModules) {
        watchers.push(await watchUnbundled({
            buildType,
            input,
            dir,
            sourcemaps
        }, start, log));
    }

    return watchers;
};

export { buildTarget, OUT_PREFIX, watchTarget };
