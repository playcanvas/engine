import { BINDGROUP_VIEW } from "./constants.js";

/**
 * Options to drive shader processing to add support for bind groups and uniform buffers.
 *
 * @ignore
 */
class ShaderProcessorOptions {
    /** @type {import('./uniform-buffer-format.js').UniformBufferFormat[]} */
    uniformFormats = [];

    /** @type {import('./bind-group-format.js').BindGroupFormat[]} */
    bindGroupFormats = [];

    /** @type {import('./vertex-format.js').VertexFormat[]} */
    vertexFormat;

    /**
     * Constructs shader processing options, used to process the shader for uniform buffer support.
     *
     * @param {import('./uniform-buffer-format.js').UniformBufferFormat} [viewUniformFormat] - Format
     * of the uniform buffer.
     * @param {import('./bind-group-format.js').BindGroupFormat} [viewBindGroupFormat] - Format of
     * the bind group.
     * @param {import('./vertex-format.js').VertexFormat} [vertexFormat] - Format of the vertex
     * buffer.
     */
    constructor(viewUniformFormat, viewBindGroupFormat, vertexFormat) {

        // construct a sparse array
        this.uniformFormats[BINDGROUP_VIEW] = viewUniformFormat;
        this.bindGroupFormats[BINDGROUP_VIEW] = viewBindGroupFormat;

        this.vertexFormat = vertexFormat;
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
            if (uniformFormat?.get(name)) {
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
            if (groupFormat?.getTexture(name)) {
                return true;
            }
        }

        return false;
    }

    getVertexElement(semantic) {
        return this.vertexFormat?.elements.find(element => element.name === semantic);
    }

    /**
     * Generate unique key representing the processing options.
     *
     * @param {import('./graphics-device.js').GraphicsDevice} device - The device.
     * @returns {string} - Returns the key.
     */
    generateKey(device) {
        // TODO: Optimize. Uniform and BindGroup formats should have their keys evaluated in their
        // constructors, and here we should simply concatenate those.
        let key = JSON.stringify(this.uniformFormats) + JSON.stringify(this.bindGroupFormats);

        // WebGPU shaders are processed per vertex format
        if (device.isWebGPU) {
            key += this.vertexFormat?.shaderProcessingHashString;
        }

        return key;
    }
}

export { ShaderProcessorOptions };
