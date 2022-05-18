/** @typedef {import('./graphics-device.js').GraphicsDevice} GraphicsDevice */
/** @typedef {import('./texture.js').Texture} Texture */
/** @typedef {import('./bind-group-format.js').BindGroupFormat} BindGroupFormat */

import { Debug } from '../core/debug.js';

/**
 * A bind group represents an collection of {@link UniformBuffer} and {@link Texture} instance,
 * which can be bind on a GPU for rendering.
 *
 * @ignore
 */
class BindGroup {
    /**
     * Create a new Bind Group.
     *
     * @param {GraphicsDevice} graphicsDevice - The graphics device used to manage this uniform buffer.
     * @param {BindGroupFormat} format - Format of the bind group.
     */
    constructor(graphicsDevice, format) {
        this.device = graphicsDevice;
        this.format = format;
        this.dirty = true;
        this.impl = graphicsDevice.createBindGroupImpl(this);

        this.textures = [];
        this.uniformBuffers = [];
    }

    /**
     * Assign a uniform buffer to a slot.
     *
     * @param {*} name - The name of the uniform buffer slot
     * @param {*} uniformBuffer - The Uniform buffer to assign to the slot.
     */
    setUniformBuffer(name, uniformBuffer) {
        const index = this.format.bufferFormatsMap.get(name);
        Debug.assert(index !== undefined, `Setting a uniform [${name}] on a bind group which does not contain in.`);
        if (this.uniformBuffers[index] !== uniformBuffer) {
            this.uniformBuffers[index] = uniformBuffer;
            this.dirty = true;
        }
    }

    /**
     * Assign a texture to a slot.
     *
     * @param {string} name - The name of the texture slot.
     * @param {Texture} texture - Texture to assign to the slot.
     */
    setTexture(name, texture) {
        const index = this.format.textureFormatsMap.get(name);
        Debug.assert(index !== undefined, `Setting a texture [${name}] on a bind group which does not contain in.`);
        if (this.textures[index] !== texture) {
            this.textures[index] = texture;
            this.dirty = true;
        }
    }

    /**
     * Frees resources associated with this bind group.
     */
    destroy() {
        this.impl.destroy();
    }

    /**
     * Applies any changes made to the bind group's properties.
     */
    update() {
        if (this.dirty) {
            this.dirty = false;
            this.impl.update(this);
        }
    }
}

export { BindGroup };
