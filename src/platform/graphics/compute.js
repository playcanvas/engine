/**
 * A representation of a compute shader with the associated data, that can be executed on the GPU.
 *
 * @ignore
 */
class Compute {
    /**
     * A compute shader.
     *
     * @type {import('./shader.js').Shader|null}
     * @ignore
     */
    shader = null;

    /**
     * Create a compute instance. Note that this is supported on WebGPU only and is a no-op on
     * other platforms.
     *
     * @param {import('./graphics-device.js').GraphicsDevice} graphicsDevice -
     * The graphics device.
     * @param {import('./shader.js').Shader} shader - The compute shader.
     */
    constructor(graphicsDevice, shader) {
        this.device = graphicsDevice;
        this.shader = shader;

        if (graphicsDevice.supportsCompute) {
            this.impl = graphicsDevice.createComputeImpl(this);
        }
    }

    /**
     * Dispatch the compute work.
     *
     * @param {number} x - X dimension of the grid of work-groups to dispatch.
     * @param {number} [y] - Y dimension of the grid of work-groups to dispatch.
     * @param {number} [z] - Z dimension of the grid of work-groups to dispatch.
     */
    dispatch(x, y, z) {
        this.impl?.dispatch(x, y, z);
    }

    /**
     * Get a buffer that contains the data of the specified storage texture.
     * This needs to be called before dispatch! But can be called before device.startComputePass().
     *
     * @param {import('./texture.js').Texture} texture - The texture to get the buffer for.
     * @returns {import('./buffer.js').Buffer} The buffer.
     */
    getTextureBuffer(texture) {
        return this.impl?.getTextureBuffer(texture);
    }

    /**
     * Get a buffer that contains the data of the specified buffer.
     * This needs to be called before dispatch! But can be called before device.startComputePass().
     *
     * @param {import('./buffer.js').Buffer} buffer - The buffer to get the data from.
     * @returns {import('./buffer.js').Buffer} The buffer.
     */
    getBuffer(buffer) {
        return this.impl?.getBuffer(buffer);
    }
}

export { Compute };
