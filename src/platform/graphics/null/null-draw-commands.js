/**
 * Null implementation of DrawCommands.
 *
 * @ignore
 */
class NullDrawCommands {
    /** @type {boolean} */
    hasDraws = false;

    add(i, indexOrVertexCount, instanceCount, firstIndexOrVertex) {
    }

    update(count) {
        this.hasDraws = count > 0;
        return 0;
    }
}

export { NullDrawCommands };
