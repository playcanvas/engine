import fs from 'node:fs';
import path from 'node:path';

import { isModuleWithExternalDependencies, parseConfig, stripConfig } from './example-source.mjs';

/**
 * @import { ExampleConfig } from './example-source.mjs'
 */

/**
 * @typedef {object} CopyTarget
 * @property {string} src - source path.
 * @property {string} dest - destination path.
 */

/**
 * @typedef {object} ExampleMetadata
 * @property {string} path - example directory.
 * @property {string} categoryKebab - category name.
 * @property {string} exampleNameKebab - example name.
 * @property {boolean} hidden - true if hidden from production navigation.
 */

/**
 * @typedef {object} ExampleHtmlTarget
 * @property {ExampleMetadata} item - example metadata.
 * @property {string[]} files - example files.
 */

/**
 * @typedef {object} ExampleTargets
 * @property {Record<string, string>} local - bundled module entries.
 * @property {CopyTarget[]} sources - transformed source files.
 * @property {CopyTarget[]} assets - copied asset files.
 * @property {ExampleHtmlTarget[]} html - iframe html targets.
 * @property {ExampleMetadata[]} share - share page targets.
 */

/**
 * @typedef {object} CreateExampleHtmlOptions
 * @property {string} [nodeEnv] - node environment.
 * @property {string} [enginePath] - engine path override.
 * @property {string} [engineStamp] - engine cache stamp.
 */

/**
 * @typedef {object} EnginePathInfo
 * @property {string} root - root directory.
 * @property {string} src - source file.
 * @property {boolean} unpacked - true if source imports other files.
 */

/**
 * @type {ExampleMetadata[]}
 */
export let exampleMetaData = [];

export const BUILD_TYPES = /** @type {const} */ (['rel', 'dbg', 'prf']);
export const TARGET = 'es2020';
export const EXAMPLE_TARGET = 'esnext';
export const EXAMPLE_TEMPLATE = 'templates/example.html';
export const SHARE_TEMPLATE = 'templates/share.html';
export const IFRAME_DIR = 'dist/iframe';
export const STATIC_TARGETS = [
    { src: './src/static', dest: 'dist/' },
    { src: './iframe', dest: 'dist/iframe' },
    { src: './assets', dest: 'dist/static/assets/' },
    { src: './thumbnails', dest: 'dist/thumbnails/' },
    { src: '../scripts', dest: 'dist/static/scripts/' },
    {
        src: './node_modules/@playcanvas/observer/dist/index.mjs',
        dest: 'dist/iframe/playcanvas-observer.mjs'
    },
    { src: './node_modules/monaco-editor/min/vs', dest: 'dist/modules/monaco-editor/min/vs' },
    { src: '../node_modules/fflate/esm/', dest: 'dist/modules/fflate/esm' }
];
export const EXTERNAL_LOCAL = [
    'playcanvas'
];

/**
 * @returns {Promise<ExampleMetadata[]>} loaded metadata.
 */
export const loadExampleMetaData = async () => {
    const metadata = await import('../cache/metadata.mjs');
    exampleMetaData = metadata.exampleMetaData;
    return exampleMetaData;
};

/**
 * @param {string} file - file path.
 * @returns {Promise<boolean>} true if the file exists.
 */
export const exists = file => fs.promises.stat(file).then(() => true, () => false);

/**
 * @param {string} file - file path.
 * @returns {string} path with forward slashes.
 */
export const slash = file => file.split(path.sep).join('/');

/**
 * @param {CopyTarget} target - copy target.
 * @returns {Promise<void>} completion promise.
 */
export const copyFile = async ({ src, dest }) => {
    await fs.promises.mkdir(path.dirname(dest), { recursive: true });
    await fs.promises.cp(src, dest, { recursive: true });
};

/**
 * @param {CopyTarget[]} targets - copy targets.
 * @param {boolean} [parallel] - true to copy in parallel.
 * @returns {Promise<void[] | void>} completion promise.
 */
export const copyTargets = (targets, parallel = true) => {
    if (parallel) {
        return Promise.all(targets.map(copyFile));
    }
    return targets.reduce((task, target) => {
        return task.then(() => copyFile(target));
    }, Promise.resolve());
};

/**
 * @param {string} source - example source.
 * @returns {string} transformed source.
 */
export const transformSource = (source) => {
    return stripConfig(source).replace(/^(?:[ \t]*\r?\n)+/, '');
};

/**
 * @param {string} [nodeEnv] - node environment.
 * @returns {string} engine path.
 */
export const getEnginePath = (nodeEnv = process.env.NODE_ENV ?? '') => {
    return !process.env.ENGINE_PATH && nodeEnv === 'development' ?
        '../src/index.js' : process.env.ENGINE_PATH ?? '';
};

/**
 * @param {ExampleConfig['ENGINE']} [type] - engine type.
 * @returns {string} engine url.
 */
export const engineUrl = (type) => {
    switch (type) {
        case 'development':
            return '../iframe/ENGINE_PATH/index.js';
        case 'performance':
            return '../iframe/playcanvas.prf.mjs';
        case 'debug':
            return '../iframe/playcanvas.dbg.mjs';
    }
    return '../iframe/playcanvas.mjs';
};

/**
 * @param {string} url - base url.
 * @param {string} stamp - cache stamp.
 * @returns {string} stamped url.
 */
export const stampedUrl = (url, stamp) => {
    return stamp ? `${url}${url.includes('?') ? '&' : '?'}t=${stamp}` : url;
};

/**
 * @param {Pick<ExampleMetadata, 'categoryKebab' | 'exampleNameKebab'>} item - example metadata.
 * @returns {string} target name.
 */
export const targetName = ({ categoryKebab, exampleNameKebab }) => `${categoryKebab}_${exampleNameKebab}`;

/**
 * @param {string} name - target name.
 * @returns {ExampleMetadata | undefined} example metadata.
 */
export const getExample = (name) => {
    return exampleMetaData.find(item => targetName(item) === name);
};

/**
 * @param {ExampleMetadata} item - example metadata.
 * @param {string} file - example file suffix.
 * @returns {string} source file path.
 */
export const getExamplePath = (item, file) => {
    const input = path.join(item.path, `${item.exampleNameKebab}.${file}`);
    if (fs.existsSync(input)) {
        return input;
    }
    return file === 'controls.mjs' ? 'templates/controls.mjs' : input;
};

/**
 * @param {Pick<ExampleMetadata, 'path' | 'exampleNameKebab'>} item - example metadata.
 * @returns {string[]} example file suffixes.
 */
export const getFiles = ({ path: dir, exampleNameKebab }) => {
    const prefix = `${exampleNameKebab}.`;
    const files = fs.readdirSync(dir)
    .filter(file => file.startsWith(prefix))
    .map(file => file.replace(prefix, ''));
    if (!files.includes('controls.mjs')) {
        files.push('controls.mjs');
    }
    return files;
};

/**
 * @param {string} name - target name.
 * @param {string} file - file name.
 * @returns {string} entry key.
 */
export const entryKey = (name, file) => `${name}.${file.replace(/\.(?:mjs|js)$/, '')}`;

/**
 * @param {ExampleMetadata} item - example metadata.
 * @returns {Promise<ExampleConfig>} parsed example config.
 */
export const readExampleConfig = async (item) => {
    const src = path.join(item.path, `${item.exampleNameKebab}.example.mjs`);
    const code = await fs.promises.readFile(src, 'utf8');
    return parseConfig(code);
};

/**
 * @param {ExampleMetadata} item - example metadata.
 * @param {string[]} files - example file suffixes.
 * @param {CreateExampleHtmlOptions} [options] - html options.
 * @returns {Promise<string>} generated html.
 */
export const createExampleHtml = async (item, files, {
    nodeEnv = process.env.NODE_ENV ?? '',
    enginePath = getEnginePath(nodeEnv),
    engineStamp = ''
} = {}) => {
    const template = await fs.promises.readFile(EXAMPLE_TEMPLATE, 'utf8');
    const type = enginePath ? 'development' : nodeEnv === 'development' ? 'debug' : undefined;
    const config = await readExampleConfig(item);
    const html = template
    .replace(/'@TITLE'/g, `${item.categoryKebab}: ${item.exampleNameKebab}`)
    .replace(/'@FILES'/g, JSON.stringify(files))
    .replace(/'@CONFIG'/g, JSON.stringify(config))
    .replace(/'@ENGINE'/g, JSON.stringify(stampedUrl(engineUrl(type ?? config.ENGINE), engineStamp)));
    if (/'@[A-Z0-9_]+'/.test(html)) {
        throw new Error('HTML file still has unreplaced values');
    }
    return html;
};

/**
 * @param {ExampleMetadata} item - example metadata.
 * @param {string[]} files - example file suffixes.
 * @param {CreateExampleHtmlOptions} [options] - html options.
 * @returns {Promise<void>} completion promise.
 */
export const writeExampleHtml = async (item, files, options) => {
    const name = targetName(item);
    const html = await createExampleHtml(item, files, options);
    await fs.promises.mkdir(IFRAME_DIR, { recursive: true });
    await fs.promises.writeFile(`${IFRAME_DIR}/${name}.html`, html);
};

/**
 * @param {ExampleMetadata} item - example metadata.
 * @returns {Promise<void>} completion promise.
 */
/**
 * @param {ExampleMetadata} item - example metadata.
 * @param {string} [origin] - origin url for meta tags; defaults to VERCEL_URL.
 * @returns {Promise<string>} generated share html.
 */
export const createShareHtml = async (item, origin = `https://${process.env.VERCEL_URL ?? 'playcanvas.vercel.app'}`) => {
    const name = targetName(item);
    const template = await fs.promises.readFile(SHARE_TEMPLATE, 'utf8');
    const html = template
    .replace(/@ORIGIN/g, origin)
    .replace(/@PATH/g, `${item.categoryKebab}/${item.exampleNameKebab}`)
    .replace(/@SLUG/g, name)
    .replace(/@TITLE/g, `${item.exampleNameKebab.split('-').join(' ')}`)
    .replace(/@THUMB/g, `${name}_large`);
    if (/'@[A-Z0-9_]+'/.test(html)) {
        throw new Error('HTML file still has unreplaced values');
    }
    return html;
};

/**
 * @param {ExampleMetadata} item - example metadata.
 * @returns {Promise<void>} completion promise.
 */
export const writeShareHtml = async (item) => {
    const name = targetName(item);
    const html = await createShareHtml(item);
    const dir = `dist/share/${name}`;
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(`${dir}/index.html`, html);
};

/**
 * @returns {ExampleTargets} example build targets.
 */
export const getExampleTargets = () => {
    const local = {};
    const sources = [];
    const assets = [];
    const html = [];
    const share = [];

    for (let i = 0; i < exampleMetaData.length; i++) {
        const item = exampleMetaData[i];
        const name = targetName(item);
        const files = getFiles(item);
        html.push({ item, files });
        share.push(item);

        for (let j = 0; j < files.length; j++) {
            const file = files[j];
            const input = getExamplePath(item, file);
            const output = `${IFRAME_DIR}/${name}.${file}`;
            if (!/\.(?:mjs|js)$/.test(file)) {
                assets.push({ src: input, dest: output });
                continue;
            }
            if (file === 'example.mjs' || file === 'controls.mjs') {
                sources.push({ src: input, dest: output });
                continue;
            }
            local[entryKey(name, file)] = input;
        }
    }

    return { local, sources, assets, html, share };
};

/**
 * @param {string} enginePath - engine path.
 * @returns {Promise<EnginePathInfo>} engine path info.
 */
export const getEnginePathInfo = async (enginePath) => {
    const src = path.resolve(enginePath);
    const content = await fs.promises.readFile(src, 'utf8');
    const unpacked = isModuleWithExternalDependencies(content);
    return {
        root: unpacked ? path.dirname(src) : '',
        src,
        unpacked
    };
};
