pc.extend(pc.fw, function () {
    /**
     * @class Store, access and delete instances of the various ComponentSystems
     * @name pc.fw.ComponentSystemRegistry
     */
    var ComponentSystemRegistry = function () {
    };

    ComponentSystemRegistry.prototype = {
        /**
         * Add a new Component type
         * @param {Object} name The name of the Component
         * @param {Object} component The {pc.fw.ComponentSystem} instance
         * @function
         * @name pc.fw.ComponentSystemRegistry#add
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
         * Remove a Component type
         * @param {Object} name The name of the Component remove
         * @function
         * @name pc.fw.ComponentSystemRegistry#remove
         */
        remove: function(name) {
            if(!this[name]) {
                throw new Error(pc.string.format("No ComponentSystem named '{0}' registered", name));
            }
            
            delete this[name];
        },

        /**
         * @name pc.fw.ComponentSystemRegistry#list
         * @description Return the contents of the registry as an array, this order of the array
         * is the order in which the ComponentSystems must be initialized
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
            var names = Object.keys(this);

            var index = names.indexOf('collisionrect');
            names.splice(index, 1);
            names.unshift('collisionrect');

            var index = names.indexOf('collisioncircle');
            names.splice(index, 1);
            names.unshift('collisioncircle');

            return names;
        }
    };

    return {
        ComponentSystemRegistry: ComponentSystemRegistry 
    }
}());
