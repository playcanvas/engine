import { Debug } from '../../core/debug.js';

/**
 * ...
 *
 * @ignore
 */
class Buffer {
    /**
     * @type {import('./webgpu/webgpu-buffer.js').WebgpuBuffer|null}
     * @private
     */
    impl = null;

    /**
     * @param {import('./graphics-device.js').GraphicsDevice} device - The graphics device
     * used to manage this buffer.
     * @param {object} options - The options for the buffer.
     * @param {number} options.size - The size of the buffer in bytes.
     * @param {number} [options.usage] - The usage of the buffer. One of:
     * `pc.BUFFER_USAGE_STORAGE`, `pc.BUFFER_USAGE_COPY_SRC`, `pc.BUFFER_USAGE_COPY_DST`,
     * `pc.BUFFER_USAGE_MAP_READ`.
     * @param {boolean} [options.mappedAtCreation] - Whether the buffer is mapped at
     * creation. Default is `false`.
     */
    constructor(device, options) {
        Debug.assert(device, "Texture constructor requires a graphicsDevice to be valid");
        Debug.assert(options.size, "Texture constructor requires a size to be valid");
        Debug.assert(options.usage, "Texture constructor requires a usage to be valid");

        this.impl = device.createBufferImpl(options);
    }

    destroy(device) {
        this.impl?.destroy(device);
    }

    get size() {
        return this.impl?.size || 0;
    }

    /**
     * Map the buffer to CPU memory for reading or writing. After the promise is resolved, the buffer
     * is mapped and can be accessed through the `getMappedRange` method.
     *
     * @param {boolean} write - Map for writing, otherwise map for reading, default is false.
     * @returns {Promise<void>} The mapped range.
     */
    async mapAsync(write) {
        await this.impl?.mapAsync(write);
    }

    /**
     * Unmap the buffer from CPU memory so it can be used by the GPU.
     */
    unmap() {
        this.impl?.unmap();
    }

    /**
     * Returns a mapped range of the underlying buffer.
     *
     * @returns {ArrayBuffer|undefined} The mapped range.
     */
    getMappedRange() {
        return this.impl?.getMappedRange();
    }
}

export { Buffer };
