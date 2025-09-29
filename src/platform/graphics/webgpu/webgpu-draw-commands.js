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
        this.gpuIndirect = new Uint32Array(5 * maxCount);
        this.gpuIndirectSigned = new Int32Array(this.gpuIndirect.buffer);
        this.storage = new StorageBuffer(this.device, this.gpuIndirect.byteLength, BUFFERUSAGE_INDIRECT | BUFFERUSAGE_COPY_DST);
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
     */
    update(count) {
        if (this.storage && count > 0) {
            const used = count * 5; // 5 uints per draw
            this.storage.write(0, this.gpuIndirect, 0, used);
        }
    }

    destroy() {
        this.storage?.destroy();
        this.storage = null;
    }
}

export { WebgpuDrawCommands };
