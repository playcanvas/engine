import { Debug } from '../../core/debug.js';
import { TRACEID_VRAM_SB } from '../../core/constants.js';
import { BUFFERUSAGE_STORAGE } from './constants.js';

let id = 0;

/**
 * A storage buffer represents a memory which both the CPU and the GPU can access. Typically it is
 * used to provide data for compute shader, and to store the result of the computation.
 * Note that this class is only supported on the WebGPU platform.
 *
 * @category Graphics
 */
class StorageBuffer {
    id = id++;

    /**
     * Create a new StorageBuffer instance.
     *
     * @param {import('./graphics-device.js').GraphicsDevice} graphicsDevice - The graphics device
     * used to manage this storage buffer.
     * @param {number} byteSize - The size of the storage buffer in bytes.
     * @param {number} [bufferUsage] - The usage type of the storage buffer. Can be a combination of
     * {@link BUFFERUSAGE_READ}, {@link BUFFERUSAGE_WRITE}, {@link BUFFERUSAGE_COPY_SRC} and
     * {@link BUFFERUSAGE_COPY_DST} flags. This parameter can be omitted if no special usage is
     * required.
     */
    constructor(graphicsDevice, byteSize, bufferUsage = 0) {
        this.device = graphicsDevice;
        this.byteSize = byteSize;
        this.bufferUsage = bufferUsage;

        this.impl = graphicsDevice.createBufferImpl(BUFFERUSAGE_STORAGE | bufferUsage);
        this.impl.allocate(graphicsDevice, byteSize);
        this.device.buffers.push(this);

        this.adjustVramSizeTracking(graphicsDevice._vram, this.byteSize);
    }

    /**
     * Frees resources associated with this storage buffer.
     */
    destroy() {

        // stop tracking the buffer
        const device = this.device;
        const idx = device.buffers.indexOf(this);
        if (idx !== -1) {
            device.buffers.splice(idx, 1);
        }

        this.adjustVramSizeTracking(device._vram, -this.byteSize);
        this.impl.destroy(device);
    }

    adjustVramSizeTracking(vram, size) {
        Debug.trace(TRACEID_VRAM_SB, `${this.id} size: ${size} vram.sb: ${vram.sb} => ${vram.sb + size}`);
        vram.sb += size;
    }

    /**
     * Read the contents of a storage buffer.
     *
     * @param {number} [offset] - The byte offset of data to read. Defaults to 0.
     * @param {number} [size] - The byte size of data to read. Defaults to the full size of the
     * buffer minus the offset.
     * @param {ArrayBufferView|null} [data] - Typed array to populate with the data read from the storage
     * buffer. When typed array is supplied, enough space needs to be reserved, otherwise only
     * partial data is copied. If not specified, the data is returned in an Uint8Array. Defaults to
     * null.
     * @returns {Promise<ArrayBufferView>} A promise that resolves with the data read from the storage
     * buffer.
     * @ignore
     */
    read(offset = 0, size = this.byteSize, data = null) {
        return this.impl.read(this.device, offset, size, data);
    }

    /**
     * Issues a write operation of the provided data into a storage buffer.
     *
     * @param {number} bufferOffset - The offset in bytes to start writing to the storage buffer.
     * @param {ArrayBufferView} data - The data to write to the storage buffer.
     * @param {number} dataOffset - Offset in data to begin writing from. Given in elements if data
     * is a TypedArray and bytes otherwise.
     * @param {number} size - Size of content to write from data to buffer. Given in elements if
     * data is a TypedArray and bytes otherwise.
     */
    write(bufferOffset = 0, data, dataOffset = 0, size) {
        this.impl.write(this.device, bufferOffset, data, dataOffset, size);
    }

    /**
     * Clear the content of a storage buffer to 0.
     *
     * @param {number} [offset] - The byte offset of data to clear. Defaults to 0.
     * @param {number} [size] - The byte size of data to clear. Defaults to the full size of the
     * buffer minus the offset.
     */
    clear(offset = 0, size = this.byteSize) {
        this.impl.clear(this.device, offset, size);
    }
}

export { StorageBuffer };
