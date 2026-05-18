import { ScopeId } from './scope-id.js';

/**
 * The scope for variables.
 *
 * @category Graphics
 */
class ScopeSpace {
    /**
     * Create a new ScopeSpace instance.
     *
     * @param {string} name - The scope name.
     */
    constructor(name) {
        /**
         * The scope name.
         *
         * @type {string}
         */
        this.name = name;

        // Create map which maps a uniform name into ScopeId
        this.variables = new Map();
    }

    /**
     * Get (or create, if it doesn't already exist) a variable in the scope.
     *
     * @param {string} name - The variable name.
     * @returns {ScopeId} The variable instance.
     */
    resolve(name) {
        // add new ScopeId if it does not exist yet
        if (!this.variables.has(name)) {
            this.variables.set(name, new ScopeId(name));
        }

        // return the ScopeId instance
        return this.variables.get(name);
    }

    /**
     * Clears value for any uniform with matching value (used to remove deleted textures).
     *
     * @param {*} value - The value to clear.
     * @ignore
     */
    removeValue(value) {
        for (const uniform of this.variables.values()) {
            if (uniform.value === value) {
                uniform.value = null;
            }
        }
    }
}

export { ScopeSpace };
