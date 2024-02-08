/**
 * @param {string} str - The source string.
 * @returns {Function} - The built function.
 */
export function buildFunction(str) {
    if (str.call) {
        return str;
    }
    // eslint-disable-next-line no-new-func
    return new Function('return ' + str)();
}

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
 * Can load UMD and ESM. UMD registers itself into globalThis, while ESM is handled
 * to specifically to do the same, so we achieve the same result, no matter which
 * target build/src we linked to.
 *
 * @param {string} name - The name to attach to the window.
 * @param {string} src - The source url.
 */
export async function importScript(name, src) {
    const module = await import(src);
    const isESM = Object.keys(module).length;
    if (isESM) {
        window[name] = module;
    }
}

/**
 * @param {string} url - The URL to ES5 file.
 * @returns {Promise<Object>} - The module exports
 *
 * @example
 * const CORE = await load('https://cdn.jsdelivr.net/npm/@loaders.gl/core@2.3.6/dist/dist.min.js');
 * const DRACO = await load('https://cdn.jsdelivr.net/npm/@loaders.gl/draco@2.3.6/dist/dist.min.js');
 */
export async function loadES5(url) {
    const res = await fetch(url);
    const txt = await res.text();
    const module = {
        exports: {}
    };
    // eslint-disable-next-line no-new-func
    return (Function('module', 'exports', txt).call(module, module, module.exports), module).exports;
}

/**
 * @param {boolean} webGPUEnabled - WebGPU enabled.
 * @returns {string} - The device type.
 */
export function getDeviceType(webGPUEnabled) {
    const savedDevice = localStorage.getItem('preferredGraphicsDevice');
    if (webGPUEnabled) {
        let preferredDevice = 'webgpu';
        // Lack of Chrome's WebGPU support on Linux
        if (navigator.platform.includes('Linux') && navigator.appVersion.includes("Chrome")) {
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
