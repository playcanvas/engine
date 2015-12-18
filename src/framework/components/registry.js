pc.extend(pc, function () {
    /**
     * @private
     * @name pc.ComponentSystemRegistry
     * @class Store, access and delete instances of the various ComponentSystems
     * @description Create a new ComponentSystemRegistry
     */
    var ComponentSystemRegistry = function () {
    };

    ComponentSystemRegistry.prototype = {
        /**
         * @private
         * @function
         * @name pc.ComponentSystemRegistry#add
         * @description Add a new Component type
         * @param {Object} name The name of the Component
         * @param {Object} component The {pc.ComponentSystem} instance
         */
        add: function (name, system) {
            if(!this[name]) {
                this[name] = system;
                system.name = name;
            } else {
                throw new Error(pc.string.format("ComponentSystem name '{0}' already registered or not allowed", name));
            }
        },
        /**
         * @private
         * @function
         * @name pc.ComponentSystemRegistry#remove
         * @description Remove a Component type
         * @param {Object} name The name of the Component remove
         */
        remove: function(name) {
            if(!this[name]) {
                throw new Error(pc.string.format("No ComponentSystem named '{0}' registered", name));
            }

            delete this[name];
        },

        /**
         * @private
         * @function
         * @name pc.ComponentSystemRegistry#list
         * @description Return the contents of the registry as an array, this order of the array
         * is the order in which the ComponentSystems must be initialized.
         * @returns {pc.ComponentSystem[]} An array of component systems.
         */
        list: function () {
            var list = Object.keys(this);
            var defaultPriority = 1;
            var priorities = {
                'collisionrect': 0.5,
                'collisioncircle': 0.5
            };

            list.sort(function (a, b) {
                var pa = priorities[a] || defaultPriority;
                var pb = priorities[b] || defaultPriority;

                if (pa < pb) {
                    return -1;
                } else if (pa > pb) {
                    return 1;
                }

                return 0;
            });

            return list.map(function (key) {
                return this[key];
            }, this);
        },

        getComponentSystemOrder: function () {
            var index;
            var names = Object.keys(this);

            index = names.indexOf('collisionrect');
            names.splice(index, 1);
            names.unshift('collisionrect');

            index = names.indexOf('collisioncircle');
            names.splice(index, 1);
            names.unshift('collisioncircle');

            return names;
        }
    };

    return {
        ComponentSystemRegistry: ComponentSystemRegistry
    };
}());
