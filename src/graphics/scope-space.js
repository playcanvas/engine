Object.assign(pc, function () {
    'use strict';

    /**
     * @constructor
     * @name pc.ScopeSpace
     * @classdesc The scope for variables and subspaces
     * @param {String} name The scope name
     * @property {String} name The scope name
     */
    var ScopeSpace = function (name) {
        // Store the name
        this.name = name;

        // Create the empty tables
        this.variables = {};
        this.namespaces = {};
    };

    Object.assign(ScopeSpace.prototype, {
        /**
         * @function
         * @name pc.ScopeSpace#resolve
         * @description Get or create a variable in the scope
         * @param {String} name The variable name
         * @returns {pc.ScopeId} The variable instance
         */
        resolve: function (name) {
            // Check if the ScopeId already exists
            if (!this.variables.hasOwnProperty(name)) {
                // Create and add to the table
                this.variables[name] = new pc.ScopeId(name);
            }

            // Now return the ScopeId instance
            return this.variables[name];
        },

        /**
         * @function
         * @name pc.ScopeSpace#getSubSpace
         * @description Get or create a subspace in the scope
         * @param {String} name The subspace name
         * @returns {pc.ScopeSpace} The subspace instance
         */
        getSubSpace: function (name) {
            // Check if the nested namespace already exists
            if (!this.namespaces.hasOwnProperty(name)) {
                // Create and add to the table
                this.namespaces[name] = new pc.ScopeSpace(name);
            }

            // Now return the ScopeNamespace instance
            return this.namespaces[name];
        }
    });

    return {
        ScopeSpace: ScopeSpace
    };
}());
