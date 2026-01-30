/**
 * Centralized picker ID generator. Provides unique IDs for objects that need
 * to be identifiable during GPU-based picking operations.
 *
 * @ignore
 */
class PickerId {
    /** @type {number} */
    static _counter = 0;

    /**
     * Get the next unique picker ID.
     *
     * @returns {number} A unique picker ID.
     */
    static get() {
        return this._counter++;
    }
}

export { PickerId };
