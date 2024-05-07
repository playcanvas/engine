/**
 * @typedef {object} ExampleConfig
 * @property {string} [DESCRIPTION] - The example description.
 * @property {boolean} [HIDDEN] - The example is hidden on production.
 * @property {'DEVELOPMENT' | 'PERFORMANCE' | 'DEBUG'} [ENGINE] - The engine type.
 * @property {boolean} [INCLUDE_AR_LINK] - Include AR link png.
 * @property {boolean} [NO_DEVICE_SELECTOR] - No device selector.
 * @property {boolean} [NO_CANVAS] - No canvas element.
 * @property {boolean} [NO_MINISTATS] - No ministats.
 * @property {boolean} [WEBGPU_ENABLED] - If webGPU is enabled.
 * @property {boolean} [WEBGPU_REQUIRED] - If webGPU is required (overrides {@link WEBGPU_ENABLED} ).
 */

/**
 * @param {string} script - The script to parse.
 * @returns {ExampleConfig} - The parsed config.
 */
export function parseConfig(script) {
    const regex = /\/\/ @flag ([^ \n]+) ?([^\n]+)?/g;
    let match;
    /** @type {Record<string, any>} */
    const config = {};
    while ((match = regex.exec(script)) !== null) {
        config[match[1]] = match[2] ?? true;
    }
    return config;
}

/**
 * Choose engine based on `Example#ENGINE`, e.g. ClusteredLightingExample picks PERFORMANCE.
 *
 * @param {string | undefined} type - The engine type.
 * @returns {string} - The build file.
 */
export function engineFor(type) {
    switch (type) {
        case 'DEVELOPMENT':
            return './ENGINE_PATH/index.js';
        case 'PERFORMANCE':
            return './playcanvas.prf/src/index.js';
        case 'DEBUG':
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
