/* eslint-disable regexp/no-super-linear-backtracking */
const regexPatterns = [
    /^\s*export\s*\*\s*from\s*(?:\S.*|[\t\v\f \xa0\u1680\u2000-\u200a\u202f\u205f\u3000\ufeff])\s*;\s*$/gm,
    /^\s*export\s*\{.*\}\s*from\s*(?:\S.*|[\t\v\f \xa0\u1680\u2000-\u200a\u202f\u205f\u3000\ufeff])\s*;\s*$/gm,
    /^\s*import\s*(?:\S.*|[\t\v\f \xa0\u1680\u2000-\u200a\u202f\u205f\u3000\ufeff])\s*;\s*$/gm
];

/**
 * Checks if the provided content matches any of a set of patterns indicative of an ES Module with external dependencies.
 * Patterns checked include certain export and import statement formats.
 *
 * @param {string} content - The file content to test.
 * @returns {boolean} Whether the content is likely an ES Module with external dependencies.
 * @example
 * isModuleWithExternalDependencies(`
 *     // Testing variants:
 *     export * from './index.mjs';
 *     export { Ray } from './core/shape/ray.js';
 *     import './polyfill/OESVertexArrayObject.js';
 * `);
 */
export const isModuleWithExternalDependencies = (content) => {
    return regexPatterns.some(pattern => pattern.test(content));
};

/**
 * @typedef {object} ExampleConfig
 * @property {string} [DESCRIPTION] - The example description.
 * @property {boolean} [HIDDEN] - The example is hidden on production.
 * @property {'development' | 'performance' | 'debug'} [ENGINE] - The engine type.
 * @property {boolean} [NO_DEVICE_SELECTOR] - No device selector.
 * @property {boolean} [NO_MINISTATS] - No ministats.
 * @property {boolean} [WEBGPU_DISABLED] - If webgpu is disabled.
 * @property {boolean} [WEBGL_DISABLED] - If webgl is disabled.
 * @property {boolean} [E2E_TEST] - If E2E test is enabled.
 */

/**
 * Parser for the example config.
 *
 * @param {string} script - The script to parse.
 * @returns {ExampleConfig} - The parsed config.
 */
export const parseConfig = (script) => {
    const regex = /\/\/ @config (\S+)(?:\s+([^\n]+))?/g;
    let match;
    /** @type {Record<string, any>} */
    const config = {};
    while ((match = regex.exec(script)) !== null) {
        const key = match[1].trim();
        const val = match[2]?.trim();
        config[key] = /true|false/.test(val) ? val === 'true' : val ?? true;
    }
    return config;
};
