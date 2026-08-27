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

    /** @type {boolean} */
    hasDraws = false;

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

    /**
     * Sets {@link hasDraws} and calculate total primitives for stats (profiler builds only).
     * @param {number} count - Number of active draws.
     * @returns {number} Total primitive count.
     */
    update(count) {
        let totalPrimitives = 0;
        let hasDraws = false;

        if (this.glCounts && this.glInstanceCounts && count > 0) {
            for (let d = 0; d < count; d++) {
                const indexOrVertexCount = this.glCounts[d];
                const instanceCount = this.glInstanceCounts[d];
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
}

export { WebglDrawCommands };
