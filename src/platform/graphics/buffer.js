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

    destroy(device) {
        this.impl?.destroy(device);
    }

    /**
     * Returns a mapped range of the underlying buffer.
     * On WebGPU this will wait for the buffer to be copied to the CPU.
     *
     * @returns {Promise<Uint8Array|undefined>} The mapped range.
     */
    async getMappedRange() {
        return await this.impl?.getMappedRange?.();
    }
}

export { Buffer };
