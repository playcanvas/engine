/**
 * This rollup plugin transform code with dynamic import statements and wraps them
 * in a `new Function('import("modulePath")')` statement, in order to avoid parsing errors in older browsers
 * without support for dynamic imports.
 *
 * Note that whilst this will prevent parsing errors, it can trigger CSP errors.
 */

export function dynamicImportTransform() {
    return {
        name: 'dynamic-import-transform',
        transform(code, id) {
            /**
             * Transforms the code by replacing `import(` with `new Function("return import")(`.
             * @param {string} code - The code to transform.
             * @param {string} id - The id of the code.
             * @returns {object} - The transformed code and map.
             */
            return {
                code: code.replace(/([^\w])import\(/g, '$1new Function("modulePath", "return import(modulePath)")('),
                map: null
            };
        }
    };
}
