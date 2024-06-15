import { EventHandler } from '../../core/event-handler.js';

/**
 * Components are used to attach functionality on a {@link Entity}. Components can receive update
 * events each frame, and expose properties to the PlayCanvas Editor.
 */
class Component extends EventHandler {
    /**
     * Component order. When an entity with multiple components gets enabled, this order specifies
     * in which order the components get enabled. The lowest number gets enabled first.
     *
     * @type {number} - Component order number.
     * @private
     */
    static order = 0;

    /**
     * The ComponentSystem used to create this Component.
     *
     * @type {import('./system.js').ComponentSystem}
     */
    system;

    /**
     * The Entity that this Component is attached to.
     *
     * @type {import('../entity.js').Entity}
     */
    entity;

    /**
     * Base constructor for a Component.
     *
     * @param {import('./system.js').ComponentSystem} system - The ComponentSystem used to create
     * this Component.
     * @param {import('../entity.js').Entity} entity - The Entity that this Component is attached
     * to.
     */
    constructor(system, entity) {
        super();

        this.system = system;
        this.entity = entity;

        if (this.system.schema && !this._accessorsBuilt) {
            this.buildAccessors(this.system.schema);
        }

        this.on('set', function (name, oldValue, newValue) {
            this.fire('set_' + name, name, oldValue, newValue);
        });

        this.on('set_enabled', this.onSetEnabled, this);
    }

    /** @ignore */
    static _buildAccessors(obj, schema) {
        // Create getter/setter pairs for each property defined in the schema
        schema.forEach(function (descriptor) {
            // If the property descriptor is an object, it should have a `name`
            // member. If not, it should just be the plain property name.
            const name = (typeof descriptor === 'object') ? descriptor.name : descriptor;

            Object.defineProperty(obj, name, {
                get: function () {
                    return this.data[name];
                },
                set: function (value) {
                    const data = this.data;
                    const oldValue = data[name];
                    data[name] = value;
                    this.fire('set', name, oldValue, value);
                },
                configurable: true
            });
        });

        obj._accessorsBuilt = true;
    }

    /** @ignore */
    buildAccessors(schema) {
        Component._buildAccessors(this, schema);
    }

    /** @ignore */
    onSetEnabled(name, oldValue, newValue) {
        if (oldValue !== newValue) {
            if (this.entity.enabled) {
                if (newValue) {
                    this.onEnable();
                } else {
                    this.onDisable();
                }
            }
        }
    }

    /** @ignore */
    onEnable() {
    }

    /** @ignore */
    onDisable() {
    }

    /** @ignore */
    onPostStateChange() {
    }

    /**
     * Access the component data directly. Usually you should access the data properties via the
     * individual properties as modifying this data directly will not fire 'set' events.
     *
     * @type {*}
     * @ignore
     */
    get data() {
        const record = this.system.store[this.entity.getGuid()];
        return record ? record.data : null;
    }

    /**
     * Sets the enabled state of the component.
     *
     * @type {boolean}
     */
    set enabled(arg) {
    }

    /**
     * Gets the enabled state of the component.
     *
     * @type {boolean}
     */
    get enabled() {
        return true;
    }
}

export { Component };
