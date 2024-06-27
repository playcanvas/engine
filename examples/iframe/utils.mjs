import files from 'examples/files';

const href = window.top?.location.href ?? '';
const params = getQueryParams(href);
const url = new URL(href);
const root = url.pathname.replace(/\/([^/]+\.html)?$/g, '');

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

/**
 * Imports a local file as a module.
 *
 * @param {string} name - The name of the local file.
 * @returns {Promise<any>} - The module exports.
 */
export function localImport(name) {
    if (!/\.mjs$/.test(name)) {
        throw new Error(`Invalid module: ${name}`);
    }
    const blob = new Blob([files[name]], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    blobUrls.push(url);
    return import(url);
}

/**
 * Imports an absolute file as a module.
 *
 * @param {string} name - The name of the absolute file.
 * @returns {Promise<any>} - The module exports.
 */
export function fileImport(name) {
    return import(name);
}

/**
 * Clears all the blob URLs.
 */
export function clearImports() {
    blobUrls.forEach(URL.revokeObjectURL);
}

/**
 * @param {string} script - The script to parse.
 * @returns {Record<string, any>} - The parsed config.
 */
export function parseConfig(script) {
    const regex = /\/\/ @config ([^ \n]+) ?([^\n]+)?/g;
    let match;
    /** @type {Record<string, any>} */
    const config = {};
    while ((match = regex.exec(script)) !== null) {
        const key = match[1].trim();
        const val = match[2]?.trim();
        config[key] = /true|false/g.test(val) ? val === 'true' : val ?? true;
    }
    return config;
}

const DEVICE_TYPES = ['webgpu', 'webgl2', 'null'];
export let deviceType = 'webgl2';

/**
 * @param {{ WEBGPU_DISABLED: boolean; WEBGL_DISABLED: boolean; }} config - The configuration object.
 */
export function updateDeviceType(config) {
    if (params.deviceType && DEVICE_TYPES.includes(params.deviceType)) {
        console.warn("Overwriting default deviceType from URL: ", params.deviceType);
        deviceType = params.deviceType;
        return;
    }

    if (config.WEBGL_DISABLED && config.WEBGPU_DISABLED) {
        console.warn('Both WebGL and WebGPU are disabled. Using NullGraphicsDevice instead.');
        deviceType = 'null';
        return;
    }
    if (config.WEBGPU_DISABLED) {
        console.warn('WebGPU is disabled. Using WebGL2 instead.');
        deviceType = 'webgl2';
        return;
    }
    if (config.WEBGL_DISABLED) {
        console.warn('WebGL is disabled. Using WebGPU instead.');
        deviceType = 'webgpu';
        return;
    }

    const savedDevice = localStorage.getItem('preferredGraphicsDevice') ?? 'webgl2';
    deviceType = DEVICE_TYPES.includes(savedDevice) ? savedDevice : 'webgl2';
}

/**
 * @param {string} eventName - The name of the fired event.
 * @param {object} detail - The detail object.
 */
export function fire(eventName, detail = {}) {
    window.top?.dispatchEvent(new CustomEvent(eventName, { detail }));
}
