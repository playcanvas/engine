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
     * Returns slot index for a texture slot name.
     *
     * @param {string} name - The name of the texture slot.
     * @returns {number} - The slot index.
     */
    getTextureSlot(name) {
        return this.textureFormatsMap.get(name);
    }

    loseContext() {
        // TODO: implement
    }
}

export { BindBufferFormat, BindTextureFormat, BindGroupFormat };
