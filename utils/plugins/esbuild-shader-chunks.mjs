/**
 * @param {string} source - The source code.
 * @returns {string} The processed source code.
 */
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

export { processShaderChunks };
