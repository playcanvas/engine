import fs from 'node:fs';
import path from 'node:path';

import { isModuleWithExternalDependencies, parseConfig } from './utils.mjs';
import { exampleMetaData } from '../cache/metadata.mjs';

export { exampleMetaData };

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
    { src: './src/lib', dest: 'dist/static/lib/' },
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

const CONFIG_COMMENT = /^[ \t]*\/\/ @config .*(?:\r?\n|$)/gm;
const PC_IMPORT = /^[ \t]*import[\s\w*{},]+["']playcanvas["'];?[ \t]*(?:\r?\n|$)/gm;

export const exists = file => fs.promises.stat(file).then(() => true, () => false);

export const slash = file => file.split(path.sep).join('/');

export const copyFile = async ({ src, dest }) => {
    await fs.promises.mkdir(path.dirname(dest), { recursive: true });
    await fs.promises.cp(src, dest, { recursive: true });
};

export const copyTargets = (targets, parallel = true) => {
    if (parallel) {
        return Promise.all(targets.map(copyFile));
    }
    return targets.reduce((task, target) => {
        return task.then(() => copyFile(target));
    }, Promise.resolve());
};

export const transformSource = (source) => {
    return source
    .replace(CONFIG_COMMENT, '')
    .replace(PC_IMPORT, '')
    .replace(/^(?:[ \t]*\r?\n)+/, '');
};

export const getEnginePath = (nodeEnv = process.env.NODE_ENV ?? '') => {
    return !process.env.ENGINE_PATH && nodeEnv === 'development' ?
        '../src/index.js' : process.env.ENGINE_PATH ?? '';
};

export const engineUrl = (type) => {
    switch (type) {
        case 'development':
            return './ENGINE_PATH/index.js';
        case 'performance':
            return './playcanvas.prf.mjs';
        case 'debug':
            return './playcanvas.dbg.mjs';
    }
    return './playcanvas.mjs';
};

export const stampedUrl = (url, stamp) => {
    return stamp ? `${url}${url.includes('?') ? '&' : '?'}t=${stamp}` : url;
};

export const targetName = ({ categoryKebab, exampleNameKebab }) => `${categoryKebab}_${exampleNameKebab}`;

export const getExample = (name) => {
    return exampleMetaData.find(item => targetName(item) === name);
};

export const getExamplePath = (item, file) => {
    const input = path.join(item.path, `${item.exampleNameKebab}.${file}`);
    if (fs.existsSync(input)) {
        return input;
    }
    return file === 'controls.mjs' ? 'templates/controls.mjs' : input;
};

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

export const entryKey = (name, file) => `${name}.${file.replace(/\.(?:mjs|js)$/, '')}`;

export const readExampleConfig = async (item) => {
    const src = path.join(item.path, `${item.exampleNameKebab}.example.mjs`);
    const code = await fs.promises.readFile(src, 'utf8');
    return parseConfig(code);
};

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

export const writeExampleHtml = async (item, files, options) => {
    const name = targetName(item);
    const html = await createExampleHtml(item, files, options);
    await fs.promises.mkdir(IFRAME_DIR, { recursive: true });
    await fs.promises.writeFile(`${IFRAME_DIR}/${name}.html`, html);
};

export const writeShareHtml = async (item) => {
    const name = targetName(item);
    const template = await fs.promises.readFile(SHARE_TEMPLATE, 'utf8');
    const html = template
    .replace(/@PATH/g, `${item.categoryKebab}/${item.exampleNameKebab}`)
    .replace(/@TITLE/g, `${item.exampleNameKebab.split('-').join(' ')}`)
    .replace(/@THUMB/g, `${name}_large`);
    if (/'@[A-Z0-9_]+'/.test(html)) {
        throw new Error('HTML file still has unreplaced values');
    }
    const dir = `dist/share/${name}`;
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(`${dir}/index.html`, html);
};

export const getExampleTargets = (nodeEnv = process.env.NODE_ENV ?? '') => {
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
        if (nodeEnv === 'production') {
            share.push(item);
        }

        for (let j = 0; j < files.length; j++) {
            const file = files[j];
            const input = getExamplePath(item, file);
            const output = `${IFRAME_DIR}/${name}.${file}`;
            if (/\.(?:mjs|js)$/.test(file)) {
                if (file === 'example.mjs' || file === 'controls.mjs') {
                    sources.push({ src: input, dest: output });
                } else {
                    local[entryKey(name, file)] = input;
                }
            } else {
                assets.push({ src: input, dest: output });
            }
        }
    }

    return { local, sources, assets, html, share };
};

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
