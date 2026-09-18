import { BINDGROUP_VIEW } from './constants.js';

/**
 * @import { BindGroupFormat, BindTextureFormat } from './bind-group-format.js'
 * @import { GraphicsDevice } from './graphics-device.js'
 * @import { UniformBufferFormat } from './uniform-buffer-format.js'
 * @import { VertexFormat } from './vertex-format.js'
 */

/**
 * Options to drive shader processing to add support for bind groups and uniform buffers.
 *
 * @ignore
 */
class ShaderProcessorOptions {
    /** @type {UniformBufferFormat[]} */
    uniformFormats = [];

    /** @type {BindGroupFormat[]} */
    bindGroupFormats = [];

    /** @type {VertexFormat[]} */
    vertexFormat;

    /**
     * Constructs shader processing options, used to process the shader for uniform buffer support.
     *
     * @param {UniformBufferFormat} [viewUniformFormat] - Format of the view uniform buffer. The
     * view bind group contains only this single uniform buffer (no textures), so its layout is
     * derived from the uniform format alone and no bind group format is required.
     * @param {VertexFormat} [vertexFormat] - Format of the vertex buffer.
     */
    constructor(viewUniformFormat, vertexFormat) {

        // construct a sparse array
        this.uniformFormats[BINDGROUP_VIEW] = viewUniformFormat;

        this.vertexFormat = vertexFormat;
    }

    /**
     * Get the bind group index for the uniform name.
     *
     * @param {string} name - The name of the uniform.
     * @returns {boolean} - Returns true if the uniform exists, false otherwise.
     */
    hasUniform(name) {
        return this.getUniformBindGroup(name) >= 0;
    }

    /**
     * Get the index of the bind group whose uniform buffer contains the uniform.
     *
     * @param {string} name - The name of the uniform.
     * @returns {number} - The bind group index, or -1 if no uniform buffer contains the uniform.
     */
    getUniformBindGroup(name) {
        for (let i = 0; i < this.uniformFormats.length; i++) {
            const uniformFormat = this.uniformFormats[i];
            if (uniformFormat?.get(name)) {
                return i;
            }
        }
        return -1;
    }

    /**
     * Get the bind group texture slot for the texture uniform name.
     *
     * @param {string} name - The name of the texture uniform.
     * @returns {boolean} - Returns true if the texture uniform exists, false otherwise.
     */
    hasTexture(name) {
        return !!this.getTexture(name);
    }

    /**
     * Get the format of the texture, if one of the supplied bind groups contains it.
     *
     * @param {string} name - The name of the texture.
     * @returns {BindTextureFormat|null} - The format of the texture, or null if no supplied bind
     * group contains it.
     */
    getTexture(name) {

        for (let i = 0; i < this.bindGroupFormats.length; i++) {
            const groupFormat = this.bindGroupFormats[i];
            const textureFormat = groupFormat?.getTexture(name);
            if (textureFormat) {
                return textureFormat;
            }
        }

        return null;
    }

    getVertexElement(semantic) {
        return this.vertexFormat?.elements.find(element => element.name === semantic);
    }

    /**
     * Generate unique key representing the processing options.
     *
     * @param {GraphicsDevice} device - The device.
     * @returns {string} - Returns the key.
     */
    generateKey(device) {
        // the formats describe their layout in a key computed once in their constructors, and
        // the bind group index they are assigned to is part of the emitted declaration
        let key = '';
        const { uniformFormats, bindGroupFormats } = this;
        for (let i = 0; i < uniformFormats.length; i++) {
            const format = uniformFormats[i];
            if (format) {
                key += `|u${i}:${format.key}`;
            }
        }
        for (let i = 0; i < bindGroupFormats.length; i++) {
            const format = bindGroupFormats[i];
            if (format) {
                key += `|b${i}:${format.key}`;
            }
        }

        // WebGPU shaders are processed per vertex format
        if (device.isWebGPU) {
            key += `|v:${this.vertexFormat?.shaderProcessingHashString}`;
        }

        return key;
    }
}

export { ShaderProcessorOptions };
