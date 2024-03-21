const regexPatterns = [
    /^\s*export\s*\*\s*from\s*.+\s*;\s*$/gm,
    /^\s*export\s*{.*}\s*from\s*.+\s*;\s*$/gm,
    /^\s*import\s*.+\s*;\s*$/gm
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
export const isModuleWithExternalDependencies = content => regexPatterns.some(pattern => pattern.test(content));
