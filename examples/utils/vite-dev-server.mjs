import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {
    createExampleHtml,
    createShareHtml,
    exampleMetaData,
    getEnginePath,
    getEnginePathInfo,
    getExample,
    getExamplePath,
    getFiles,
    loadExampleMetaData,
    readExampleConfig,
    slash,
    transformSource
} from './build-examples.mjs';
import { createdLog, startLog } from './log.mjs';
import { buildTypes } from '../../utils/types-build-target.mjs';

/**
 * @import { IncomingMessage as HttpRequest, ServerResponse as HttpResponse } from 'node:http'
 * @import { Logger as ViteLogger, Plugin as VitePlugin, ViteDevServer as ViteServer } from 'vite'
 * @import { EnginePathInfo, ExampleMetadata } from './build-examples.mjs'
 * @import { ExampleConfig } from './example-source.mjs'
 */

/**
 * @typedef {object} StaticRoute
 * @property {string} url - url prefix.
 * @property {string} root - file root.
 */

/**
 * @typedef {object} ExampleUpdate
 * @property {'example'} kind - update kind.
 * @property {string} path - changed path.
 * @property {string} example - example route.
 * @property {string} stamp - cache stamp.
 * @property {ExampleConfig} config - example config.
 * @property {string[]} files - example files.
 */

/**
 * @typedef {object} FileUpdate
 * @property {'engine' | 'iframe'} kind - update kind.
 * @property {string} path - changed path.
 * @property {string} stamp - cache stamp.
 */

/**
 * @typedef {ExampleUpdate | FileUpdate} DevUpdate
 */

/**
 * @typedef {object} TypesBuilder
 * @property {() => void} run - start a types build.
 * @property {() => void} schedule - schedule a types build.
 */

/**
 * @typedef {object} DevServerOptions
 * @property {boolean} [hmr=true] - send hmr updates.
 */

const NODE_ENV = 'development';
const UPDATE_EVENT = 'playcanvas:examples-update';
const ENGINE_PREFIX = '/iframe/ENGINE_PATH/';
const IFRAME_PREFIX = '/iframe/';
const TEXT = 'text/plain; charset=utf-8';
const TYPES_DIR = '../build';
const HASH_ALGORITHM = 'sha1';
/** @type {StaticRoute[]} */
const STATIC_ROUTES = [
    { url: '/static/assets/', root: 'assets' },
    { url: '/static/scripts/', root: '../scripts' },
    { url: '/icons/', root: 'src/static/icons' },
    { url: '/thumbnails/', root: 'thumbnails' },
    { url: '/modules/monaco-editor/min/vs/', root: 'node_modules/monaco-editor/min/vs' },
    { url: '/modules/fflate/esm/', root: '../node_modules/fflate/esm' }
];
const ROOT_FILES = {
    '/styles.css': 'src/static/styles.css',
    '/playcanvas-logo.png': 'src/static/playcanvas-logo.png',
    '/manifest.webmanifest': 'src/static/manifest.webmanifest',
    '/playcanvas.d.ts': '../build/playcanvas.d.ts'
};
const IFRAME_FILES = {
    '/iframe/context.mjs': 'iframe/context.mjs',
    '/iframe/files.mjs': 'iframe/files.mjs',
    '/iframe/loader.mjs': 'iframe/loader.mjs',
    '/iframe/main.css': 'iframe/main.css',
    '/iframe/ministats.mjs': 'iframe/ministats.mjs',
    '/iframe/polyfill.js': 'iframe/polyfill.js',
    '/iframe/playcanvas-observer.mjs': 'node_modules/@playcanvas/observer/dist/index.mjs',
    '/iframe/runtime.mjs': 'iframe/runtime.mjs',
    '/iframe/state.mjs': 'iframe/state.mjs',
    '/iframe/zoom.mjs': 'iframe/zoom.mjs',
    '/iframe/playcanvas.d.ts': '../build/playcanvas.d.ts'
};

/**
 * @param {string} file - file path.
 * @returns {string} mime type.
 */
const mime = (file) => {
    if (file.endsWith('.d.ts')) {
        return TEXT;
    }
    switch (path.extname(file)) {
        case '.css':
            return 'text/css; charset=utf-8';
        case '.html':
            return 'text/html; charset=utf-8';
        case '.js':
        case '.mjs':
            return 'text/javascript; charset=utf-8';
        case '.json':
            return 'application/json; charset=utf-8';
        case '.webmanifest':
            return 'application/manifest+json; charset=utf-8';
        case '.png':
            return 'image/png';
        case '.jpg':
        case '.jpeg':
            return 'image/jpeg';
        case '.svg':
            return 'image/svg+xml';
        case '.wasm':
            return 'application/wasm';
    }
    return TEXT;
};

/**
 * @param {string} file - file path.
 * @param {string} root - root path.
 * @returns {boolean} true if file is inside root.
 */
const isInside = (file, root) => {
    return file === root || file.startsWith(`${root}${path.sep}`);
};

/**
 * @param {string} file - file path.
 * @returns {Promise<string | null>} file hash.
 */
const hashFile = async (file) => {
    const data = await fs.promises.readFile(file).then(value => value, () => null);
    return data && createHash(HASH_ALGORITHM).update(data).digest('base64url');
};

/**
 * @param {string} root - file or directory root.
 * @returns {Promise<string[]>} file paths.
 */
const listFiles = async (root) => {
    const abs = path.resolve(root);
    const stat = await fs.promises.stat(abs).then(value => value, () => null);
    if (!stat) {
        return [];
    }
    if (stat.isFile()) {
        return [abs];
    }
    if (!stat.isDirectory()) {
        return [];
    }

    const entries = await fs.promises.readdir(abs, { withFileTypes: true }).then(value => value, () => []);
    const files = await Promise.all(entries.map((entry) => {
        const file = path.join(abs, entry.name);
        if (entry.isDirectory()) {
            return listFiles(file);
        }
        return entry.isFile() ? [file] : [];
    }));
    return files.flat();
};

/**
 * @param {'add' | 'change' | 'unlink'} event - watcher event.
 * @param {string} file - changed file.
 * @param {Map<string, string>} hashes - file hashes.
 * @returns {Promise<boolean>} true if content changed.
 */
const changed = async (event, file, hashes) => {
    const abs = path.resolve(file);
    if (event === 'unlink') {
        hashes.delete(abs);
        return true;
    }

    const hash = await hashFile(abs);
    if (!hash) {
        hashes.delete(abs);
        return true;
    }

    const prev = hashes.get(abs);
    hashes.set(abs, hash);
    return event !== 'change' || prev !== hash;
};

/**
 * @param {HttpResponse} res - http response.
 * @param {string} text - response body.
 * @param {string} [type] - content type.
 * @returns {void} no return value.
 */
const sendText = (res, text, type = TEXT) => {
    res.statusCode = 200;
    res.setHeader('Content-Type', type);
    res.setHeader('Cache-Control', 'no-cache');
    res.end(text);
};

/**
 * @param {HttpResponse} res - http response.
 * @param {string} file - file path.
 * @param {string} [root] - allowed root.
 * @returns {Promise<boolean>} true if handled.
 */
const sendFile = async (res, file, root = '') => {
    const abs = path.resolve(file);
    const base = root ? path.resolve(root) : '';
    if (base && !isInside(abs, base)) {
        res.statusCode = 403;
        res.end();
        return true;
    }

    const stat = await fs.promises.stat(abs).then(value => value, () => null);
    if (!stat?.isFile()) {
        return false;
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', mime(abs));
    res.setHeader('Cache-Control', 'no-cache');
    fs.createReadStream(abs).on('error', () => {
        if (!res.headersSent) {
            res.statusCode = 500;
        }
        res.end();
    }).pipe(res);
    return true;
};

/**
 * @param {HttpResponse} res - http response.
 * @returns {boolean} true if handled.
 */
const notFound = (res) => {
    res.statusCode = 404;
    res.end();
    return true;
};

/**
 * @param {string} file - file path.
 * @returns {ExampleMetadata | null} matching example.
 */
const exampleFromFile = (file) => {
    const abs = slash(path.resolve(file));
    for (let i = 0; i < exampleMetaData.length; i++) {
        const item = exampleMetaData[i];
        const dir = slash(path.resolve(item.path));
        if (abs.startsWith(`${dir}/`) && path.basename(file).startsWith(`${item.exampleNameKebab}.`)) {
            return item;
        }
    }
    return null;
};

/**
 * @param {string} file - file path.
 * @returns {string} relative path.
 */
const relative = file => slash(path.relative(process.cwd(), file));

/**
 * @param {string} file - changed file.
 * @param {EnginePathInfo} engine - engine path info.
 * @param {((kind: string, output: string) => void) | null} [logStart] - start log callback.
 * @returns {Promise<DevUpdate | null>} dev update.
 */
const createUpdate = async (file, engine, logStart = null) => {
    const abs = path.resolve(file);
    const stamp = Date.now().toString(36);
    const item = exampleFromFile(abs);
    if (item) {
        const example = `/${item.categoryKebab}/${item.exampleNameKebab}`;
        logStart?.('example', example);
        return {
            kind: 'example',
            path: relative(abs),
            example,
            stamp,
            config: await readExampleConfig(item),
            files: getFiles(item)
        };
    }
    if ((engine.unpacked && isInside(abs, engine.root)) || (!engine.unpacked && abs === engine.src)) {
        const file = relative(abs);
        logStart?.('engine', file);
        return {
            kind: 'engine',
            path: file,
            stamp
        };
    }
    if (isInside(abs, path.resolve('iframe')) ||
            isInside(abs, path.resolve('templates')) ||
            isInside(abs, path.resolve('assets')) ||
            isInside(abs, path.resolve('../scripts'))) {
        const file = relative(abs);
        logStart?.('iframe', file);
        return {
            kind: 'iframe',
            path: file,
            stamp
        };
    }
    return null;
};

/**
 * @param {ViteLogger} logger - vite logger.
 * @returns {TypesBuilder} types builder.
 */
const createTypesBuilder = (logger) => {
    let active = false;
    let pending = false;
    /** @type {NodeJS.Timeout | null} */
    let timer = null;

    /**
     * @returns {void} no return value.
     */
    const run = () => {
        if (active) {
            pending = true;
            return;
        }

        active = true;
        buildTypes({
            root: '..',
            dir: TYPES_DIR,
            skipUnchanged: true
        }).then(() => {
            active = false;
            if (pending) {
                pending = false;
                run();
            }
        }, (err) => {
            active = false;
            logger.error(err.message);
            if (pending) {
                pending = false;
                run();
            }
        });
    };

    return {
        run,
        /**
         * @returns {void} no return value.
         */
        schedule() {
            clearTimeout(timer);
            timer = setTimeout(run, 100);
        }
    };
};

/**
 * @param {string} url - request url.
 * @param {HttpResponse} res - http response.
 * @param {EnginePathInfo} info - engine path info.
 * @returns {boolean | Promise<boolean>} true if handled.
 */
const serveEngine = (url, res, info) => {
    if (!url.startsWith(ENGINE_PREFIX)) {
        return false;
    }

    const rel = url.slice(ENGINE_PREFIX.length);
    if (!info.unpacked) {
        return rel === 'index.js' ? sendFile(res, info.src) : false;
    }
    return sendFile(res, path.join(info.root, rel), info.root);
};

/**
 * @param {string} url - request url.
 * @param {HttpResponse} res - http response.
 * @returns {Promise<boolean>} true if handled.
 */
const serveExampleFile = async (url, res) => {
    const name = url.slice(IFRAME_PREFIX.length);
    const dot = name.indexOf('.');
    const target = dot === -1 ? '' : name.slice(0, dot);
    const file = dot === -1 ? '' : name.slice(dot + 1);
    if (!target || !target.includes('_') || !file) {
        return false;
    }

    const item = getExample(target);
    if (!item || !getFiles(item).includes(file)) {
        return false;
    }

    const src = getExamplePath(item, file);
    if (!/\.(?:mjs|js)$/.test(file)) {
        return sendFile(res, src, path.dirname(src));
    }

    const source = await fs.promises.readFile(src, 'utf8').then(value => value, () => null);
    if (source === null) {
        return false;
    }
    const code = file === 'example.mjs' ? transformSource(source) : source;
    sendText(res, code, 'text/javascript; charset=utf-8');
    return true;
};

/**
 * @param {ViteServer} server - vite server.
 * @param {HttpRequest} req - http request.
 * @param {HttpResponse} res - http response.
 * @param {EnginePathInfo} engineInfo - engine path info.
 * @param {string} engineStamp - engine cache stamp.
 * @returns {Promise<boolean>} true if handled.
 */
const handle = async (server, req, res, engineInfo, engineStamp) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        return false;
    }

    const url = new URL(req.url ?? '/', 'http://localhost').pathname;
    if (url === '/' || url === '/index.html') {
        const html = await fs.promises.readFile('src/static/index.html', 'utf8');
        const dev = html.replace(
            /<script src="index\.js"><\/script>/,
            '<script type="module" src="/src/app/index.mjs"></script>'
        );
        sendText(res, await server.transformIndexHtml(req.url ?? '/', dev), 'text/html; charset=utf-8');
        return true;
    }

    // /share/<slug>/ or /share/<slug>/index.html — render the share template inline so dev
    // mode can serve the same crawler-friendly wrapper as prod without writing dist/.
    if (url.startsWith('/share/')) {
        const slug = url.slice('/share/'.length).replace(/\/(index\.html)?$/, '');
        const item = slug ? getExample(slug) : undefined;
        if (item) {
            const host = req.headers.host ?? 'localhost';
            const proto = req.headers['x-forwarded-proto'] ?? (req.socket?.encrypted ? 'https' : 'http');
            const origin = `${proto}://${host}`;
            const html = await createShareHtml(item, origin);
            const dev = html.replace(
                /<script src="\/index\.js"><\/script>/,
                '<script type="module" src="/src/app/index.mjs"></script>'
            );
            sendText(res, await server.transformIndexHtml(req.url ?? '/', dev), 'text/html; charset=utf-8');
            return true;
        }
    }

    if (ROOT_FILES[url]) {
        const found = await sendFile(res, ROOT_FILES[url]);
        return found || notFound(res);
    }
    if (IFRAME_FILES[url]) {
        const found = await sendFile(res, IFRAME_FILES[url]);
        return found || notFound(res);
    }
    const route = STATIC_ROUTES.find(item => url.startsWith(item.url));
    if (route) {
        const found = await sendFile(res, path.join(route.root, url.slice(route.url.length)), route.root);
        return found || notFound(res);
    }
    if (await serveEngine(url, res, engineInfo)) {
        return true;
    }

    if (url.startsWith(IFRAME_PREFIX) && url.endsWith('.html')) {
        const name = url.slice(IFRAME_PREFIX.length, -'.html'.length);
        const item = getExample(name);
        if (item) {
            const params = new URL(req.url ?? '/', 'http://localhost').searchParams;
            sendText(res, await createExampleHtml(item, getFiles(item), {
                nodeEnv: NODE_ENV,
                enginePath: getEnginePath(NODE_ENV),
                engineStamp: params.get('t') ?? engineStamp
            }), 'text/html; charset=utf-8');
            return true;
        }
    }

    if (url.startsWith(IFRAME_PREFIX)) {
        return serveExampleFile(url, res);
    }

    return false;
};

/**
 * @param {DevServerOptions} [options] - dev server options.
 * @returns {VitePlugin} vite plugin.
 */
export const examplesDevServer = ({ hmr = true } = {}) => {
    const enginePath = getEnginePath(NODE_ENV);
    let engineStamp = '';
    let engineInfo;

    return {
        name: 'playcanvas-examples-dev-server',

        /**
         * @param {ViteServer} server - vite server.
         * @returns {Promise<void>} completion promise.
         */
        async configureServer(server) {
            await loadExampleMetaData();
            const types = createTypesBuilder(server.config.logger);
            const roots = [
                path.resolve('src/examples'),
                path.resolve('templates'),
                path.resolve('iframe'),
                path.resolve('assets'),
                path.resolve('../scripts')
            ];
            /** @type {Map<string, string>} */
            const hashes = new Map();

            server.watcher.add(roots);
            const info = engineInfo ??= getEnginePathInfo(enginePath);
            const engine = await info.then(value => value, (err) => {
                server.config.logger.error(err.message);
                return null;
            });
            const seedRoots = [...roots];
            if (engine) {
                const root = engine.unpacked ? engine.root : engine.src;
                server.watcher.add(root);
                seedRoots.push(root);
            }
            const files = (await Promise.all(seedRoots.map(listFiles))).flat();
            await Promise.all(files.map(async (file) => {
                const hash = await hashFile(file);
                if (hash) {
                    hashes.set(file, hash);
                }
            }));
            types.run();

            /**
             * @param {'add' | 'change' | 'unlink'} event - watcher event.
             * @param {string} file - changed file.
             * @returns {void} no return value.
             */
            const update = (event, file) => {
                changed(event, file, hashes).then((dirty) => {
                    if (!dirty) {
                        return null;
                    }

                    let start = 0;
                    const logStart = (kind, output) => {
                        start = performance.now();
                        startLog(kind, output);
                    };
                    const current = engineInfo ??= getEnginePathInfo(enginePath);
                    return current.then((value) => {
                        return createUpdate(file, value, logStart);
                    }).then((data) => {
                        if (!data) {
                            return;
                        }
                        if (data.kind === 'engine') {
                            engineStamp = data.stamp;
                            types.schedule();
                        }
                        createdLog(data.kind === 'example' ? data.example : data.path, performance.now() - start);
                        if (!hmr) {
                            return;
                        }
                        server.ws.send({
                            type: 'custom',
                            event: UPDATE_EVENT,
                            data
                        });
                    });
                }, (err) => {
                    server.config.logger.error(err.message);
                });
            };

            server.watcher.on('add', file => update('add', file));
            server.watcher.on('change', file => update('change', file));
            server.watcher.on('unlink', file => update('unlink', file));

            server.middlewares.use((req, res, next) => {
                const info = engineInfo ??= getEnginePathInfo(enginePath);
                info.then((value) => {
                    return handle(server, req, res, value, engineStamp);
                }).then((handled) => {
                    if (!handled) {
                        next();
                    }
                }, next);
            });
        }
    };
};
