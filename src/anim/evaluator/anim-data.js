/**
 * @private
 * @class
 * @name pc.AnimData
 * @classdesc Wraps a set of data used in animation.
 * @description Create a new animation data container.
 * @param {number} components - Specifies how many components make up an element of data.
 * For example, specify 3 for a set of 3-dimensional vectors. The number of elements in
 * data array must be a multiple of components.
 * @param {Float32Array|number[]} data - The set of data
 * @property {number} components - The number of components that make up and element
 * @property {Float32Array|number[]} data - The data
 */
class AnimData {
    constructor(components, data) {
        this._components = components;
        this._data = data;
    }

    get components() {
        return this._components;
    }

    get data() {
        return this._data;
    }
}

export { AnimData };
