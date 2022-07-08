/** @typedef {import('./graphics-device.js').GraphicsDevice} GraphicsDevice */

/**
 * @ignore
 */
class BindBufferFormat {
    constructor(name, visibility) {
        /** @type {string} */
        this.name = name;

        // SHADER_STAGE_VERTEX, SHADER_STAGE_FRAGMENT, SHADER_STAGE_COMPUTE
        this.visibility = visibility;
    }
}

/**
 * @ignore
 */
class BindTextureFormat {
    constructor(name, visibility) {
        /** @type {string} */
        this.name = name;

        // SHADER_STAGE_VERTEX, SHADER_STAGE_FRAGMENT, SHADER_STAGE_COMPUTE
        this.visibility = visibility;
    }
}

/**
 * @ignore
 */
class BindGroupFormat {
    /**
     * @param {GraphicsDevice} graphicsDevice - The graphics device used to manage this vertex format.
     * @param {BindBufferFormat[]} bufferFormats -
     * @param {BindTextureFormat[]} textureFormats -
     */
    constructor(graphicsDevice, bufferFormats, textureFormats) {
        /** @type {GraphicsDevice} */
        this.device = graphicsDevice;

        /** @type {BindBufferFormat[]} */
        this.bufferFormats = bufferFormats;

        // maps a buffer format name to an index
        /** @type {Map<string, number>} */
        this.bufferFormatsMap = new Map();
        bufferFormats.forEach((bf, i) => this.bufferFormatsMap.set(bf.name, i));

        /** @type {BindTextureFormat[]} */
        this.textureFormats = textureFormats;

        // maps a texture format name to a slot index
        /** @type {Map<string, number>} */
        this.textureFormatsMap = new Map();
        textureFormats.forEach((tf, i) => this.textureFormatsMap.set(tf.name, i));

        this.impl = graphicsDevice.createBindGroupFormatImpl(this);
    }

    /**
     * Frees resources associated with this bind group.
     */
    destroy() {
        this.impl.destroy();
    }

    /**
     * Returns format of texture with specified name.
     *
     * @param {string} name - The name of the texture slot.
     * @returns {BindTextureFormat} - The format.
     */
    getTexture(name) {
        const index = this.textureFormatsMap.get(name);
        if (index) {
            return this.textureFormats[index];
        }

        return null;
    }

    getShaderDeclarationTextures(bindGroup) {
        let code = '';
        let bindIndex = this.bufferFormats.length;
        this.textureFormats.forEach((format) => {

            // TODO: suport different types of textures and samplers

            code += `layout(set = ${bindGroup}, binding = ${bindIndex++}) uniform texture2D ${format.name};\n` +
                    `layout(set = ${bindGroup}, binding = ${bindIndex++}) uniform sampler ${format.name}_sampler;\n`;
        });

        return code;
    }

    loseContext() {
        // TODO: implement
    }
}

export { BindBufferFormat, BindTextureFormat, BindGroupFormat };
