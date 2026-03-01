/**
 * Minify shader code inside template literals marked with
 * `/* glsl *\/` or `/* wgsl *\/` comments.
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
