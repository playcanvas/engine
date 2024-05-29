/**
 * This rollup plugin transform code with dynamic import statements and wraps them
 * in a `new Function('import("modulePath")')` statement, in order to avoid parsing errors in older browsers
 * without support for dynamic imports.
 *
 * Note that whilst this will prevent parsing errors, it can trigger CSP errors.
 *
 * @returns {import('rollup').Plugin} The rollup plugin
 */
export function dynamicImportLegacyBrowserSupport() {
    return {
        name: 'dynamic-import-old-browsers',
        transform(code, id) {
            return {
                code: code.replace(/([^\w])import\(/g, '$1new Function("modulePath", "return import(modulePath)")('),
                map: null
            };
        }
    };
}

/**
 * This rollup plugin transform code with import statements and adds a \/* vite-ignore *\/ comment to suppress bundler warnings
 * generated from dynamic-import-vars {@link https://github.com/rollup/plugins/tree/master/packages/dynamic-import-vars#limitations}
 * {@link https://webpack.js.org/api/module-methods/#dynamic-expressions-in-import}
 *
 * @returns {import('rollup').Plugin} The rollup plugin
 */
export function dynamicImportBundlerSuppress() {
    return {
        name: 'dynamic-import-bundler-suppress',
        transform(code, id) {
            return {
                code: code.replace(/import\(([^'])/g, 'import(/* @vite-ignore */ /* webpackIgnore: true */ $1'),
                map: null
            };
        }
    };
}
