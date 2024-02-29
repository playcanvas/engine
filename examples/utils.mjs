const regexpExportStarFrom =  /^\s*export\s*\*\s*from\s*.+\s*;\s*$/gm;
const regexpExportFrom     =  /^\s*export\s*{.*}\s*from\s*.+\s*;\s*$/gm;
const regexpImport         =  /^\s*import\s*.+\s*;\s*$/gm;
/**
 * If one of this RegExp's match, it's likely an ESM with external dependencies.
 * @example
 * isModuleWithExternalDependencies(`
 *    // Testing variants:
 *    export * from './index.mjs';
 *    export { Ray } from './core/shape/ray.js';
 *    import './polyfill/OESVertexArrayObject.js';
 *`);
 * @param {string} content - The file content to test.
 * @returns {boolean} Whether content is a module.
 */
export function isModuleWithExternalDependencies(content) {
    const a = regexpExportStarFrom.test(content);
    const b = regexpExportFrom.test(content);
    const c = regexpImport.test(content);
    // console.log('isModuleWithExternalDependencies', { a, b, c });
    return a || b || c;
}
