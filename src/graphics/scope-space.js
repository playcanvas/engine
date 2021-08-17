import { ScopeId } from './scope-id.js';

/**
 * @class
 * @name ScopeSpace
 * @classdesc The scope for variables.
 * @param {string} name - The scope name.
 * @property {string} name The scope name.
 */
class ScopeSpace {
    constructor(name) {

        // Store the name
        this.name = name;

        // Create map which maps a uniform name into ScopeId
        this.variables = new Map();
    }

    /**
     * @function
     * @name ScopeSpace#resolve
     * @description Get (or create, if it doesn't already exist) a variable in the scope.
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

    // clears value for any uniform with matching value (used to remove deleted textures)
    removeValue(value) {
        for (const uniformName in this.variables) {
            const uniform = this.variables[uniformName];
            if (uniform.value === value) {
                uniform.value = null;
            }
        }
    }
}

export { ScopeSpace };
