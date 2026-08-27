import { BUFFERUSAGE_COPY_DST, BUFFERUSAGE_INDIRECT } from '../constants.js';
import { StorageBuffer } from '../storage-buffer.js';
import { DebugHelper } from '../../../core/debug.js';

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
     * True if any of the first `count` draws have work.
     *
     * @type {boolean}
     */
    hasDraws = false;

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
        // Skip reallocation if size matches exactly
        if (this.gpuIndirect && this.gpuIndirect.length === 5 * maxCount) {
            return;
        }
        this.storage?.destroy();
        this.gpuIndirect = new Uint32Array(5 * maxCount);
        this.gpuIndirectSigned = new Int32Array(this.gpuIndirect.buffer);
        this.storage = new StorageBuffer(this.device, this.gpuIndirect.byteLength, BUFFERUSAGE_INDIRECT | BUFFERUSAGE_COPY_DST);
        DebugHelper.setName(this.storage, 'WebgpuDrawCommands.indirectStorage');
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
     * Upload AoS data to storage buffer, sets {@link hasDraws}.
     *
     * @param {number} count - Number of active draws.
     * @returns {number} Total primitive count.
     */
    update(count) {
        let totalPrimitives = 0;
        let hasDraws = false;

        if (this.gpuIndirect && count > 0) {

            if (this.storage) {
                const used = count * 5; // 5 uints per draw
                this.storage.write(0, this.gpuIndirect, 0, used);
            }

            for (let d = 0; d < count; d++) {
                const offset = d * 5;
                const indexOrVertexCount = this.gpuIndirect[offset + 0];
                const instanceCount = this.gpuIndirect[offset + 1];
                if (indexOrVertexCount > 0 && instanceCount > 0) {
                    hasDraws = true;
                }
                // #if _PROFILER
                totalPrimitives += indexOrVertexCount * instanceCount;
                // #endif
            }
        }

        this.hasDraws = hasDraws;
        return totalPrimitives;
    }

    destroy() {
        this.storage?.destroy();
        this.storage = null;
    }
}

export { WebgpuDrawCommands };
