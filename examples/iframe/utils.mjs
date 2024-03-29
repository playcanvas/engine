import config from '@examples/config';

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

function isLinuxChrome() {
    // Lack of Chrome's WebGPU support on Linux
    return navigator.platform.includes('Linux') && navigator.appVersion.includes("Chrome");
}

/**
 * @returns {string} - The device type.
 */
function getDeviceType() {
    if (config.WEBGPU_REQUIRED) {
        if (isLinuxChrome()) {
            return 'webgl2';
        }
        return 'webgpu';
    }

    if (params.deviceType) {
        console.warn("Overwriting default deviceType from URL");
        return params.deviceType;
    }

    const savedDevice = localStorage.getItem('preferredGraphicsDevice');
    if (config.WEBGPU_ENABLED) {
        let preferredDevice = 'webgpu';
        if (isLinuxChrome()) {
            preferredDevice = 'webgl2';
        }
        return savedDevice || preferredDevice;
    }

    switch (savedDevice) {
        case 'webgpu':
            console.warn('Picked WebGPU but example is not supported on WebGPU, defaulting to WebGL2');
            return 'webgl2';
        case 'webgl1':
        case 'webgl2':
            return savedDevice;
        default:
            return 'webgl2';
    }
}
export const deviceType = getDeviceType();

/**
 * @param {string} eventName - The name of the fired event.
 * @param {object} detail - The detail object.
 */
export function fire(eventName, detail = {}) {
    window.top?.dispatchEvent(new CustomEvent(eventName, { detail }));
}
