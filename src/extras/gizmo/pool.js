/**
 * Records reused across frames, taken in order each frame and created as needed.
 *
 * @template T
 * @ignore
 */
class Pool {
    /**
     * The records created so far.
     *
     * @type {T[]}
     */
    items = [];

    /**
     * The number of records taken this frame.
     */
    count = 0;

    /**
     * @param {() => T} create - Creates a record.
     */
    constructor(create) {
        this._create = create;
    }

    /**
     * @returns {T} The next record.
     */
    next() {
        let item = this.items[this.count];
        if (!item) {
            item = this._create();
            this.items.push(item);
        }
        this.count++;
        return item;
    }
}

export { Pool };
