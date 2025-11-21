import { Debug, DebugHelper } from '../../../core/debug.js';

/**
 * @import { UploadStream } from '../upload-stream.js'
 */

let id = 0;

/**
 * WebGPU implementation of UploadStream.
 * Can use either simple direct writes or optimized staging buffer strategy.
 *
 * @ignore
 */
class WebgpuUploadStream {
    /**
     * Available staging buffers ready for immediate use.
     *
     * @type {GPUBuffer[]}
     * @private
     */
    availableStagingBuffers = [];

    /**
     * Staging buffers currently in use by the GPU.
     *
     * @type {GPUBuffer[]}
     * @private
     */
    pendingStagingBuffers = [];

    _destroyed = false;

    /**
     * @param {UploadStream} uploadStream - The upload stream.
     */
    constructor(uploadStream) {
        this.uploadStream = uploadStream;
        this.useSingleBuffer = uploadStream.useSingleBuffer;
    }

    /**
     * Handles device lost event.
     * TODO: Implement proper WebGPU device lost handling if needed.
     *
     * @protected
     */
    _onDeviceLost() {
        // WebGPU device lost handling not yet implemented
    }

    destroy() {
        this._destroyed = true;
        this.availableStagingBuffers.forEach(buffer => buffer.destroy());
        this.pendingStagingBuffers.forEach(buffer => buffer.destroy());
    }

    /**
     * Update staging buffers: recycle completed ones and remove undersized buffers.
     *
     * @param {number} minByteSize - Minimum size for buffers to keep. Smaller buffers are destroyed.
     */
    update(minByteSize) {

        // map all pending buffers
        const pending = this.pendingStagingBuffers;
        for (let i = 0; i < pending.length; i++) {
            const buffer = pending[i];
            buffer.mapAsync(GPUMapMode.WRITE).then(() => {
                if (!this._destroyed) {
                    this.availableStagingBuffers.push(buffer);
                } else {
                    buffer.destroy();
                }
            });
        }
        pending.length = 0;

        // remove any available buffers that are too small
        const available = this.availableStagingBuffers;
        for (let i = available.length - 1; i >= 0; i--) {
            if (available[i].size < minByteSize) {
                available[i].destroy();
                available.splice(i, 1);
            }
        }
    }

    /**
     * Upload data to a storage buffer using staging buffers (optimized) or direct write (simple).
     *
     * @param {Uint8Array|Uint32Array|Float32Array} data - The data to upload.
     * @param {import('../storage-buffer.js').StorageBuffer} target - The target storage buffer.
     * @param {number} offset - The element offset in the target. Byte offset must be a multiple of 4.
     * @param {number} size - The number of elements to upload. Byte size must be a multiple of 4.
     */
    upload(data, target, offset, size) {
        if (this.useSingleBuffer) {
            // simple path: direct write (blocking)
            this.uploadDirect(data, target, offset, size);
        } else {
            // optimized path: staging buffers (non-blocking)
            this.uploadStaging(data, target, offset, size);
        }
    }

    /**
     * Direct storage buffer write (simple, blocking).
     *
     * @param {Uint8Array|Uint32Array|Float32Array} data - The data to upload.
     * @param {import('../storage-buffer.js').StorageBuffer} target - The target storage buffer.
     * @param {number} offset - The element offset in the target.
     * @param {number} size - The number of elements to upload.
     * @private
     */
    uploadDirect(data, target, offset, size) {
        const byteOffset = offset * data.BYTES_PER_ELEMENT;
        const byteSize = size * data.BYTES_PER_ELEMENT;

        // WebGPU requires 4-byte alignment for buffer operations
        Debug.assert(byteOffset % 4 === 0, `WebGPU upload offset in bytes (${byteOffset}) must be a multiple of 4`);
        Debug.assert(byteSize % 4 === 0, `WebGPU upload size in bytes (${byteSize}) must be a multiple of 4`);
        target.write(byteOffset, data, 0, size);
    }

    /**
     * Staging buffer-based upload.
     *
     * @param {Uint8Array|Uint32Array|Float32Array} data - The data to upload.
     * @param {import('../storage-buffer.js').StorageBuffer} target - The target storage buffer.
     * @param {number} offset - The element offset in the target.
     * @param {number} size - The number of elements to upload.
     * @private
     */
    uploadStaging(data, target, offset, size) {
        const device = this.uploadStream.device;

        const byteOffset = offset * data.BYTES_PER_ELEMENT;
        const byteSize = size * data.BYTES_PER_ELEMENT;

        // Update staging buffers
        this.update(byteSize);

        // WebGPU copyBufferToBuffer requires offset and size to be multiples of 4 bytes
        Debug.assert(byteOffset % 4 === 0, `WebGPU upload offset in bytes (${byteOffset}) must be a multiple of 4 for copyBufferToBuffer`);
        Debug.assert(byteSize % 4 === 0, `WebGPU upload size in bytes (${byteSize}) must be a multiple of 4 for copyBufferToBuffer`);

        // Get or create a staging buffer (guaranteed to be large enough after recycling)
        const buffer = this.availableStagingBuffers.pop() ?? (() => {
            // @ts-ignore - wgpu is available on WebgpuGraphicsDevice
            const newBuffer = this.uploadStream.device.wgpu.createBuffer({
                size: byteSize,
                usage: GPUBufferUsage.MAP_WRITE | GPUBufferUsage.COPY_SRC,
                mappedAtCreation: true
            });
            DebugHelper.setLabel(newBuffer, `UploadStream-Staging-${id++}`);
            return newBuffer;
        })();

        // Write to mapped range (non-blocking)
        const mappedRange = buffer.getMappedRange();
        new Uint8Array(mappedRange).set(new Uint8Array(data.buffer, data.byteOffset, byteSize));
        buffer.unmap();

        // Copy from staging to storage buffer (GPU-side)
        // @ts-ignore - getCommandEncoder is available on WebgpuGraphicsDevice
        device.getCommandEncoder().copyBufferToBuffer(
            buffer, 0,
            target.impl.buffer, byteOffset,
            byteSize
        );

        // Detect multiple uploads per frame (indicates command buffer hasn't been submitted yet)
        Debug.assert(
            this.pendingStagingBuffers.length === 0,
            'Multiple WebGPU staging buffer uploads detected in the same frame before command buffer submission. ' +
            'This can cause "buffer used while mapped" errors. Ensure only one upload occurs per frame.'
        );

        // Track for recycling
        this.pendingStagingBuffers.push(buffer);
    }
}

export { WebgpuUploadStream };
