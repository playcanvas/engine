import { hashCode } from '../../../core/hash.js';

class ShaderGenerator {
    /**
     * @param {Map<string, string>} defines - the set of defines to be used in the shader.
     * @returns {number} the hash code of the defines.
     */
    static definesHash(defines) {
        const sortedArray = Array.from(defines).sort((a, b) => (a[0] > b[0] ? 1 : -1));
        return hashCode(JSON.stringify(sortedArray));
    }
}

export { ShaderGenerator };
