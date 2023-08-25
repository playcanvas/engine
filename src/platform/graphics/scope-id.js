import { VersionedObject } from './versioned-object.js';

/**
 * The scope for a variable.
 *
 * @category Graphics
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

    // Don't stringify ScopeId to JSON by JSON.stringify, as this stores 'value'
    // which is not needed. This is used when stringifying a uniform buffer format, which
    // internally stores the scope.
    toJSON(key) {
        return undefined;
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
