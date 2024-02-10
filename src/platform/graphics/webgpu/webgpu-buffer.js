import { TRACEID_RENDER_QUEUE } from '../../../core/constants.js';
import { Debug, DebugHelper } from '../../../core/debug.js';

/**
 * A WebGPU implementation of the Buffer.
 *
 * @ignore
 */
class WebgpuBuffer {
    /**
     * @type {GPUBuffer}
     * @private
     */
    buffer = null;

    init(device, options) {
        this.buffer = device.wgpu.createBuffer(options);
    }

    destroy(device) {
        if (this.buffer) {
            this.buffer.unmap();
            this.buffer.destroy();
            this.buffer = null;
        }
    }

    get size() {
        return this.buffer ? this.buffer.size : 0;
    }

    get initialized() {
        return !!this.buffer;
    }

    loseContext() {
    }

    /**
     * @param {import('./webgpu-graphics-device.js').WebgpuGraphicsDevice} device - Graphics device.
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

            DebugHelper.setLabel(this.buffer,
                                 target & GPUBufferUsage.VERTEX ? 'VertexBuffer' :
                                     target & GPUBufferUsage.INDEX ? 'IndexBuffer' :
                                         target & GPUBufferUsage.UNIFORM ? "UniformBuffer" :
                                             ''
            );


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

        // src size needs to be a multiple of 4 as well
        const srcOffset = storage.byteOffset ?? 0;
        const srcData = new Uint8Array(storage.buffer ?? storage, srcOffset, storage.byteLength);
        const data = new Uint8Array(this.buffer.size);
        data.set(srcData);

        // copy data to the gpu buffer
        Debug.trace(TRACEID_RENDER_QUEUE, `writeBuffer: ${this.buffer.label}`);
        wgpu.queue.writeBuffer(this.buffer, 0, data, 0, data.length);

        // TODO: handle usage types:
        // - BUFFER_STATIC, BUFFER_DYNAMIC, BUFFER_STREAM, BUFFER_GPUDYNAMIC
    }

    /**
     * Map the buffer to CPU memory for reading or writing. After the promise is resolved, the buffer
     * is mapped and can be accessed through the `getMappedRange` method.
     *
     * @param {boolean} write - Map for writing, otherwise map for reading, default is false.
     * @returns {Promise<void>} The mapped range.
     */
    async mapAsync(write) {
        if (this.buffer) {
            await this.buffer.mapAsync(write ? GPUMapMode.WRITE : GPUMapMode.READ);
        }
    }

    /**
     * Unmap the buffer from CPU memory so it can be used by the GPU.
     */
    unmap() {
        if (this.buffer) {
            this.buffer.unmap();
        }
    }

    /**
     * Returns a mapped range of the underlying buffer.
     *
     * @returns {ArrayBuffer|undefined} The mapped range.
     */
    getMappedRange() {
        if (!this.buffer) {
            return;
        }

        return this.buffer.getMappedRange();
    }
}

export { WebgpuBuffer };
