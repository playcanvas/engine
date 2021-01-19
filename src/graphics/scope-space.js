import { ScopeId } from './scope-id.js';

/**
 * @class
 * @name ScopeSpace
 * @classdesc The scope for variables and subspaces.
 * @param {string} name - The scope name.
 * @property {string} name The scope name.
 */
class ScopeSpace {
    constructor(name) {
        // Store the name
        this.name = name;

        // Create the empty tables
        this.variables = {};
        this.namespaces = {};
    }

    /**
     * @function
     * @name ScopeSpace#resolve
     * @description Get (or create, if it doesn't already exist) a variable in the scope.
     * @param {string} name - The variable name.
     * @returns {ScopeId} The variable instance.
     */
    resolve(name) {
        // Check if the ScopeId already exists
        if (!this.variables.hasOwnProperty(name)) {
            // Create and add to the table
            this.variables[name] = new ScopeId(name);
        }

        // Now return the ScopeId instance
        return this.variables[name];
    }

    /**
     * @function
     * @name ScopeSpace#getSubSpace
     * @description Get (or create, if it doesn't already exist) a subspace in the scope.
     * @param {string} name - The subspace name.
     * @returns {ScopeSpace} The subspace instance.
     */
    getSubSpace(name) {
        // Check if the nested namespace already exists
        if (!this.namespaces.hasOwnProperty(name)) {
            // Create and add to the table
            this.namespaces[name] = new ScopeSpace(name);
        }

        // Now return the ScopeNamespace instance
        return this.namespaces[name];
    }
}

export { ScopeSpace };
