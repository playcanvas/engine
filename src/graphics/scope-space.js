Object.assign(pc, function () {
    'use strict';

    var ScopeSpace = function (name) {
        // Store the name
        this.name = name;

        // Create the empty tables
        this.variables = {};
        this.namespaces = {};
    };

    Object.assign(ScopeSpace.prototype, {
        resolve: function (name) {
            // Check if the ScopeId already exists
            if (!this.variables.hasOwnProperty(name)) {
                // Create and add to the table
                this.variables[name] = new pc.ScopeId(name);
            }

            // Now return the ScopeId instance
            return this.variables[name];
        },

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
