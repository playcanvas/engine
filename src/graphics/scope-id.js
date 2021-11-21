import { VersionedObject } from './versioned-object.js';

/**
 * The scope for a variable.
 *
 * @property {string} name The variable name.
 */
class ScopeId {
    /**
     * Create a new ScopeId instance.
     *
     * @param {string} name - The variable name.
     */
    constructor(name) {
        // Set the name
        this.name = name;

        // Set the default value
        this.value = null;

        // Create the version object
        this.versionObject = new VersionedObject();
    }

    /**
     * @function
     * @name ScopeId#setValue
     * @description Set variable value.
     * @param {*} value - The value.
     */
    setValue(value) {
        // Set the new value
        this.value = value;

        // Increment the revision
        this.versionObject.increment();
    }

    /**
     * @function
     * @name ScopeId#getValue
     * @description Get variable value.
     * @returns {*} The value.
     */
    getValue() {
        return this.value;
    }
}

export { ScopeId };
