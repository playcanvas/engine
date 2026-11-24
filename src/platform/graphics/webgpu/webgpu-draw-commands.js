import { BUFFERUSAGE_COPY_DST, BUFFERUSAGE_INDIRECT } from '../constants.js';
import { StorageBuffer } from '../storage-buffer.js';
import { Debug, DebugHelper } from '../../../core/debug.js';
import { getPrimitiveCount } from '../primitive-utils.js';

/**
 * @import { WebgpuGraphicsDevice } from './webgpu-graphics-device.js'
 */

/**
 * WebGPU implementation of DrawCommands.
 * Retained by the device for recovery until destroyed by the owning DrawCommands.
 *
 * @ignore
 */
class WebgpuDrawCommands {
    /** @type {WebgpuGraphicsDevice} */
    device;

    /** @type {Uint32Array|null} */
    gpuIndirect = null;

    /** @type {Int32Array|null} */
    gpuIndirectSigned = null;

    /**
     * @type {StorageBuffer|null}
     */
    storage = null;

    /** @type {number} */
    count = 0;

    /**
     * Whether the commands are written for an indexed draw (drawIndexedIndirect), or a non-indexed
     * draw (drawIndirect). The two read a different number of words from each 20-byte entry.
     *
     * @type {boolean}
     */
    indexed;

    /**
     * @param {WebgpuGraphicsDevice} device - Graphics device.
     * @param {boolean} indexed - Whether the commands are used for an indexed draw.
     */
    constructor(device, indexed) {
        this.device = device;
        this.indexed = indexed;
        device._drawCommands.add(this);
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
        this.count = 0;
        this.gpuIndirect = new Uint32Array(5 * maxCount);
        this.gpuIndirectSigned = new Int32Array(this.gpuIndirect.buffer);
        this.storage = new StorageBuffer(this.device, this.gpuIndirect.byteLength, BUFFERUSAGE_INDIRECT | BUFFERUSAGE_COPY_DST);
        DebugHelper.setName(this.storage, 'WebgpuDrawCommands.indirectStorage');
    }

    /**
     * Write a single draw entry. An indexed entry uses the GPUDrawIndexedIndirect layout of five
     * words [indexCount, instanceCount, firstIndex, baseVertex, firstInstance]. A non-indexed entry
     * uses the GPUDrawIndirect layout of four words [vertexCount, instanceCount, firstVertex,
     * firstInstance], as drawIndirect does not read the fifth word.
     *
     * @param {number} i - Draw index.
     * @param {number} indexOrVertexCount - Count of indices/vertices.
     * @param {number} instanceCount - Instance count.
     * @param {number} firstIndexOrVertex - First index/vertex.
     * @param {number} baseVertex - Base vertex (signed), used by indexed draws only.
     * @param {number} firstInstance - First instance.
     */
    add(i, indexOrVertexCount, instanceCount, firstIndexOrVertex, baseVertex = 0, firstInstance = 0) {
        Debug.call(() => {
            if (!this.indexed && baseVertex !== 0) {
                Debug.warnOnce('DrawCommands#add: baseVertex is ignored for a mesh without an index buffer. Use firstInstance to pass a value to the instance index.');
            }
            if (firstInstance !== 0 && !this.device.supportsIndirectFirstInstance) {
                Debug.warnOnce('DrawCommands#add: a non-zero firstInstance requires GraphicsDevice#supportsIndirectFirstInstance, the draw is skipped by the GPU.');
            }
        });

        const o = i * 5;
        this.gpuIndirect[o + 0] = indexOrVertexCount;
        this.gpuIndirect[o + 1] = instanceCount;
        this.gpuIndirect[o + 2] = firstIndexOrVertex;
        if (this.indexed) {
            this.gpuIndirectSigned[o + 3] = baseVertex;
            this.gpuIndirect[o + 4] = firstInstance;
        } else {
            this.gpuIndirect[o + 3] = firstInstance;
            this.gpuIndirect[o + 4] = 0;
        }
    }

    /**
     * Upload AoS data to storage buffer.
     * @param {number} count - Number of active draws.
     */
    update(count) {
        this.count = count;
        if (this.storage && count > 0) {
            const used = count * 5; // 5 uints per draw
            this.storage.write(0, this.gpuIndirect, 0, used);
        }
    }

    // #if _DEBUG
    /**
     * Calculate primitives per sub-draw before accumulating, so strip overhead and incomplete
     * list primitives are handled separately for each instance.
     * @param {number} count - Number of active draws.
     * @param {number} type - Primitive topology.
     * @returns {number} Total primitive count. Zero for GPU-authored indirect commands.
     */
    getPrimitiveCount(count, type) {
        let totalPrimitives = 0;

        if (this.gpuIndirect && count > 0) {
            for (let d = 0; d < count; d++) {
                const offset = d * 5;
                const indexOrVertexCount = this.gpuIndirect[offset + 0];
                const instanceCount = this.gpuIndirect[offset + 1];
                totalPrimitives += getPrimitiveCount(type, indexOrVertexCount) * instanceCount;
            }
        }

        return totalPrimitives;
    }
    // #endif

    restoreContext() {
        // The storage buffer is recreated empty, but CPU-authored commands are still available.
        this.update(this.count);
    }

    destroy() {
        this.device._drawCommands.delete(this);
        this.storage?.destroy();
        this.storage = null;
    }
}

export { WebgpuDrawCommands };
