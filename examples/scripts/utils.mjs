import fs from 'fs';

/**
 * @param {object} obj - The object.
 * @returns {string} - The stringified object
 */
export function objStringify(obj) {
    return JSON.stringify(obj, null, 4).replace(/"(\w+)":/g, '$1:');
}

/**
 * @param {string} path - The directory path.
 * @returns {string[]} - The file names in the directory.
 */
export function getDirFiles(path) {
    if (!fs.existsSync(path)) {
        return [];
    }
    const stats = fs.statSync(path);
    if (!stats.isDirectory()) {
        return [];
    }
    return fs.readdirSync(path);
}

/**
 * @typedef {'development' | 'performance' | 'debug'} Engine
 */

/**
 * @typedef {object} ExampleConfig
 * @property {string} [DESCRIPTION] - The example description.
 * @property {boolean} [HIDDEN] - The example is hidden on production.
 * @property {Engine} [ENGINE] - The engine type.
 * @property {boolean} [NO_DEVICE_SELECTOR] - No device selector.
 * @property {boolean} [NO_MINISTATS] - No ministats.
 * @property {boolean} [WEBGPU_DISABLED] - If webgpu is disabled.
 * @property {boolean} [WEBGL_DISABLED] - If webgl is disabled.
 */

/**
 * @param {string} script - The script to parse.
 * @returns {ExampleConfig} - The parsed config.
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

/**
 * Choose engine based on `Example#ENGINE`, e.g. ClusteredLightingExample picks PERFORMANCE.
 *
 * @param {Engine | undefined} type - The engine type.
 * @returns {string} - The build file.
 */
export function engineFor(type) {
    switch (type) {
        case 'development':
            return './ENGINE_PATH/index.js';
        case 'performance':
            return './playcanvas.prf/src/index.js';
        case 'debug':
            return './playcanvas.dbg/src/index.js';
    }
    return './playcanvas/src/index.js';
}

/**
 * @param {string} script - The script to be patched.
 * @returns {string} - The patched script.
 */
export function patchScript(script) {
    // remove playcanvas imports
    script = script.replace(/ *import[\s\w*{},]+["']playcanvas["'] *;?[\s\r\n]*/g, '');

    return script;
}
