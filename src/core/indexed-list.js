/**
 * A ordered list-type data structure that can provide item look up by key and can also return a list.
 *
 * @ignore
 */
class IndexedList {
    /**
     * @type {object[]}
     * @private
     */
    _list = [];

    /**
     * @type {Object<string, number>}
     * @private
     */
    _index = {};

    /**
     * Add a new item into the list with a index key.
     *
     * @param {string} key - Key used to look up item in index.
     * @param {object} item - Item to be stored.
     */
    push(key, item) {
        if (this._index[key]) {
            throw Error('Key already in index ' + key);
        }
        const location = this._list.push(item) - 1;
        this._index[key] = location;
    }

    /**
     * Test whether a key has been added to the index.
     *
     * @param {string} key - The key to test.
     * @returns {boolean} Returns true if key is in the index, false if not.
     */
    has(key) {
        return this._index[key] !== undefined;
    }

    /**
     * Return the item indexed by a key.
     *
     * @param {string} key - The key of the item to retrieve.
     * @returns {object|null} The item stored at key. Returns null if key is not in the index.
     */
    get(key) {
        const location = this._index[key];
        if (location !== undefined) {
            return this._list[location];
        }
        return null;
    }

    /**
     * Remove the item indexed by key from the list.
     *
     * @param {string} key - The key at which to remove the item.
     * @returns {boolean} Returns true if the key exists and an item was removed, returns false if
     * no item was removed.
     */
    remove(key) {
        const location = this._index[key];
        if (location !== undefined) {
            this._list.splice(location, 1);
            delete this._index[key];

            // update index
            for (key in this._index) {
                const idx = this._index[key];
                if (idx > location) {
                    this._index[key] = idx - 1;
                }
            }
            return true;
        }

        return false;
    }

    /**
     * Returns the list of items.
     *
     * @returns {object[]} The list of items.
     */
    list() {
        return this._list;
    }

    /**
     * Remove all items from the list.
     */
    clear() {
        this._list.length = 0;

        for (const prop in this._index) {
            delete this._index[prop];
        }
    }
}

export { IndexedList };
