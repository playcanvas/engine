import { VersionedObject } from './versioned-object.js';

/**
 * @class
 * @name pc.ScopeId
 * @classdesc The scope for a variable.
 * @param {string} name - The variable name.
 * @property {string} name The variable name.
 */
function ScopeId(name) {
    // Set the name
    this.name = name;

    // Set the default value
    this.value = null;

    // Create the version object
    this.versionObject = new VersionedObject();
}

Object.assign(ScopeId.prototype, {
    /**
     * @function
     * @name pc.ScopeId#setValue
     * @description Set variable value.
     * @param {*} value - The value.
     */
    setValue: function (value) {
        // Set the new value
        this.value = value;

        // Increment the revision
        this.versionObject.increment();
    },

    /**
     * @function
     * @name pc.ScopeId#getValue
     * @description Get variable value.
     * @returns {*} The value.
     */
    getValue: function () {
        return this.value;
    }
});

export { ScopeId };
