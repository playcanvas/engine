import { Debug } from '../../core/debug.js';
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
     * The names of the textures the renderer supplies per pass in the view bind group, or null when
     * the view bind group holds only the view uniform buffer.
     *
     * @type {Set<string>|null}
     */
    viewTextures = null;

    /**
     * Constructs shader processing options, used to process the shader for uniform buffer support.
     *
     * @param {UniformBufferFormat} [viewUniformFormat] - Format of the view uniform buffer, the
     * first binding of the view bind group.
     * @param {VertexFormat} [vertexFormat] - Format of the vertex buffer.
     * @param {Set<string>|null} [viewTextures] - The names of the textures which are part of the
     * view bind group, following the uniform buffer. On WebGPU each shader gets a view bind group
     * format of exactly the view textures it declares. Only used with a view uniform format, and
     * must be a function of it, as only the format is part of the processing key.
     */
    constructor(viewUniformFormat, vertexFormat, viewTextures) {

        // construct a sparse array
        this.uniformFormats[BINDGROUP_VIEW] = viewUniformFormat;

        this.vertexFormat = vertexFormat;

        if (viewUniformFormat && viewTextures) {
            this.viewTextures = viewTextures;
        }
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

    /**
     * Debug check of a uniform no supplied format claims, which so falls to the per-draw mesh
     * uniform buffer. A light uniform belongs in the view uniform buffer whenever a view format is
     * supplied, so one landing here means the lighting chunks declare something the format does
     * not carry, and it is uploaded per draw again.
     *
     * @param {string} name - The name of the uniform.
     */
    debugCheckMeshUniform(name) {
        Debug.call(() => {
            if (this.uniformFormats[BINDGROUP_VIEW] && /^light\d+_/.test(name)) {
                Debug.warnOnce(`Light uniform '${name}' is not part of the view uniform buffer format and is uploaded per draw. Add it to LightSlotUniforms#appendFormats.`);
            }
        });
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

        // WebGPU shaders are processed per vertex format, and the view textures move to the view
        // bind group. Their names follow from the view uniform format, and the format of that group
        // from the source, so only the flag is needed
        if (device.isWebGPU) {
            key += `|v:${this.vertexFormat?.shaderProcessingHashString}`;
            if (this.viewTextures) {
                key += '|vt';
            }
        }

        return key;
    }
}

export { ShaderProcessorOptions };
