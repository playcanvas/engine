/**
 * @param {string} source - The source code.
 * @returns {string} The processed source code.
 */
const applyDynamicImportLegacy = (source) => {
    return source.replace(/(\W)import\(/g, '$1new Function("modulePath", "return import(modulePath)")(');
};

/**
 * @param {string} source - The source code.
 * @returns {string} The processed source code.
 */
const applyDynamicImportSuppress = (source) => {
    return source.replace(/import\(([^'])/g, 'import(/* @vite-ignore */ /* webpackIgnore: true */ $1');
};

export { applyDynamicImportLegacy, applyDynamicImportSuppress };
