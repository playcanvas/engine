import files from './files.mjs';

const href = window.top?.location.href ?? '';
const params = getQueryParams(href);
const url = new URL(href);
const root = url.pathname.replace(/\/([^/]+\.html)?$/g, '');
const MODULE_EXTENSION = /\.mjs$/;
const TEXT_EXTENSION = /\.(?:frag|vert|wgsl|glsl|html|css|txt)$/;
const JSON_EXTENSION = /\.json$/;
const MODULE_TYPE = 'text/javascript';
const RELATIVE_SPECIFIER = /^\.{1,2}\//;
const IMPORT_EXPORT_SPECIFIER = /(\b(?:from|import)[ \t\r\n]*)(['"])(\.{1,2}\/[^'"\r\n]+)\2/g;

/**
 * @type {string}
 */
export const rootPath = root.replace(/\/iframe/g, '');

/**
 * @param {string} url - The URL specified.
 * @returns {Record<string, string>} - The object of query parameters
 */
export function getQueryParams(url) {
    return Object.fromEntries(url
    .split('?').pop()
    .split('#')[0]
    .split('&').map(s => s.split('=')));
}

/**
 * @param {string} url - The URL of the file.
 * @returns {Promise<string>} - The contents of the file.
 */
export async function fetchFile(url) {
    const res = await fetch(url);
    return res.text();
}

/**
 * @param {string} url - The URL to ES5 file.
 * @returns {Promise<Object>} - The module exports.
 *
 * @example
 * const CORE = await loadES5('https://cdn.jsdelivr.net/npm/@loaders.gl/core@2.3.6/dist/dist.min.js');
 * const DRACO = await loadES5('https://cdn.jsdelivr.net/npm/@loaders.gl/draco@2.3.6/dist/dist.min.js');
 */
export async function loadES5(url) {
    const txt = await fetchFile(url);
    const module = {
        exports: {}
    };
    // eslint-disable-next-line no-new-func
    return (Function('module', 'exports', txt).call(module, module, module.exports), module).exports;
}

/**
 * @type {string[]}
 */
const blobUrls = [];
const moduleUrls = new Map();
const moduleUrlTasks = new Map();
const moduleStack = [];

/**
 * @param {string} name - The name of the current file.
 * @param {string} specifier - The relative module specifier.
 * @returns {string} The resolved file name.
 */
const resolveModuleName = (name, specifier) => {
    const url = new URL(specifier, `https://example.local/${name}`);
    return url.pathname.slice(1);
};

/**
 * @param {string} name - The name of the local file.
 * @param {string} source - The module source.
 * @returns {string} The module URL.
 */
const createBlobModule = (name, source) => {
    const blob = new Blob([source], { type: MODULE_TYPE });
    const url = URL.createObjectURL(blob);
    moduleUrls.set(name, url);
    blobUrls.push(url);
    return url;
};

/**
 * @param {string} name - The name of the local file.
 * @param {string[]} [stack] - The module stack.
 * @returns {Promise<string>} The module URL.
 */
function createModuleUrl(name, stack = moduleStack) {
    if (moduleUrls.has(name)) {
        return Promise.resolve(moduleUrls.get(name));
    }
    if (files[name] === undefined) {
        throw new Error(`Module not found: ${name}`);
    }
    if (MODULE_EXTENSION.test(name)) {
        const idx = stack.indexOf(name);
        if (idx !== -1) {
            throw new Error(`Circular module import: ${stack.slice(idx).concat(name).join(' -> ')}`);
        }
    }
    if (moduleUrlTasks.has(name)) {
        return moduleUrlTasks.get(name);
    }

    const task = createModuleUrlTask(name, stack).then((result) => {
        moduleUrlTasks.delete(name);
        return result;
    }, (err) => {
        moduleUrlTasks.delete(name);
        throw err;
    });
    moduleUrlTasks.set(name, task);
    return task;
}

/**
 * @param {string} name - The name of the local file.
 * @param {string[]} stack - The module stack.
 * @returns {Promise<string>} The module URL.
 */
async function createModuleUrlTask(name, stack) {
    if (TEXT_EXTENSION.test(name)) {
        const source = `export default ${JSON.stringify(files[name])};`;
        return createBlobModule(name, source);
    }

    if (JSON_EXTENSION.test(name)) {
        const json = await Promise.resolve()
        .then(() => JSON.parse(files[name]))
        .then(value => value, (err) => {
            throw new Error(`Invalid JSON module: ${name}`, { cause: err });
        });
        const source = `export default ${JSON.stringify(json)};`;
        return createBlobModule(name, source);
    }

    if (!MODULE_EXTENSION.test(name)) {
        throw new Error(`Invalid module: ${name}`);
    }

    const next = stack.concat(name);
    const imports = [];
    for (const match of files[name].matchAll(IMPORT_EXPORT_SPECIFIER)) {
        const [text, prefix, quote, specifier] = match;
        if (!RELATIVE_SPECIFIER.test(specifier)) {
            continue;
        }
        imports.push({
            text,
            prefix,
            quote,
            specifier,
            index: match.index
        });
    }

    const urls = await Promise.all(imports.map(item => createModuleUrl(resolveModuleName(name, item.specifier), next)));
    const parts = [];
    let offset = 0;
    for (let i = 0; i < imports.length; i++) {
        const item = imports[i];
        parts.push(files[name].slice(offset, item.index));
        parts.push(`${item.prefix}${item.quote}${urls[i]}${item.quote}`);
        offset = item.index + item.text.length;
    }
    parts.push(files[name].slice(offset));

    return createBlobModule(name, parts.join(''));
}

/**
 * Imports a local file as a module.
 *
 * @param {string} name - The name of the local file.
 * @returns {Promise<any>} - The module exports.
 */
export function importModule(name) {
    return createModuleUrl(name).then(url => import(url));
}

/**
 * Clears all the blob URLs.
 */
export function clearImports() {
    blobUrls.forEach(URL.revokeObjectURL);
    blobUrls.length = 0;
    moduleUrls.clear();
    moduleUrlTasks.clear();
    moduleStack.length = 0;
}

/**
 * @param {string} script - The script to parse.
 * @returns {Record<string, any>} - The parsed config.
 */
export function parseConfig(script) {
    const regex = /\/\/ @config (\S+)(?:[ \t]+([^\n]+))?/g;
    let match;
    /** @type {Record<string, any>} */
    const config = {};
    while ((match = regex.exec(script)) !== null) {
        const key = match[1].trim();
        const val = match[2]?.trim();
        config[key] = /true|false/.test(val) ? val === 'true' : val ?? true;
    }
    return config;
}

const DEVICE_TYPES = ['webgpu', 'webgpu:bare', 'webgl2', 'null'];
const isWebGPU = dt => dt === 'webgpu' || dt.startsWith('webgpu:');
export let deviceType = 'webgl2';

/**
 * @param {{ WEBGPU_DISABLED: boolean; WEBGL_DISABLED: boolean; }} config - The configuration object.
 */
export function updateDeviceType(config) {
    const savedDevice = localStorage.getItem('preferredGraphicsDevice') ?? 'webgl2';
    deviceType = DEVICE_TYPES.includes(savedDevice) ? savedDevice : 'webgl2';

    if (params.deviceType && DEVICE_TYPES.includes(params.deviceType)) {
        console.warn('Overriding default device: ', params.deviceType);
        deviceType = params.deviceType;
        return;
    }

    if (config.WEBGL_DISABLED && config.WEBGPU_DISABLED) {
        console.warn('Both WebGL 2.0 and WebGPU are disabled. Using Null device instead.');
        deviceType = 'null';
        return;
    }
    if (config.WEBGPU_DISABLED && isWebGPU(deviceType)) {
        console.warn('WebGPU is disabled. Using WebGL 2.0 device instead.');
        deviceType = 'webgl2';
        return;
    }
    if (config.WEBGL_DISABLED && !isWebGPU(deviceType)) {
        console.warn('WebGL 2.0 is disabled. Using WebGPU device instead.');
        deviceType = 'webgpu';
    }
    if (config.WEBGPU_BARE_DISABLED && deviceType === 'webgpu:bare') {
        console.warn('WebGPU Bare is disabled for this example. Using WebGPU instead.');
        deviceType = 'webgpu';
    }
}

/**
 * @param {string} eventName - The name of the fired event.
 * @param {object} detail - The detail object.
 */
export function fire(eventName, detail = {}) {
    window.top?.dispatchEvent(new CustomEvent(eventName, { detail }));
}
