import { getPrimitiveCount } from '../primitive-utils.js';

/**
 * WebGL implementation of DrawCommands.
 *
 * @ignore
 */
class WebglDrawCommands {
    /** @type {number} */
    indexSizeBytes;

    /** @type {Int32Array|null} */
    glCounts = null;

    /** @type {Int32Array|null} */
    glOffsetsBytes = null;

    /** @type {Int32Array|null} */
    glInstanceCounts = null;

    /**
     * @param {number} indexSizeBytes - Size of index in bytes (1, 2 or 4). 0 for non-indexed.
     */
    constructor(indexSizeBytes) {
        this.indexSizeBytes = indexSizeBytes;
    }

    /**
     * Allocate SoA arrays for multi-draw.
     * @param {number} maxCount - Number of sub-draws.
     */
    allocate(maxCount) {
        // Skip reallocation if size matches exactly
        if (this.glCounts && this.glCounts.length === maxCount) {
            return;
        }
        this.glCounts = new Int32Array(maxCount);
        this.glOffsetsBytes = new Int32Array(maxCount);
        this.glInstanceCounts = new Int32Array(maxCount);
    }

    /**
     * Write a single draw entry.
     * @param {number} i - Draw index.
     * @param {number} indexOrVertexCount - Count of indices/vertices.
     * @param {number} instanceCount - Instance count.
     * @param {number} firstIndexOrVertex - First index/vertex.
     */
    add(i, indexOrVertexCount, instanceCount, firstIndexOrVertex) {
        this.glCounts[i] = indexOrVertexCount;
        this.glOffsetsBytes[i] = firstIndexOrVertex * this.indexSizeBytes;
        this.glInstanceCounts[i] = instanceCount;
    }

    // #if _PROFILER
    /**
     * Calculate primitives per sub-draw before accumulating, so strip overhead and incomplete
     * list primitives are handled separately for each instance.
     * @param {number} count - Number of active draws.
     * @param {number} type - Primitive topology.
     * @param {boolean} instanced - Whether to apply per-command instance counts.
     * @returns {number} Total primitive count.
     */
    getPrimitiveCount(count, type, instanced) {
        let totalPrimitives = 0;

        if (this.glCounts && this.glInstanceCounts && count > 0) {
            for (let d = 0; d < count; d++) {
                const indexOrVertexCount = this.glCounts[d];
                const instanceCount = instanced ? this.glInstanceCounts[d] : 1;
                totalPrimitives += getPrimitiveCount(type, indexOrVertexCount) * instanceCount;
            }
        }

        return totalPrimitives;
    }
    // #endif
}

export { WebglDrawCommands };
