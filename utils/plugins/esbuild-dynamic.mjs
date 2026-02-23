import fs from 'fs';

/**
 * esbuild plugin that wraps dynamic `import()` calls in `new Function(...)` for
 * legacy browser support (UMD builds).
 *
 * Port of dynamicImportLegacyBrowserSupport from rollup-dynamic.mjs.
 *
 * @returns {import('esbuild').Plugin} The esbuild plugin.
 */
export function dynamicImportLegacyPlugin() {
    return {
        name: 'dynamic-import-legacy',
        setup(build) {
            build.onLoad({ filter: /\.js$/ }, async (args) => {
                const source = await fs.promises.readFile(args.path, 'utf8');
                const transformed = applyDynamicImportLegacy(source);
                if (transformed === source) return undefined;
                return { contents: transformed, loader: 'js' };
            });
        }
    };
}

/**
 * Apply legacy dynamic import transform — callable without esbuild.
 *
 * @param {string} source - Source code.
 * @returns {string} Transformed source.
 */
export function applyDynamicImportLegacy(source) {
    return source.replace(/(\W)import\(/g, '$1new Function("modulePath", "return import(modulePath)")(');
}

/**
 * esbuild plugin that adds bundler-suppress comments before dynamic `import()` calls
 * to quiet Vite/webpack warnings (ESM builds).
 *
 * Port of dynamicImportBundlerSuppress from rollup-dynamic.mjs.
 *
 * @returns {import('esbuild').Plugin} The esbuild plugin.
 */
export function dynamicImportSuppressPlugin() {
    return {
        name: 'dynamic-import-suppress',
        setup(build) {
            build.onLoad({ filter: /\.js$/ }, async (args) => {
                const source = await fs.promises.readFile(args.path, 'utf8');
                const transformed = applyDynamicImportSuppress(source);
                if (transformed === source) return undefined;
                return { contents: transformed, loader: 'js' };
            });
        }
    };
}

/**
 * Apply bundler suppress comments — callable without esbuild.
 *
 * @param {string} source - Source code.
 * @returns {string} Transformed source.
 */
export function applyDynamicImportSuppress(source) {
    return source.replace(/import\(([^'])/g, 'import(/* @vite-ignore */ /* webpackIgnore: true */ $1');
}
