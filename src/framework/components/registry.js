/**
 * @class
 * @name pc.ComponentSystemRegistry
 * @classdesc Store, access and delete instances of the various ComponentSystems.
 * @description Create a new ComponentSystemRegistry.
 */
class ComponentSystemRegistry {
    constructor() {
        // An array of pc.ComponentSystem objects
        this.list = [];
    }

    /**
     * @private
     * @function
     * @name pc.ComponentSystemRegistry#add
     * @description Add a component system to the registry.
     * @param {object} system - The {pc.ComponentSystem} instance.
     */
    add(system) {
        var id = system.id;
        if (this[id]) {
            throw new Error("ComponentSystem name '" + id + "' already registered or not allowed");
        }

        this[id] = system;

        // Update the component system array
        this.list.push(system);
    }

    /**
     * @private
     * @function
     * @name pc.ComponentSystemRegistry#remove
     * @description Remove a component system from the registry.
     * @param {object} system - The {pc.ComponentSystem} instance.
     */
    remove(system) {
        var id = system.id;
        if (!this[id]) {
            throw new Error("No ComponentSystem named '" + id + "' registered");
        }

        delete this[id];

        // Update the component system array
        var index = this.list.indexOf(this[id]);
        if (index !== -1) {
            this.list.splice(index, 1);
        }
    }
}

export { ComponentSystemRegistry };
