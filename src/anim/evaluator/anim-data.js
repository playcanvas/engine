/**
 * Wraps a set of data used in animation.
 *
 * @private
 */
class AnimData {
    /**
     * Create a new animation AnimData instance.
     *
     * @param {number} components - Specifies how many components make up an element of data. For
     * example, specify 3 for a set of 3-dimensional vectors. The number of elements in data array
     * must be a multiple of components.
     * @param {Float32Array|number[]} data - The set of data.
     * @private
     */
    constructor(components, data) {
        this._components = components;
        this._data = data;
    }

    /**
     * The number of components that make up an element.
     *
     * @type {number}
     */
    get components() {
        return this._components;
    }

    /**
     * The data.
     *
     * @type {Float32Array|number[]}
     */
    get data() {
        return this._data;
    }
}

export { AnimData };
