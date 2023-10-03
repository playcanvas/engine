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

    destroy(device) {
        if (this.buffer) {
            this.buffer.destroy();
            this.buffer = null;
        }
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
}

export { WebgpuBuffer };
