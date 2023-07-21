/**
 * Helper function to ensure a bit of backwards compatibility
 * @example
 * toLitArgs('litShaderArgs.sheen.specularity'); // Result: 'litArgs_sheen_specularity'
 * @param {string} src 
 * @returns {string}
 */
const toLitArgs = src => src.replace(/litShaderArgs([\.a-zA-Z]+)+/g, (a, b) => {
    return 'litArgs' + b.replaceAll(/\./g, '_');
});
// helper class for combining shader chunks together
// ensures every chunk ends with a new line otherwise shaders can be ill-formed
class ChunkBuilder {
    _code = '';

    set code(newCode) {
        this._code = newCode;
    }
    get code() {
        if (this._code.includes('litShaderArgs')) {
            this._code = toLitArgs(this._code);
        }
        return this._code;
    }

    append(...chunks) {
        chunks.forEach((chunk) => {
            if (chunk.endsWith('\n')) {
                this._code += chunk;
            } else {
                this._code += chunk + '\n';
            }
        });
    }

    prepend(...chunks) {
        chunks.forEach((chunk) => {
            if (chunk.endsWith('\n')) {
                this._code = chunk + this._code;
            } else {
                this._code = chunk + '\n' + this._code;
            }
        });
    }
}

export { ChunkBuilder };
