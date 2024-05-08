import { Debug } from '../../core/debug.js';
import { math } from '../../core/math/math.js';

/**
 * A container for storing the used areas of a pair of staging and gpu buffers.
 *
 * @ignore
 */
class UsedBuffer {
    /** @type {import('./dynamic-buffer.js').DynamicBuffer} */
    gpuBuffer;

    /** @type {import('./dynamic-buffer.js').DynamicBuffer} */
    stagingBuffer;

    /**
     * The beginning position of the used area that needs to be copied from staging to to the GPU
     * buffer.
     *
     * @type {number}
     */
    offset;

    /**
     * Used byte size of the buffer, from the offset.
     *
     * @type {number}
     */
    size;
}

/**
 * A container for storing the return values of an allocation function.
 *
 * @ignore
 */
class DynamicBufferAllocation {
    /**
     * The storage access to the allocated data in the staging buffer.
     *
     * @type {Int32Array}
     */
    storage;

    /**
     * The gpu buffer this allocation will be copied to.
     *
     * @type {import('./dynamic-buffer.js').DynamicBuffer}
     */
    gpuBuffer;

    /**
     * Offset in the gpuBuffer where the data will be copied to.
     *
     * @type {number}
     */
    offset;
}

/**
 * The DynamicBuffers class provides a dynamic memory allocation system for uniform buffer data,
 * particularly for non-persistent uniform buffers. This class utilizes a bump allocator to
 * efficiently allocate aligned memory space from a set of large buffers managed internally. To
 * utilize this system, the user writes data to CPU-accessible staging buffers. When submitting
 * command buffers that require these buffers, the system automatically uploads the data to the GPU
 * buffers. This approach ensures efficient memory management and smooth data transfer between the
 * CPU and GPU.
 *
 * @ignore
 */
class DynamicBuffers {
    /**
     * Allocation size of the underlying buffers.
     *
     * @type {number}
     */
    bufferSize;

    /**
     * Internally allocated gpu buffers.
     *
     * @type {import('./dynamic-buffer.js').DynamicBuffer[]}
     */
    gpuBuffers = [];

    /**
     * Internally allocated staging buffers (CPU writable)
     *
     * @type {import('./dynamic-buffer.js').DynamicBuffer[]}
     */
    stagingBuffers = [];

    /**
     * @type {UsedBuffer[]}
     */
    usedBuffers = [];

    /**
     * @type {UsedBuffer}
     */
    activeBuffer = null;

    /**
     * Create the system of dynamic buffers.
     *
     * @param {import('./graphics-device.js').GraphicsDevice} device - The graphics device.
     * @param {number} bufferSize - The size of the underlying large buffers.
     * @param {number} bufferAlignment - Alignment of each allocation.
     */
    constructor(device, bufferSize, bufferAlignment) {
        this.device = device;
        this.bufferSize = bufferSize;
        this.bufferAlignment = bufferAlignment;
    }

    /**
     * Destroy the system of dynamic buffers.
     */
    destroy() {

        this.gpuBuffers.forEach((gpuBuffer) => {
            gpuBuffer.destroy(this.device);
        });
        this.gpuBuffers = null;

        this.stagingBuffers.forEach((stagingBuffer) => {
            stagingBuffer.destroy(this.device);
        });
        this.stagingBuffers = null;

        this.usedBuffers = null;
        this.activeBuffer = null;
    }

    /**
     * Allocate an aligned space of the given size from a dynamic buffer.
     *
     * @param {DynamicBufferAllocation} allocation - The allocation info to fill.
     * @param {number} size - The size of the allocation.
     */
    alloc(allocation, size) {

        // if we have active buffer without enough space
        if (this.activeBuffer) {
            const alignedStart = math.roundUp(this.activeBuffer.size, this.bufferAlignment);
            const space = this.bufferSize - alignedStart;
            if (space < size) {

                // we're done with this buffer, schedule it for submit
                this.scheduleSubmit();
            }
        }

        // if we don't have an active buffer, allocate new one
        if (!this.activeBuffer) {

            // gpu buffer
            let gpuBuffer = this.gpuBuffers.pop();
            if (!gpuBuffer) {
                gpuBuffer = this.createBuffer(this.device, this.bufferSize, false);
            }

            // staging buffer
            let stagingBuffer = this.stagingBuffers.pop();
            if (!stagingBuffer) {
                stagingBuffer = this.createBuffer(this.device, this.bufferSize, true);
            }

            this.activeBuffer = new UsedBuffer();
            this.activeBuffer.stagingBuffer = stagingBuffer;
            this.activeBuffer.gpuBuffer = gpuBuffer;
            this.activeBuffer.offset = 0;
            this.activeBuffer.size = 0;
        }

        // allocate from active buffer
        const activeBuffer = this.activeBuffer;
        const alignedStart = math.roundUp(activeBuffer.size, this.bufferAlignment);
        Debug.assert(alignedStart + size <= this.bufferSize, `The allocation size of ${size} is larger than the buffer size of ${this.bufferSize}`);

        allocation.gpuBuffer = activeBuffer.gpuBuffer;
        allocation.offset = alignedStart;
        allocation.storage = activeBuffer.stagingBuffer.alloc(alignedStart, size);

        // take the allocation from the buffer
        activeBuffer.size = alignedStart + size;
    }

    scheduleSubmit() {

        if (this.activeBuffer) {
            this.usedBuffers.push(this.activeBuffer);
            this.activeBuffer = null;
        }
    }

    submit() {

        // schedule currently active buffer for submit
        this.scheduleSubmit();
    }
}

export { DynamicBuffers, DynamicBufferAllocation };
