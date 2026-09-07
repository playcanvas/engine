import { EventHandler } from '../../core/event-handler.js';

/**
 * @import { ComponentMap } from '../entity.js'
 * @import { ComponentOptionsOverrides } from './registry.js'
 * @import { ComponentSystem } from './system.js'
 * @import { Entity } from '../entity.js'
 */

/**
 * Resolves to `A` when the types `X` and `Y` are identical, otherwise to `B`.
 *
 * @template X
 * @template Y
 * @template [A=X]
 * @template [B=never]
 * @typedef {(<T>() => T extends X ? 1 : 2) extends (<T>() => T extends Y ? 1 : 2) ? A : B} IfEquals
 * @ignore
 */

/**
 * The names of the writable (not readonly) properties of `T`.
 *
 * @template T
 * @typedef {{ [P in keyof T]-?: IfEquals<{ [Q in P]: T[P] }, { -readonly [Q in P]: T[P] }, P> }[keyof T]} WritableKeys
 * @ignore
 */

/**
 * The names of the properties of component class `C` that {@link Entity#addComponent} accepts as
 * options based on the class alone: its public, writable, non-function properties. Getter-only and
 * `@readonly` properties, methods and callbacks, underscore-prefixed internals and the `system`
 * and `entity` references are excluded.
 *
 * @template C
 * @typedef {{ [K in WritableKeys<C>]: K extends 'system' | 'entity' | `_${string}` ? never : NonNullable<C[K]> extends Function ? never : K }[WritableKeys<C>]} ComponentOptionKeys
 * @ignore
 */

/**
 * The options derived from component class `C` alone: each {@link ComponentOptionKeys} property,
 * optional, with the type of the property.
 *
 * @template C
 * @typedef {Partial<Pick<C, Extract<ComponentOptionKeys<C>, keyof C>>>} ComponentOptionsOf
 * @ignore
 */

/**
 * The system-level option overrides of the component named `K` (see
 * {@link ComponentOptionsOverrides}), or an empty object type when it has none, as for an
 * application-defined component.
 *
 * @template {keyof ComponentMap} K
 * @typedef {K extends keyof ComponentOptionsOverrides ? ComponentOptionsOverrides[K] : {}} ComponentOptionsOverridesOf
 * @ignore
 */

/**
 * The options of the component named `K`: those derived from its component class, with the
 * system-level overrides replacing same-named properties. {@link ComponentOptions} flattens this
 * into a single object type.
 *
 * @template {keyof ComponentMap} K
 * @typedef {Omit<ComponentOptionsOf<ComponentMap[K]>, keyof ComponentOptionsOverridesOf<K>> & ComponentOptionsOverridesOf<K>} MergedComponentOptions
 * @ignore
 */

/**
 * Components are used to attach functionality on a {@link Entity}. Components can receive update
 * events each frame, and expose properties to the PlayCanvas Editor.
 *
 * @hideconstructor
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
     * @type {ComponentSystem}
     */
    system;

    /**
     * The Entity that this Component is attached to.
     *
     * @type {Entity}
     */
    entity;

    /**
     * The enabled state of the component.
     *
     * @type {boolean}
     * @private
     */
    _enabled = true;

    /**
     * Base constructor for a Component.
     *
     * @param {ComponentSystem} system - The ComponentSystem used to create this component.
     * @param {Entity} entity - The Entity that this Component is attached to.
     */
    constructor(system, entity) {
        super();

        this.system = system;
        this.entity = entity;

        // Legacy path for external components (e.g. playcanvas-spine) that define a schema on
        // their system: build data-backed instance accessors for each schema property
        if (this.system.schema?.length && !this._accessorsBuilt) {
            this.buildAccessors(this.system.schema);
        }

        this.on('set', function (name, oldValue, newValue) {
            this.fire(`set_${name}`, name, oldValue, newValue);
        });

        this.on('set_enabled', this.onSetEnabled, this);
    }

    /**
     * Legacy path for external components (e.g. playcanvas-spine) that store their properties in
     * a ComponentData object: creates data-backed accessors for each schema property.
     *
     * @ignore
     */
    static _buildAccessors(obj, schema) {
        // Create getter/setter pairs for each property defined in the schema
        schema.forEach((descriptor) => {
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
     * individual properties as modifying this data directly will not fire 'set' events. This is a
     * legacy path for external components that still store their properties in a ComponentData
     * object - engine components no longer store any data here.
     *
     * @type {*}
     * @ignore
     */
    get data() {
        const record = this.system.store[this.entity.guid];
        return record ? record.data : null;
    }

    /**
     * Sets the enabled state of the component.
     *
     * @type {boolean}
     */
    set enabled(value) {
        const oldValue = this._enabled;
        this._enabled = value;
        this.fire('set', 'enabled', oldValue, value);
    }

    /**
     * Gets the enabled state of the component.
     *
     * @type {boolean}
     */
    get enabled() {
        return this._enabled;
    }
}

export { Component };
