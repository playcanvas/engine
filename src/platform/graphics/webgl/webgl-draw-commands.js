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
        this.resize(maxCount, false);
    }

    /**
     * Resize SoA arrays for multi-draw.
     * @param {number} maxCount - Number of sub-draws.
     * @param {boolean} preserve - Whether to copy previous draw commands.
     */
    resize(maxCount, preserve) {

        // We will recreate the data if we need to clear the data.
        if (preserve && this.glCounts?.length === maxCount) {
            return;
        }

        const newGlCounts = new Int32Array(maxCount);
        const newGlOffsetsBytes = new Int32Array(maxCount);
        const newGlInstanceCounts = new Int32Array(maxCount);

        if (preserve && this.glCounts) {
            const keepCount = Math.min(this.glCounts.length, newGlCounts.length);
            newGlCounts.set(this.glCounts.subarray(0, keepCount));
            newGlOffsetsBytes.set(this.glOffsetsBytes.subarray(0, keepCount));
            newGlInstanceCounts.set(this.glInstanceCounts.subarray(0, keepCount));
        }

        this.glCounts = newGlCounts;
        this.glOffsetsBytes = newGlOffsetsBytes;
        this.glInstanceCounts = newGlInstanceCounts;
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
     * Calculate total primitives for stats (profiler builds only).
     * @param {number} count - Number of active draws.
     * @returns {number} Total primitive count.
     */
    update(count) {
        // calculate total primitives for stats
        let totalPrimitives = 0;

        // #if _PROFILER
        if (this.glCounts && this.glInstanceCounts && count > 0) {
            for (let d = 0; d < count; d++) {
                const indexOrVertexCount = this.glCounts[d];
                const instanceCount = this.glInstanceCounts[d];
                totalPrimitives += indexOrVertexCount * instanceCount;
            }
        }
        // #endif

        return totalPrimitives;
    }
}

export { WebglDrawCommands };
