/**
 * @class
 * @name ComponentSystemRegistry
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

    _fireOnSystems(event, ...args) {
        for (let i = 0, l = this.list.length; i < l; i++) {
            this.list[i].fire(event, ...args);
        }
    }

    initialize(root) {
        this._fireOnSystems('initialize', root);
    }

    postInitialize(root) {
        this._fireOnSystems('postInitialize', root);
    }

    update(dt, inTools) {
        this._fireOnSystems(inTools ? 'toolsUpdate' : 'update', dt);
    }

    animationUpdate(dt) {
        this._fireOnSystems('animationUpdate', dt);
    }

    fixedUpdate(dt) {
        this._fireOnSystems('fixedUpdate', dt);
    }

    postUpdate(dt) {
        this._fireOnSystems('postUpdate', dt);
    }

    destroy() {
        this._fireOnSystems('destroy');
    }
}

export { ComponentSystemRegistry };
