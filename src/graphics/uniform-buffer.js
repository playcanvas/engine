import { Debug } from '../core/debug.js';

/** @typedef {import('./graphics-device.js').GraphicsDevice} GraphicsDevice */
/** @typedef {import('./uniform-buffer-format.js').UniformBufferFormat} UniformBufferFormat */
/** @typedef {import('./uniform-buffer-format.js').UniformFormat} UniformFormat */

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
        Debug.assert(format);

        this.impl = graphicsDevice.createUniformBufferImpl(this);


        // TODO: maybe size rounding up should be done here and not per platform


        this.storage = new ArrayBuffer(format.byteSize);
        this.storageFloat32 = new Float32Array(this.storage);

        graphicsDevice._vram.ub += this.format.byteSize;

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

        device._vram.ub -= this.format.byteSize;
    }

    /**
     * Called when the rendering context was lost. It releases all context related resources.
     *
     * @ignore
     */
    loseContext() {
        this.impl.loseContext();
    }

    /**
     * Assign a value to the uniform specified by its format. This is the fast version of assining
     * a valu to a uniform, avoiding any lookups.
     *
     * @param {UniformFormat} uniformFormat - The format of the uniform.
     */
    setUniform(uniformFormat) {
        Debug.assert(uniformFormat);
        const offset = uniformFormat.offset;

        const value = uniformFormat.scopeId.value;
        Debug.assert(value !== undefined, `Value was not set when assigning to uniform [${uniformFormat.name}]`);
        this.storageFloat32.set(value, offset);
    }

    /**
     * Assign a value to the uniform specified by name.
     *
     * @param {string} name - The name of the uniform.
     */
    set(name) {
        const uniformFormat = this.format.map.get(name);
        Debug.assert(uniformFormat, `Uniform name [${name}] is not part of the Uniform buffer.`);
        if (uniformFormat) {
            this.setUniform(uniformFormat);
        }
    }

    update() {

        // set new values
        const uniforms = this.format.uniforms;
        for (let i = 0; i < uniforms.length; i++) {
            this.setUniform(uniforms[i]);
        }

        // Upload the new data
        this.impl.unlock(this);
    }
}

export { UniformBuffer };
