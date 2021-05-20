import { events } from '../../core/events.js';
import { EventHandler } from '../../core/event-handler.js';

import { Color } from '../../math/color.js';
import { Vec2 } from '../../math/vec2.js';
import { Vec3 } from '../../math/vec3.js';
import { Vec4 } from '../../math/vec4.js';

/**
 * @class
 * @name ComponentSystem
 * @augments EventHandler
 * @classdesc Component Systems contain the logic and functionality to update all Components of a particular type.
 * @param {Application} app - The application managing this system.
 */
class ComponentSystem extends EventHandler {
    constructor(app) {
        super();

        this.app = app;

        // The store where all pc.ComponentData objects are kept
        this.store = {};
        this.schema = [];
    }

    // Static class methods
    static _helper(a, p) {
        for (var i = 0, l = a.length; i < l; i++) {
            a[i].f.call(a[i].s, p);
        }
    }

    static initialize(root) {
        this._helper(this._init, root);
    }

    static postInitialize(root) {
        this._helper(this._postInit, root);

        // temp, this is for internal use on entity-references until a better system is found
        this.fire('postinitialize', root);
    }

    // Update all ComponentSystems
    static update(dt, inTools) {
        this._helper(inTools ? this._toolsUpdate : this._update, dt);
    }

    static animationUpdate(dt, inTools) {
        this._helper(this._animationUpdate, dt);
    }

    // Update all ComponentSystems
    static fixedUpdate(dt, inTools) {
        this._helper(this._fixedUpdate, dt);
    }

    // Update all ComponentSystems
    static postUpdate(dt, inTools) {
        this._helper(this._postUpdate, dt);
    }

    static _init = [];

    static _postInit = [];

    static _toolsUpdate = [];

    static _update = [];

    static _animationUpdate = [];

    static _fixedUpdate =[];

    static _postUpdate = [];

    static bind(event, func, scope) {
        switch (event) {
            case 'initialize':
                this._init.push({ f: func, s: scope });
                break;
            case 'postInitialize':
                this._postInit.push({ f: func, s: scope });
                break;
            case 'update':
                this._update.push({ f: func, s: scope });
                break;
            case 'animationUpdate':
                this._animationUpdate.push({ f: func, s: scope });
                break;
            case 'postUpdate':
                this._postUpdate.push({ f: func, s: scope });
                break;
            case 'fixedUpdate':
                this._fixedUpdate.push({ f: func, s: scope });
                break;
            case 'toolsUpdate':
                this._toolsUpdate.push({ f: func, s: scope });
                break;
            default:
                console.error('Component System does not support event', event);
        }
    }

    static _erase(a, f, s) {
        for (var i = 0; i < a.length; i++) {
            if (a[i].f === f && a[i].s === s) {
                a.splice(i--, 1);
            }
        }
    }

    static unbind(event, func, scope) {
        switch (event) {
            case 'initialize':
                this._erase(this._init, func, scope);
                break;
            case 'postInitialize':
                this._erase(this._postInit, func, scope);
                break;
            case 'update':
                this._erase(this._update, func, scope);
                break;
            case 'animationUpdate':
                this._erase(this._animationUpdate, func, scope);
                break;
            case 'postUpdate':
                this._erase(this._postUpdate, func, scope);
                break;
            case 'fixedUpdate':
                this._erase(this._fixedUpdate, func, scope);
                break;
            case 'toolsUpdate':
                this._erase(this._toolsUpdate, func, scope);
                break;
            default:
                console.error('Component System does not support event', event);
        }
    }

    // Instance methods
    /**
     * @private
     * @function
     * @name ComponentSystem#addComponent
     * @description Create new {@link Component} and component data instances and attach them to the entity.
     * @param {Entity} entity - The Entity to attach this component to.
     * @param {object} [data] - The source data with which to create the component.
     * @returns {Component} Returns a Component of type defined by the component system.
     * @example
     * var entity = new pc.Entity(app);
     * app.systems.model.addComponent(entity, { type: 'box' });
     * // entity.model is now set to a pc.ModelComponent
     */
    addComponent(entity, data) {
        var component = new this.ComponentType(this, entity);
        var componentData = new this.DataType();

        data = data || {};

        this.store[entity.getGuid()] = {
            entity: entity,
            data: componentData
        };

        entity[this.id] = component;
        entity.c[this.id] = component;

        this.initializeComponentData(component, data, []);

        this.fire('add', entity, component);

        return component;
    }

    /**
     * @private
     * @function
     * @name ComponentSystem#removeComponent
     * @description Remove the {@link Component} from the entity and delete the associated component data.
     * @param {Entity} entity - The entity to remove the component from.
     * @example
     * app.systems.model.removeComponent(entity);
     * // entity.model === undefined
     */
    removeComponent(entity) {
        var record = this.store[entity.getGuid()];
        var component = entity.c[this.id];
        this.fire('beforeremove', entity, component);
        delete this.store[entity.getGuid()];
        delete entity[this.id];
        delete entity.c[this.id];
        this.fire('remove', entity, record.data);
    }

    /**
     * @private
     * @function
     * @name ComponentSystem#cloneComponent
     * @description Create a clone of component. This creates a copy of all component data variables.
     * @param {Entity} entity - The entity to clone the component from.
     * @param {Entity} clone - The entity to clone the component into.
     * @returns {Component} The newly cloned component.
     */
    cloneComponent(entity, clone) {
        // default clone is just to add a new component with existing data
        var src = this.store[entity.getGuid()];
        return this.addComponent(clone, src.data);
    }

    /**
     * @private
     * @function
     * @name ComponentSystem#initializeComponentData
     * @description Called during {@link ComponentSystem#addComponent} to initialize the component data in the store.
     * This can be overridden by derived Component Systems and either called by the derived System or replaced entirely.
     * @param {Component} component - The component being initialized.
     * @param {object} data - The data block used to initialize the component.
     * @param {string[]|object[]} properties - The array of property descriptors for the component. A descriptor can be either a plain property name, or an object specifying the name and type.
     */
    initializeComponentData(component, data = {}, properties) {
        var descriptor;
        var name, type, value;

        // initialize
        for (var i = 0, len = properties.length; i < len; i++) {
            descriptor = properties[i];

            // If the descriptor is an object, it will have `name` and `type` members
            if (typeof descriptor === 'object') {
                name = descriptor.name;
                type = descriptor.type;
            } else {
                // Otherwise, the descriptor is just the property name
                name = descriptor;
                type = undefined;
            }

            value = data[name];

            if (value !== undefined) {
                // If we know the intended type of the value, convert the raw data
                // into an instance of the specified type.
                if (type !== undefined) {
                    value = convertValue(value, type);
                }

                component[name] = value;
            } else {
                component[name] = component.data[name];
            }
        }

        // after component is initialized call onEnable
        if (component.enabled && component.entity.enabled) {
            component.onEnable();
        }
    }

    /**
     * @private
     * @function
     * @name ComponentSystem#getPropertiesOfType
     * @description Searches the component schema for properties that match the specified type.
     * @param {string} type - The type to search for.
     * @returns {string[]|object[]} An array of property descriptors matching the specified type.
     */
    getPropertiesOfType(type) {
        var matchingProperties = [];
        var schema = this.schema || [];

        schema.forEach(function (descriptor) {
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
            throw new Error('Could not convert unhandled type: ' + type);
    }
}

// Add event support
events.attach(ComponentSystem);

ComponentSystem.destroy = function () {
    ComponentSystem.off('initialize');
    ComponentSystem.off('postInitialize');
    ComponentSystem.off('toolsUpdate');
    ComponentSystem.off('update');
    ComponentSystem.off('animationUpdate');
    ComponentSystem.off('fixedUpdate');
    ComponentSystem.off('postUpdate');

    ComponentSystem._init = [];
    ComponentSystem._postInit = [];
    ComponentSystem._toolsUpdate = [];
    ComponentSystem._update = [];
    ComponentSystem._animationUpdate = [];
    ComponentSystem._fixedUpdate = [];
    ComponentSystem._postUpdate = [];
};

export { ComponentSystem };
