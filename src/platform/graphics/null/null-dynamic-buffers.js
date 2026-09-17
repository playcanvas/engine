import { DynamicBuffer } from '../dynamic-buffer.js';
import { DynamicBuffers } from '../dynamic-buffers.js';

/**
 * @import { DynamicBufferAllocation } from '../dynamic-buffers.js'
 * @import { GraphicsDevice } from '../graphics-device.js'
 */

/**
 * A Null implementation of the dynamic buffers system. It hands out CPU-only storage so the
 * renderer's (unconditional) view uniform buffer path runs without errors and uploads nothing. A
 * single base DynamicBuffer is reused for every allocation - it provides getBindGroup (which caches
 * per uniform buffer size) and a no-op upload, which is all the null device needs.
 *
 * @ignore
 */
class NullDynamicBuffers extends DynamicBuffers {
    /** @type {DynamicBuffer} */
    buffer;

    /**
     * Byte size of the storage the buffer currently has.
     *
     * @type {number}
     */
    storageSize = 0;

    /**
     * @param {GraphicsDevice} device - The graphics device.
     */
    constructor(device) {
        super(device, 0, 0);
        this.buffer = new DynamicBuffer(device);
    }

    /**
     * @param {DynamicBufferAllocation} allocation - The allocation info to fill.
     * @param {number} size - The size of the allocation.
     */
    alloc(allocation, size) {

        // nothing reads the data back, so the storage of the single buffer serves every
        // allocation, grown to the largest one asked for
        if (this.storageSize < size) {
            this.storageSize = size;
            this.buffer.setStorage(new ArrayBuffer(size));
        }

        allocation.gpuBuffer = this.buffer;
        allocation.offset = 0;
        allocation.storageBuffer = this.buffer;
        allocation.storageOffset = 0;
    }
}

export { NullDynamicBuffers };
