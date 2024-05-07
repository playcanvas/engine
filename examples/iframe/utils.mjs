import config from '@examples/config';
import files from '@examples/files';

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
 * @returns {Promise<Object>} - The module exports.
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
 * Clears all the blob URLs.
 */
export function clearImports() {
    blobUrls.forEach(URL.revokeObjectURL);
}

function isLinuxChrome() {
    // Lack of Chrome's WebGPU support on Linux
    return navigator.platform.includes('Linux') && navigator.appVersion.includes("Chrome");
}

const DEVICE_TYPES = ['webgpu', 'webgl2'];

/**
 * @returns {string} - The device type.
 */
function getDeviceType() {
    if (params.deviceType && DEVICE_TYPES.includes(params.deviceType)) {
        console.warn("Overwriting default deviceType from URL: ", params.deviceType);
        return params.deviceType;
    }

    if (config.WEBGPU_DISABLED) {
        return 'webgl2';
    }
    if (config.WEBGL_DISABLED) {
        if (isLinuxChrome()) {
            console.warn('WebGPU chosen but browser is not supported, defaulting to WebGL2');
            return 'webgl2';
        }
        return 'webgpu';
    }

    const savedDevice = localStorage.getItem('preferredGraphicsDevice') ?? 'webgl2';
    return DEVICE_TYPES.includes(savedDevice) ? savedDevice : 'webgl2';
}
export const deviceType = getDeviceType();

/**
 * @param {string} eventName - The name of the fired event.
 * @param {object} detail - The detail object.
 */
export function fire(eventName, detail = {}) {
    window.top?.dispatchEvent(new CustomEvent(eventName, { detail }));
}
