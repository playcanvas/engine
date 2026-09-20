import { TRACEID_RENDER_QUEUE } from '../../../core/constants.js';
import { Debug, DebugHelper } from '../../../core/debug.js';

/**
 * @import { WebgpuGraphicsDevice } from './webgpu-graphics-device.js'
 */

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
            // Defer destruction until after pending command buffers are submitted, since
            // a recorded command buffer may still reference this buffer through a bind group.
            device.deferDestroy(this.buffer);
            this.buffer = null;
        }
    }

    get initialized() {
        return !!this.buffer;
    }

    loseContext() {
        this.buffer = null;
    }

    allocate(device, size) {
        Debug.assert(!this.buffer, 'Buffer already allocated');
        this.buffer = device.wgpu.createBuffer({
            size,
            usage: this.usageFlags
        });

        DebugHelper.setLabel(this.buffer,
            this.usageFlags & GPUBufferUsage.VERTEX ? 'VertexBuffer' :
                this.usageFlags & GPUBufferUsage.INDEX ? 'IndexBuffer' :
                    this.usageFlags & GPUBufferUsage.UNIFORM ? 'UniformBuffer' :
                        this.usageFlags & GPUBufferUsage.STORAGE ? 'StorageBuffer' :
                            ''
        );
    }

    /**
     * @param {WebgpuGraphicsDevice} device - Graphics device.
     * @param {ArrayBuffer|ArrayBufferView} storage - CPU storage to upload.
     * @param {number} [byteOffset] - Byte offset in both the storage and GPU buffer. Defaults to 0.
     * @param {number} [byteLength] - Number of bytes to upload. Defaults to the remaining storage.
     */
    unlock(device, storage, byteOffset = 0, byteLength = storage.byteLength - byteOffset) {

        const wgpu = device.wgpu;

        // offset of getMappedRange must me a multiple of 8
        // size of getMappedRange must be a multiple of 4

        if (!this.buffer) {
            // Initialize all contents on first use, matching the WebGL allocation path.
            byteOffset = 0;
            byteLength = storage.byteLength;

            // size needs to be a multiple of 4
            // note: based on specs, descriptor.size must be a multiple of 4 if descriptor.mappedAtCreation is true
            const size = (storage.byteLength + 3) & ~3;

            this.usageFlags |= GPUBufferUsage.COPY_DST;
            this.allocate(device, size);

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

        // copy data to the gpu buffer
        Debug.trace(TRACEID_RENDER_QUEUE, `writeBuffer: ${this.buffer.label}`);
        const srcOffset = (storage.byteOffset ?? 0) + byteOffset;
        const srcBuffer = storage.buffer ?? storage;
        Debug.assert(byteOffset + byteLength <= this.buffer.size, 'Buffer data does not fit the allocated GPU buffer', this);

        if ((byteLength & 3) !== 0 && byteOffset === 0 && byteLength === storage.byteLength) {
            // Only full uploads can pad with zeros without overwriting live neighboring data.
            const data = new Uint8Array((byteLength + 3) & ~3);
            data.set(new Uint8Array(srcBuffer, srcOffset, byteLength));
            wgpu.queue.writeBuffer(this.buffer, byteOffset, data, 0, data.length);
        } else {
            // Invalid internal partial uploads should fail WebGPU validation, not overwrite neighbors through padding.
            wgpu.queue.writeBuffer(this.buffer, byteOffset, srcBuffer, srcOffset, byteLength);
        }
    }

    read(device, offset, size, data, immediate) {
        return device.readStorageBuffer(this, offset, size, data, immediate);
    }

    /**
     * @param {WebgpuGraphicsDevice} device - Graphics device.
     * @param {number} bufferOffset - The offset in bytes to start writing to the storage buffer.
     * @param {ArrayBufferView|ArrayBuffer} data - The data to write to the storage buffer.
     * @param {number} dataOffset - Offset in data to begin writing from. Given in elements if data
     * is a TypedArray and bytes otherwise.
     * @param {number} size - Size of content to write from data to buffer. Given in elements if
     * data is a TypedArray and bytes otherwise.
     */
    write(device, bufferOffset, data, dataOffset, size) {
        device.writeStorageBuffer(this, bufferOffset, data, dataOffset, size);
    }

    clear(device, offset, size) {
        device.clearStorageBuffer(this, offset, size);
    }
}

export { WebgpuBuffer };
