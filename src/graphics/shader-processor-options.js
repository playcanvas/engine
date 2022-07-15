import { BINDGROUP_VIEW } from "./constants.js";

/** @typedef {import('./bind-group-format.js').BindGroupFormat} BindGroupFormat */
/** @typedef {import('./uniform-buffer-format.js').UniformBufferFormat} UniformBufferFormat */

class ShaderProcessorOptions {
    /** @type {Array<UniformBufferFormat>}*/
    uniformFormats = [];

    /** @type {Array<BindGroupFormat>}*/
    bindGroupFormats = [];

    /**
     * Constructs shader processing options, used to process the shader for uniform buffer support.
     *
     * @param {UniformBufferFormat} viewUniformFormat - Format of the uniform buffer.
     * @param {BindGroupFormat} viewBindGroupFormat - Format of the bind group.
     */
    constructor(viewUniformFormat, viewBindGroupFormat) {

        // construct a sparse array
        this.uniformFormats[BINDGROUP_VIEW] = viewUniformFormat;
        this.bindGroupFormats[BINDGROUP_VIEW] = viewBindGroupFormat;
    }

    /**
     * Get the bind group index for the uniform name.
     *
     * @param {string} name - The name of the uniform.
     * @returns {boolean} - Returns true if the uniform exists, false otherwise.
     */
    hasUniform(name) {

        for (let i = 0; i < this.uniformFormats.length; i++) {
            const uniformFormat = this.uniformFormats[i];
            if (uniformFormat.get(name)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Get the bind group texture slot for the texture uniform name.
     *
     * @param {string} name - The name of the texture uniform.
     * @returns {boolean} - Returns true if the texture uniform exists, false otherwise.
     */
    hasTexture(name) {

        for (let i = 0; i < this.bindGroupFormats.length; i++) {
            const groupFormat = this.bindGroupFormats[i];
            if (groupFormat.getTexture(name)) {
                return true;
            }
        }

        return false;
    }
}

export { ShaderProcessorOptions };
