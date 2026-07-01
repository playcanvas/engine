import { Debug } from '../../core/debug.js';
import { EventHandler } from '../../core/event-handler.js';
import { Color } from '../../core/math/color.js';
import { Vec2 } from '../../core/math/vec2.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Vec4 } from '../../core/math/vec4.js';

/**
 * @import { AppBase } from '../app-base.js'
 * @import { Component } from './component.js'
 * @import { Entity } from '../entity.js'
 */

/**
 * Component Systems contain the logic and functionality to update all Components of a particular
 * type.
 */
class ComponentSystem extends EventHandler {
    /**
     * The id type of the ComponentSystem.
     *
     * @type {string}
     * @readonly
     */
    id;

    /**
     * A list of option names accepted by {@link ComponentSystem#addComponent} that are not settable
     * properties of the component itself - for example keys the system consumes to build derived
     * state (such as `aabbCenter`) or deprecated aliases. Used only by debug-build validation to
     * avoid false-positive warnings; subclasses that accept such options should override this.
     *
     * @type {string[]}
     * @ignore
     */
    extraDataProperties = [];

    /**
     * Cache of option names already validated as acceptable by {@link ComponentSystem#addComponent},
     * lazily populated the first time each option is seen. Debug builds only.
     *
     * @type {Set<string>|null}
     * @ignore
     */
    _validProps = null;

    /**
     * Create a new ComponentSystem instance.
     *
     * @param {AppBase} app - The application managing this system.
     */
    constructor(app) {
        super();

        this.app = app;

        // The store where all ComponentData objects are kept
        this.store = {};
        this.schema = [];
    }

    /**
     * Create new {@link Component} and component data instances and attach them to the entity.
     *
     * @param {Entity} entity - The Entity to attach this component to.
     * @param {object} [data] - The source data with which to create the component.
     * @returns {Component} Returns a Component of type defined by the component system.
     * @example
     * const entity = new pc.Entity(app);
     * app.systems.model.addComponent(entity, { type: 'box' });
     * // entity.model is now set to a pc.ModelComponent
     * @ignore
     */
    addComponent(entity, data = {}) {
        const component = new this.ComponentType(this, entity);

        // Engine components no longer define a DataType - the empty object is stored so that
        // legacy paths (the `data` getter, default cloneComponent) keep working
        const componentData = this.DataType ? new this.DataType() : {};

        this.store[entity.guid] = {
            entity: entity,
            data: componentData
        };

        entity[this.id] = component;
        entity.c[this.id] = component;

        // Warn about options whose names don't map to a settable component property (typically
        // typos), which would otherwise be silently ignored. Runs before initializeComponentData so
        // systems that copy arbitrary keys onto the component (e.g. anim) don't mask the typo.
        // Wrapped in Debug.call so the whole call is stripped from release builds.
        Debug.call(() => validateComponentOptions(this, component, data));

        this.initializeComponentData(component, data);

        this.fire('add', entity, component);

        return component;
    }

    /**
     * Remove the {@link Component} from the entity and delete the associated component data.
     *
     * @param {Entity} entity - The entity to remove the component from.
     * @example
     * app.systems.model.removeComponent(entity);
     * // entity.model === undefined
     * @ignore
     */
    removeComponent(entity) {
        const id = this.id;
        const record = this.store[entity.guid];
        const component = entity.c[id];

        component.fire('beforeremove');
        this.fire('beforeremove', entity, component);

        delete this.store[entity.guid];

        entity[id] = undefined;
        delete entity.c[id];

        this.fire('remove', entity, record.data);
    }

    /**
     * Create a clone of component. This creates a copy of all component data variables.
     *
     * @param {Entity} entity - The entity to clone the component from.
     * @param {Entity} clone - The entity to clone the component into.
     * @returns {Component} The newly cloned component.
     * @ignore
     */
    cloneComponent(entity, clone) {
        // default clone is just to add a new component with existing data
        const src = this.store[entity.guid];
        return this.addComponent(clone, src.data);
    }

    /**
     * Called during {@link addComponent} to initialize the component data in the store. This can
     * be overridden by derived Component Systems and either called by the derived System or
     * replaced entirely.
     *
     * @param {Component} component - The component being initialized.
     * @param {object} data - The data block used to initialize the component.
     * @param {Array<string | {name: string, type: string}>} [properties] - The array of property
     * descriptors to initialize from the data block. A descriptor can be either a plain property
     * name, or an object specifying the name and type. This is a legacy path for external
     * schema-based components - when omitted, the enabled state is initialized from the data
     * block instead. Callers that handle the enabled state themselves pass an empty array.
     * @ignore
     */
    initializeComponentData(component, data = {}, properties) {
        if (properties) {
            // Legacy path for external schema-based components: initialize each property in the
            // list from the data block, or from the component data defaults
            for (let i = 0, len = properties.length; i < len; i++) {
                const descriptor = properties[i];
                let name, type;

                // If the descriptor is an object, it will have `name` and `type` members
                if (typeof descriptor === 'object') {
                    name = descriptor.name;
                    type = descriptor.type;
                } else {
                    // Otherwise, the descriptor is just the property name
                    name = descriptor;
                    type = undefined;
                }

                let value = data[name];

                if (value !== undefined) {
                    // If we know the intended type of the value, convert the raw data
                    // into an instance of the specified type.
                    if (type !== undefined) {
                        value = convertValue(value, type);
                    }

                    component[name] = value;
                } else if (component.data && name in component.data) {
                    // apply the default value from the component data
                    component[name] = component.data[name];
                }
            }
        } else if (data.enabled !== undefined) {
            // initialize the enabled state of the component
            component.enabled = data.enabled;
        }

        // after component is initialized call onEnable
        if (component.enabled && component.entity.enabled) {
            component.onEnable();
        }
    }

    /**
     * Searches the component schema for properties that match the specified type.
     *
     * @param {string} type - The type to search for.
     * @returns {string[]|object[]} An array of property descriptors matching the specified type.
     * @ignore
     */
    getPropertiesOfType(type) {
        const matchingProperties = [];
        const schema = this.schema || [];

        schema.forEach((descriptor) => {
            if (descriptor && typeof descriptor === 'object' && descriptor.type === type) {
                matchingProperties.push(descriptor);
            }
        });

        return matchingProperties;
    }

    destroy() {
        this.off();
    }
}

function convertValue(value, type) {
    if (!value) {
        return value;
    }

    switch (type) {
        case 'rgb':
            if (value instanceof Color) {
                return value.clone();
            }
            return new Color(value[0], value[1], value[2]);
        case 'rgba':
            if (value instanceof Color) {
                return value.clone();
            }
            return new Color(value[0], value[1], value[2], value[3]);
        case 'vec2':
            if (value instanceof Vec2) {
                return value.clone();
            }
            return new Vec2(value[0], value[1]);
        case 'vec3':
            if (value instanceof Vec3) {
                return value.clone();
            }
            return new Vec3(value[0], value[1], value[2]);
        case 'vec4':
            if (value instanceof Vec4) {
                return value.clone();
            }
            return new Vec4(value[0], value[1], value[2], value[3]);
        case 'boolean':
        case 'number':
        case 'string':
            return value;
        case 'entity':
            return value; // Entity fields should just be a string guid
        default:
            throw new Error(`Could not convert unhandled type: ${type}`);
    }
}

/**
 * Returns true if `key` names a settable property of `obj` - either an accessor with a setter, or a
 * writable data property - found anywhere on its prototype chain below `Object.prototype`. Note
 * this only detects properties that can be assigned; getter-only accessors return false. The body
 * is wrapped in {@link Debug.call} so it is stripped from release builds (this is only ever called
 * from the debug-only {@link validateComponentOptions}).
 *
 * @param {object} obj - The object to test.
 * @param {string} key - The property name to test.
 * @returns {boolean} True if the property can be assigned on `obj`.
 */
function isSettableProperty(obj, key) {
    let settable = false;
    Debug.call(() => {
        for (let proto = obj; proto && proto !== Object.prototype; proto = Object.getPrototypeOf(proto)) {
            const descriptor = Object.getOwnPropertyDescriptor(proto, key);
            if (descriptor) {
                settable = descriptor.set !== undefined || descriptor.writable === true;
                return;
            }
        }
    });
    return settable;
}

/**
 * Warns (once per option name and component type) about options passed to
 * {@link ComponentSystem#addComponent} that are neither settable properties of the component nor
 * listed in {@link ComponentSystem#extraDataProperties}, catching typos that would otherwise be
 * silently ignored. The body is wrapped in {@link Debug.call} so it is stripped from release builds.
 *
 * @param {ComponentSystem} system - The component system creating the component.
 * @param {Component} component - The freshly constructed component.
 * @param {object} data - The options passed to addComponent.
 */
function validateComponentOptions(system, component, data) {
    Debug.call(() => {
        const valid = system._validProps ??= new Set(['enabled', ...system.extraDataProperties]);
        for (const key of Object.keys(data)) {
            if (valid.has(key)) {
                continue;
            }
            if (isSettableProperty(component, key)) {
                // memoize so repeatedly adding the same component type stays cheap
                valid.add(key);
            } else {
                Debug.warnOnce(`addComponent: ignoring unknown option '${key}' passed to the '${system.id}' component - check for a typo.`);
            }
        }
    });
}

export { ComponentSystem };
