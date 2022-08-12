/** @typedef {import('./webgpu-graphics-device.js').WebgpuGraphicsDevice} WebgpuGraphicsDevice */

/**
 * A WebGPU implementation of the Buffer.
 *
 * @ignore
 */
class WebgpuBuffer {
    /** @type {GPUBuffer} */
    buffer = null;

    destroy(device) {
        if (this.buffer) {
            this.buffer.destroy();
            this.buffer = null;
        }
    }

    loseContext() {
    }

    /**
     * @param {WebgpuGraphicsDevice} device - Graphics device.
     * @param {*} usage -
     * @param {*} target -
     * @param {*} storage -
     */
    unlock(device, usage, target, storage) {

        const wgpu = device.wgpu;

        // offset of getMappedRange must me a multiple of 8
        // size of getMappedRange must be a multiple of 4

        if (!this.buffer) {
            // size needs to be a multiple of 4
            const size = (storage.byteLength + 3) & ~3;

            this.buffer = device.wgpu.createBuffer({
                size: size,
                usage: target | GPUBufferUsage.COPY_DST
            });


            // mappedAtCreation path - this could be used when the data is provided

            // this.buffer = device.wgpu.createBuffer({
            //     size: size,
            //     usage: target,
            //     mappedAtCreation: true
            // });

            // const dest = new Uint8Array(this.buffer.getMappedRange());
            // const src = new Uint8Array(storage.buffer ? storage.buffer : storage);
            // dest.set(src);
            // this.buffer.unmap();
        }

        const src = new Uint8Array(storage.buffer ? storage.buffer : storage);
        wgpu.queue.writeBuffer(this.buffer, 0, src, 0, src.length);

        // TODO: handle usage types:
        // - BUFFER_STATIC, BUFFER_DYNAMIC, BUFFER_STREAM, BUFFER_GPUDYNAMIC
    }
}

export { WebgpuBuffer };
