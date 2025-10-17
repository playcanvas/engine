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
}

export { WebglDrawCommands };
