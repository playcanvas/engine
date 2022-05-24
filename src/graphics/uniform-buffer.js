import { Debug } from '../core/debug.js';

/** @typedef {import('./graphics-device.js').GraphicsDevice} GraphicsDevice */
/** @typedef {import('./uniform-buffer-format.js').UniformBufferFormat} UniformBufferFormat */

/**
 * A uniform buffer represents a GPU memory buffer storing the uniforms.
 *
 * @ignore
 */
class UniformBuffer {
    /**
     * Create a new UniformBuffer instance.
     *
     * @param {GraphicsDevice} graphicsDevice - The graphics device used to manage this uniform buffer.
     * @param {UniformBufferFormat} format - Format of the uniform buffer
     */
    constructor(graphicsDevice, format) {
        this.device = graphicsDevice;
        this.format = format;

        this.impl = graphicsDevice.createUniformBufferImpl(this);


        // TODO: maybe size rounding up should be done here and not per platform


        this.storage = new ArrayBuffer(format.byteSize);
        this.storageFloat32 = new Float32Array(this.storage);

        // TODO: register with the device and handle lost context
        // this.device.buffers.push(this);
    }

    /**
     * Frees resources associated with this uniform buffer.
     */
    destroy() {

        // // stop tracking the vertex buffer
        const device = this.device;

        // TODO: remove the buffer from the list on the device (lost context handling)

        this.impl.destroy(device);

        // TODO: track used memory
        // device._vram.vb -= this.storage.byteLength;
    }

    /**
     * Called when the rendering context was lost. It releases all context related resources.
     *
     * @ignore
     */
    loseContext() {
        this.impl.loseContext();
    }

    set(name, value) {
        const uniform = this.format.map.get(name);
        Debug.assert(uniform, `Uniform [${name}] is not part of the Uniform buffer.`);
        if (uniform) {
            const offset = uniform.offset;
            this.storageFloat32.set(value, offset);
        }
    }

    update() {
        // Upload the new data
        this.impl.unlock(this);
    }
}

export { UniformBuffer };
