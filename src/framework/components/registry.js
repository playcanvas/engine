Object.assign(pc, function () {
    /**
     * @constructor
     * @name pc.ComponentSystemRegistry
     * @classdesc Store, access and delete instances of the various ComponentSystems
     * @description Create a new ComponentSystemRegistry
     */
    var ComponentSystemRegistry = function () {
        // An array of pc.ComponentSystem objects
        this.list = [];
    };

    Object.assign(ComponentSystemRegistry.prototype, {
        /**
         * @private
         * @function
         * @name pc.ComponentSystemRegistry#add
         * @description Add a component system to the registry.
         * @param {Object} system The {pc.ComponentSystem} instance
         */
        add: function (system) {
            var id = system.id;
            if (this[id]) {
                throw new Error(pc.string.format("ComponentSystem name '{0}' already registered or not allowed", id));
            }

            this[id] = system;

            // Update the component system array
            this.list.push(system);
        },

        /**
         * @private
         * @function
         * @name pc.ComponentSystemRegistry#remove
         * @description Remove a component system from the registry.
         * @param {Object} system The {pc.ComponentSystem} instance
         */
        remove: function (system) {
            var id = system.id;
            if (!this[id]) {
                throw new Error(pc.string.format("No ComponentSystem named '{0}' registered", id));
            }

            delete this[id];

            // Update the component system array
            var index = this.list.indexOf(this[id]);
            if (index !== -1) {
                this.list.splice(index, 1);
            }
        }
    });

    return {
        ComponentSystemRegistry: ComponentSystemRegistry
    };
}());
