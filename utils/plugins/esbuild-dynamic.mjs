/**
 * Wrap dynamic `import()` calls in `new Function(...)` for legacy browser support (UMD builds).
 *
 * @param {string} source - Source code.
 * @returns {string} Transformed source.
 */
export function applyDynamicImportLegacy(source) {
    return source.replace(/(\W)import\(/g, '$1new Function("modulePath", "return import(modulePath)")(');
}

/**
 * Add bundler-suppress comments before dynamic `import()` calls
 * to quiet Vite/webpack warnings (ESM builds).
 *
 * @param {string} source - Source code.
 * @returns {string} Transformed source.
 */
export function applyDynamicImportSuppress(source) {
    return source.replace(/import\(([^'])/g, 'import(/* @vite-ignore */ /* webpackIgnore: true */ $1');
}
