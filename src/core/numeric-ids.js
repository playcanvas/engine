/**
 * A sequential numeric ID generator. Each instance maintains its own independent counter,
 * allowing separate ID spaces for different purposes.
 *
 * @ignore
 */
class NumericIds {
    /** @type {number} */
    _counter = 0;

    /**
     * Get the next unique ID.
     *
     * @returns {number} A unique sequential ID.
     */
    get() {
        return this._counter++;
    }
}

export { NumericIds };
