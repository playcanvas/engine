import fs from 'fs';

/**
 * esbuild plugin that minifies shader code inside template literals marked with
 * `/* glsl *\/` or `/* wgsl *\/` comments.
 *
 * Port of utils/plugins/rollup-shader-chunks.mjs.
 *
 * @returns {import('esbuild').Plugin} The esbuild plugin.
 */
export function shaderChunksPlugin() {
    return {
        name: 'shader-chunks',
        setup(build) {
            build.onLoad({ filter: /\.js$/ }, async (args) => {
                const raw = await fs.promises.readFile(args.path, 'utf8');
                const transformed = processShaderChunks(raw);
                if (transformed === raw) return undefined; // no change, skip
                return { contents: transformed, loader: 'js' };
            });
        }
    };
}

/**
 * Process shader chunks in source text — callable without esbuild for unbundled transforms.
 *
 * @param {string} source - Source code.
 * @returns {string} Processed source.
 */
export function processShaderChunks(source) {
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
}
