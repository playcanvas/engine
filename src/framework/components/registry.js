import { EventHandler } from '../../core/event-handler.js';

/**
 * @class
 * @name ComponentSystemRegistry
 * @classdesc Store, access and delete instances of the various ComponentSystems.
 * @description Create a new ComponentSystemRegistry.
 */
class ComponentSystemRegistry extends EventHandler {
    constructor() {
        super();

        // An array of pc.ComponentSystem objects
        this.list = [];
    }

    /**
     * @private
     * @function
     * @name ComponentSystemRegistry#add
     * @description Add a component system to the registry.
     * @param {object} system - The {@link ComponentSystem} instance.
     */
    add(system) {
        const id = system.id;
        if (this[id]) {
            throw new Error(`ComponentSystem name '${id}' already registered or not allowed`);
        }

        this[id] = system;

        // Update the component system array
        this.list.push(system);
    }

    /**
     * @private
     * @function
     * @name ComponentSystemRegistry#remove
     * @description Remove a component system from the registry.
     * @param {object} system - The {@link ComponentSystem} instance.
     */
    remove(system) {
        const id = system.id;
        if (!this[id]) {
            throw new Error(`No ComponentSystem named '${id}' registered`);
        }

        delete this[id];

        // Update the component system array
        const index = this.list.indexOf(this[id]);
        if (index !== -1) {
            this.list.splice(index, 1);
        }
    }

    destroy() {
        this.off();

        for (let i = 0; i < this.list.length; i++) {
            this.list[i].destroy();
        }
    }
}

export { ComponentSystemRegistry };
