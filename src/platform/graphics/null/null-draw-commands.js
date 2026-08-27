/**
 * Null implementation of DrawCommands.
 *
 * @ignore
 */
class NullDrawCommands {
    /** @type {boolean} */
    hasDraws = false;

    /**
     * Write a single draw entry.
     * @param {number} i - Draw index.
     * @param {number} indexOrVertexCount - Count of indices/vertices.
     * @param {number} instanceCount - Instance count.
     * @param {number} firstIndexOrVertex - First index/vertex.
     */
    add(i, indexOrVertexCount, instanceCount, firstIndexOrVertex) {
    }

    /**
     * Sets {@link hasDraws} and calculate total primitives for stats (profiler builds only).
     * @param {number} count - Number of active draws.
     * @returns {number} Total primitive count.
     */
    update(count) {
        this.hasDraws = false;
        return 0;
    }
}

export { NullDrawCommands };
