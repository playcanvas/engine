import { TRACEID_RENDER_QUEUE } from '../../../core/constants.js';
import { Debug, DebugHelper } from '../../../core/debug.js';

/**
 * A WebGPU implementation of the Buffer.
 *
 * @ignore
 */
class WebgpuBuffer {
    /**
     * @type {GPUBuffer|null}
     * @private
     */
    buffer = null;

    usageFlags = 0;

    constructor(usageFlags = 0) {
        this.usageFlags = usageFlags;
    }

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

    allocate(device, size) {
        Debug.assert(!this.buffer, "Buffer already allocated");
        this.buffer = device.wgpu.createBuffer({
            size,
            usage: this.usageFlags
        });
    }

    /**
     * @param {import('./webgpu-graphics-device.js').WebgpuGraphicsDevice} device - Graphics device.
     * @param {*} storage -
     */
    unlock(device, storage) {

        const wgpu = device.wgpu;

        // offset of getMappedRange must me a multiple of 8
        // size of getMappedRange must be a multiple of 4

        if (!this.buffer) {
            // size needs to be a multiple of 4
            // note: based on specs, descriptor.size must be a multiple of 4 if descriptor.mappedAtCreation is true
            const size = (storage.byteLength + 3) & ~3;

            this.usageFlags |= GPUBufferUsage.COPY_DST;
            this.allocate(device, size);

            DebugHelper.setLabel(this.buffer,
                                 this.usageFlags & GPUBufferUsage.VERTEX ? 'VertexBuffer' :
                                     this.usageFlags & GPUBufferUsage.INDEX ? 'IndexBuffer' :
                                         this.usageFlags & GPUBufferUsage.UNIFORM ? "UniformBuffer" :
                                             this.usageFlags & GPUBufferUsage.STORAGE ? "StorageBuffer" :
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
    }

    read(device, offset, size, data) {
        return device.readStorageBuffer(this, offset, size, data);
    }

    write(device, bufferOffset, data, dataOffset, size) {
        device.writeStorageBuffer(this, bufferOffset, data, dataOffset, size);
    }

    clear(device, offset, size) {
        device.clearStorageBuffer(this, offset, size);
    }
}

export { WebgpuBuffer };
