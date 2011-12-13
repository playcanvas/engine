pc.extend(pc.fw, function () {
    /**
     * @class Store, access and delete instances of the various ComponentSystems
     * @name pc.fw.ComponentSystemRegistry
     */
    var ComponentSystemRegistry = function () {
    };
    
    /**
     * Add a new Component type
     * @param {Object} name The name of the Component
     * @param {Object} component The {pc.fw.ComponentSystem} instance
     * @function
     * @name pc.fw.ComponentSystemRegistry#add
     */
    ComponentSystemRegistry.prototype.add = function (name, system) {
        if(!this[name]) {
            this[name] = system;
        } else {
            throw new Error(pc.string.format("ComponentSystem name '{0}' already registered or not allowed", name));
        }
    };
    
    /**
     * Remove a Component type
     * @param {Object} name The name of the Component remove
     * @function
     * @name pc.fw.ComponentSystemRegistry#remove
     */
    ComponentSystemRegistry.prototype.remove = function(name) {
        if(!this[name]) {
            throw new Error(pc.string.format("No ComponentSystem named '{0}' registered", name));
        }
        
        delete this[name];
    };
    
    return {
        ComponentSystemRegistry: ComponentSystemRegistry 
    }
}());
