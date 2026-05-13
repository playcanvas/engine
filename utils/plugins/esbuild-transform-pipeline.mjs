import fs from 'node:fs';
import jscc from 'jscc';

import { createStripTransform } from './esbuild-strip.mjs';

const processJSCC = (source, values, keepLines) => {
    const result = jscc(source, null, {
        values,
        keepLines,
        sourceMap: false,
        prefixes: ['// ']
    });

    return result.code;
};

const processShaderChunks = (source) => {
    return source.replace(/\/\* *(glsl|wgsl) *\*\/\s*(`.*?`)/gs, (match, type, code) => {
        return code
        .trim()
        .replace(/\r/g, '')
        .replace(/ {4}/g, '\t')
        .replace(/[ \t]*\/\/.*/g, '')
        .replace(/[ \t]*\/\*[\s\S]*?\*\//g, '')
        .concat('\n')
        .replace(/\n{2,}/g, '\n');
    });
};

/**
 * @param {string} source - The source code.
 * @param {object} options - The transform options.
 * @param {Record<string, string|number>} options.jsccValues - JSCC values.
 * @param {boolean} options.jsccKeepLines - Whether to preserve line count.
 * @param {((source: string, file?: string) => string)|null} options.strip - Strip transform.
 * @param {boolean} options.processShaders - Whether to process shader chunks.
 * @param {boolean} options.dynamicImportLegacy - Whether to wrap dynamic imports.
 * @param {boolean} options.dynamicImportSuppress - Whether to add bundler ignore comments.
 * @param {boolean} options.stripComments - Whether to strip JSDoc comments.
 * @param {string|null} options.importMetaUrl - UMD import.meta.url replacement.
 * @param {string} [file] - The file path.
 * @returns {string} The processed source code.
 */
const applyTransforms = (source, {
    jsccValues,
    jsccKeepLines,
    strip,
    processShaders,
    dynamicImportLegacy,
    dynamicImportSuppress,
    stripComments,
    importMetaUrl
}, file) => {
    source = processJSCC(source, jsccValues, jsccKeepLines);
    if (processShaders) {
        source = processShaderChunks(source);
    }
    if (strip) {
        source = strip(source, file);
    }
    if (stripComments) {
        source = source.replace(/\/\*\*[\s\S]*?\*\//g, '');
    }
    if (importMetaUrl) {
        source = source.replace(/import\.meta\.url/g, importMetaUrl);
    }
    if (dynamicImportLegacy) {
        source = source.replace(/(\W)import\(/g, '$1new Function("modulePath", "return import(modulePath)")(');
    }
    if (dynamicImportSuppress) {
        source = source.replace(/import\(([^'])/g, 'import(/* @vite-ignore */ /* webpackIgnore: true */ $1');
    }

    return source;
};

/**
 * @param {object} options - The transform plugin options.
 * @param {Record<string, string|number>} [options.jsccValues] - JSCC values.
 * @param {boolean} [options.jsccKeepLines] - Whether to preserve line count.
 * @param {string[]|null} [options.stripFunctions] - Functions to strip.
 * @param {boolean} [options.processShaders] - Whether to process shader chunks.
 * @param {boolean} [options.dynamicImportLegacy] - Whether to wrap dynamic imports.
 * @param {boolean} [options.dynamicImportSuppress] - Whether to add bundler ignore comments.
 * @param {boolean} [options.stripComments] - Whether to strip JSDoc comments.
 * @param {string|null} [options.importMetaUrl] - UMD import.meta.url replacement.
 * @returns {import('esbuild').Plugin} The esbuild plugin.
 */
const transformPipelinePlugin = ({
    jsccValues = {},
    jsccKeepLines = false,
    stripFunctions = null,
    processShaders = false,
    dynamicImportLegacy = false,
    dynamicImportSuppress = false,
    stripComments = false,
    importMetaUrl = null
} = {}) => {
    const strip = stripFunctions ? createStripTransform(stripFunctions) : null;

    return {
        name: 'transform-pipeline',
        setup(build) {
            build.onLoad({ filter: /\.js$/ }, async (args) => {
                const source = await fs.promises.readFile(args.path, 'utf8');
                const contents = applyTransforms(source, {
                    jsccValues,
                    jsccKeepLines,
                    strip,
                    processShaders,
                    dynamicImportLegacy,
                    dynamicImportSuppress,
                    stripComments,
                    importMetaUrl
                }, args.path);

                return { contents, loader: 'js' };
            });
        }
    };
};

export { applyTransforms, createStripTransform, transformPipelinePlugin };
