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

    read(offset = 0, size = this.byteSize, data = null) {
        return this.impl.read(this.device, offset, size, data);
    }

    write(bufferOffset = 0, data, dataOffset = 0, size) {
        this.impl.write(this.device, bufferOffset, data, dataOffset, size);
    }

    clear(offset = 0, size = this.byteSize) {
        this.impl.clear(this.device, offset, size);
    }
}

export { StorageBuffer };
