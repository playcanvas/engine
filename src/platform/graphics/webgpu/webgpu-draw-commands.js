import { BUFFERUSAGE_COPY_DST, BUFFERUSAGE_INDIRECT } from '../constants.js';
import { StorageBuffer } from '../storage-buffer.js';

/**
 * @import { GraphicsDevice } from '../graphics-device.js'
 */

/**
 * WebGPU implementation of DrawCommands.
 *
 * @ignore
 */
class WebgpuDrawCommands {
    /** @type {GraphicsDevice} */
    device;

    /** @type {Uint32Array|null} */
    gpuIndirect = null;

    /** @type {Int32Array|null} */
    gpuIndirectSigned = null;

    /**
     * @type {StorageBuffer|null}
     */
    storage = null;

    /**
     * @param {GraphicsDevice} device - Graphics device.
     */
    constructor(device) {
        this.device = device;
    }

    /**
     * Allocate AoS buffer and backing storage buffer.
     * @param {number} maxCount - Number of sub-draws.
     */
    allocate(maxCount) {
        this.resize(maxCount, false);
    }

    /**
     * Resize AoS buffer and backing storage buffer.
     * @param {number} maxCount - Number of sub-draws.
     * @param {boolean} preserve - Whether to copy previous draw commands.
     */
    resize(maxCount, preserve) {

        // The required amount of memory has already been allocated.
        if (preserve && this.storage) {
            const requestedByteSize = 5 * maxCount * Uint32Array.BYTES_PER_ELEMENT;
            if (this.storage.byteSize === requestedByteSize) {
                return;
            }
        }

        const newGpuIndirect = new Uint32Array(5 * maxCount);
        const newGpuIndirectSigned = new Int32Array(newGpuIndirect.buffer);
        const newStorage = new StorageBuffer(this.device, newGpuIndirect.byteLength, BUFFERUSAGE_INDIRECT | BUFFERUSAGE_COPY_DST);

        if (preserve && this.storage) {
            const keepCount = Math.min(this.gpuIndirect.length, newGpuIndirect.length);
            const keepByteSize = Math.min(this.storage.byteSize, newStorage.byteSize);
            newStorage.copy(this.storage, 0, 0, keepByteSize);
            newGpuIndirect.set(this.gpuIndirect.subarray(0, keepCount));
        }

        this.storage?.destroy();
        this.storage = newStorage;
        this.gpuIndirect = newGpuIndirect;
        this.gpuIndirectSigned = newGpuIndirectSigned;
    }

    /**
     * Write a single draw entry.
     * @param {number} i - Draw index.
     * @param {number} indexOrVertexCount - Count of indices/vertices.
     * @param {number} instanceCount - Instance count.
     * @param {number} firstIndexOrVertex - First index/vertex.
     * @param {number} baseVertex - Base vertex (signed).
     * @param {number} firstInstance - First instance.
     */
    add(i, indexOrVertexCount, instanceCount, firstIndexOrVertex, baseVertex = 0, firstInstance = 0) {
        const o = i * 5;
        this.gpuIndirect[o + 0] = indexOrVertexCount;
        this.gpuIndirect[o + 1] = instanceCount;
        this.gpuIndirect[o + 2] = firstIndexOrVertex;
        this.gpuIndirectSigned[o + 3] = baseVertex;
        this.gpuIndirect[o + 4] = firstInstance;
    }

    /**
     * Upload AoS data to storage buffer.
     * @param {number} count - Number of active draws.
     * @returns {number} Total primitive count.
     */
    update(count) {
        if (this.storage && count > 0) {
            const used = count * 5; // 5 uints per draw
            this.storage.write(0, this.gpuIndirect, 0, used);
        }

        // calculate total primitives for stats
        let totalPrimitives = 0;

        // #if _PROFILER
        if (this.gpuIndirect && count > 0) {
            for (let d = 0; d < count; d++) {
                const offset = d * 5;
                const indexOrVertexCount = this.gpuIndirect[offset + 0];
                const instanceCount = this.gpuIndirect[offset + 1];
                totalPrimitives += indexOrVertexCount * instanceCount;
            }
        }
        // #endif

        return totalPrimitives;
    }

    destroy() {
        this.storage?.destroy();
        this.storage = null;
    }
}

export { WebgpuDrawCommands };
