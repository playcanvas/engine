/**
 * A bounded FIFO buffer. Once capacity is reached, pushing drops the oldest entry.
 *
 * @ignore
 */
class RingBuffer {
    /**
     * @param {number} capacity - Maximum number of entries retained.
     */
    constructor(capacity = 100) {
        this._capacity = capacity;
        this._items = [];
    }

    /**
     * @type {number}
     */
    get length() {
        return this._items.length;
    }

    /**
     * @param {*} item - The entry to append.
     */
    push(item) {
        this._items.push(item);
        if (this._items.length > this._capacity) {
            this._items.shift();
        }
    }

    /**
     * @returns {Array<*>} A copy of the retained entries, oldest first.
     */
    toArray() {
        return this._items.slice();
    }
}

export { RingBuffer };
