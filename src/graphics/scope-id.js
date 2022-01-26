import { VersionedObject } from './versioned-object.js';

/**
 * The scope for a variable.
 */
class ScopeId {
    /**
     * Create a new ScopeId instance.
     *
     * @param {string} name - The variable name.
     */
    constructor(name) {
        /**
         * The variable name.
         *
         * @type {string}
         */
        this.name = name;

        // Set the default value
        this.value = null;

        // Create the version object
        this.versionObject = new VersionedObject();
    }

    /**
     * Set variable value.
     *
     * @param {*} value - The value.
     */
    setValue(value) {
        // Set the new value
        this.value = value;

        // Increment the revision
        this.versionObject.increment();
    }

    /**
     * Get variable value.
     *
     * @returns {*} The value.
     */
    getValue() {
        return this.value;
    }
}

export { ScopeId };
