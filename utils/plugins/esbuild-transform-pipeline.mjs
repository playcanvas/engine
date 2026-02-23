import fs from 'fs';
import { processJSCC } from './esbuild-jscc.mjs';
import { buildStripPattern, applyStrip } from './esbuild-strip.mjs';
import { processShaderChunks } from './esbuild-shader-chunks.mjs';
import { applyDynamicImportLegacy, applyDynamicImportSuppress } from './esbuild-dynamic.mjs';

/**
 * Apply all source transforms to a string of source code.
 * Shared by the esbuild pipeline plugin (bundled builds) and the
 * unbundled build path which transforms files directly.
 *
 * @param {string} source - Source code to transform.
 * @param {Object} options - Transform options.
 * @param {Object<string, string|number>} options.jsccValues - JSCC variable values.
 * @param {boolean} options.jsccKeepLines - Preserve line count for JSCC.
 * @param {RegExp|null} options.stripPattern - Compiled strip pattern (null = skip).
 * @param {boolean} options.processShaders - Whether to minify shader chunks.
 * @param {boolean} options.dynamicImportLegacy - Wrap imports for legacy browsers.
 * @param {boolean} options.dynamicImportSuppress - Add bundler-suppress comments.
 * @returns {string} Transformed source.
 */
export function applyTransforms(source, {
    jsccValues, jsccKeepLines, stripPattern,
    processShaders: doShaders, dynamicImportLegacy,
    dynamicImportSuppress
}) {
    source = processJSCC(source, jsccValues, jsccKeepLines);
    if (doShaders) source = processShaderChunks(source);
    if (stripPattern) source = applyStrip(source, stripPattern);
    if (dynamicImportLegacy) source = applyDynamicImportLegacy(source);
    if (dynamicImportSuppress) source = applyDynamicImportSuppress(source);
    return source;
}

export { buildStripPattern };

/**
 * Combined esbuild plugin that applies all source transforms in a single
 * onLoad handler. esbuild only runs the FIRST matching onLoad handler per
 * file, so all transforms must be in one plugin to chain correctly.
 *
 * @param {Object} options - Pipeline options.
 * @param {Object<string, string|number>} options.jsccValues - JSCC variable values.
 * @param {boolean} [options.jsccKeepLines] - Preserve line count for JSCC.
 * @param {string[]} [options.stripFunctions] - Functions to strip (null = don't strip).
 * @param {boolean} [options.processShaders] - Whether to minify shader chunks.
 * @param {boolean} [options.dynamicImportLegacy] - Wrap imports for legacy browsers.
 * @param {boolean} [options.dynamicImportSuppress] - Add bundler-suppress comments.
 * @returns {import('esbuild').Plugin} The esbuild plugin.
 */
export function transformPipelinePlugin({
    jsccValues = {},
    jsccKeepLines = false,
    stripFunctions = null,
    processShaders = false,
    dynamicImportLegacy = false,
    dynamicImportSuppress = false
} = {}) {
    const stripPattern =
        stripFunctions ? buildStripPattern(stripFunctions) : null;

    return {
        name: 'transform-pipeline',
        setup(build) {
            build.onLoad({ filter: /\.js$/ }, async (args) => {
                const source = await fs.promises.readFile(args.path, 'utf8');
                const result = applyTransforms(source, {
                    jsccValues,
                    jsccKeepLines,
                    stripPattern,
                    processShaders,
                    dynamicImportLegacy,
                    dynamicImportSuppress
                });
                return { contents: result, loader: 'js' };
            });
        }
    };
}
