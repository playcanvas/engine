import { createFilter } from '@rollup/pluginutils';

/** @typedef {import('rollup').Plugin} Plugin */
/** @typedef {string | string[]} GlobPattern */
/**
 * @typedef {Object | null} PluginOptions
 * @property {GlobPattern?} include - pattern(s array) to import
 * @property {GlobPattern?} exclude - pattern(s array) to ignore
 * @property {boolean?} enabled - enable the plugin
 */

/**
 * @type {readonly string[]}
 */
const DEFAULT_SHADERS = Object.freeze(['**/*.js']);

/**
 * @param {PluginOptions} options - Plugin config object
 * @returns {Plugin} The plugin that converts shader code.
 */
export function shaderChunks({
    include = DEFAULT_SHADERS,
    exclude = undefined
} = {}) {
    const filter = createFilter(include, exclude);

    return {
        name: 'shaderChunks',
        transform(source, shader) {
            if (!filter(shader)) return;

            source = source.replace(/\/\* *glsl *\*\/\s*(`.*?`)/gs, function (match, glsl) {
                return glsl
                    .trim() // trim whitespace
                    .replace(/\r/g, '') // Remove carriage returns
                    .replace(/ {4}/g, '\t') // 4 spaces to tabs
                    .replace(/[ \t]*\/\/.*/g, '') // remove single line comments
                    .replace(/[ \t]*\/\*[\s\S]*?\*\//g, '') // remove multi line comments
                    .concat('\n') // ensure final new line
                    .replace(/\n{2,}/g, '\n'); // condense 2 or more empty lines to 1
            });

            return {
                code: source,
                map: null
            };
        }
    };
}
