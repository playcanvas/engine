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
         * @description Add a new Component type
         * @param {Object} name The name of the Component
         * @param {Object} system The {pc.ComponentSystem} instance
         */
        add: function (name, system) {
            if (this[name]) {
                throw new Error(pc.string.format("ComponentSystem name '{0}' already registered or not allowed", name));
            }

            this[name] = system;
            system.name = name;

            // Update the component system array
            this.list.push(system);
        },
        /**
         * @private
         * @function
         * @name pc.ComponentSystemRegistry#remove
         * @description Remove a Component type
         * @param {Object} name The name of the Component remove
         */
        remove: function (name) {
            if (!this[name]) {
                throw new Error(pc.string.format("No ComponentSystem named '{0}' registered", name));
            }

            delete this[name];

            // Update the component system array
            var index = this.list.indexOf(this[name]);
            if (index !== -1) {
                this.list.splice(index, 1);
            }
        }
    });

    return {
        ComponentSystemRegistry: ComponentSystemRegistry
    };
}());
