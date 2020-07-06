import { guid } from '../core/guid.js';

import { GraphNode } from '../scene/graph-node.js';

import { Application } from './application.js';

/**
 * @class
 * @name pc.Entity
 * @augments pc.GraphNode
 * @classdesc The Entity is the core primitive of a PlayCanvas game. Generally speaking an object in your game will consist of an {@link pc.Entity},
 * and a set of {@link pc.Component}s which are managed by their respective {@link pc.ComponentSystem}s. One of those components maybe a
 * {@link pc.ScriptComponent} which allows you to write custom code to attach to your Entity.
 * <p>
 * The Entity uniquely identifies the object and also provides a transform for position and orientation
 * which it inherits from {@link pc.GraphNode} so can be added into the scene graph.
 * The Component and ComponentSystem provide the logic to give an Entity a specific type of behavior. e.g. the ability to
 * render a model or play a sound. Components are specific to an instance of an Entity and are attached (e.g. `this.entity.model`)
 * ComponentSystems allow access to all Entities and Components and are attached to the {@link pc.Application}.
 * @param {string} [name] - The non-unique name of the entity, default is "Untitled".
 * @param {pc.Application} [app] - The application the entity belongs to, default is the current application.
 * @property {pc.AnimationComponent} [animation] Gets the {@link pc.AnimationComponent} attached to this entity. [read only]
 * @property {pc.AudioListenerComponent} [audiolistener] Gets the {@link pc.AudioSourceComponent} attached to this entity. [read only]
 * @property {pc.ButtonComponent} [button] Gets the {@link pc.ButtonComponent} attached to this entity. [read only]
 * @property {pc.CameraComponent} [camera] Gets the {@link pc.CameraComponent} attached to this entity. [read only]
 * @property {pc.CollisionComponent} [collision] Gets the {@link pc.CollisionComponent} attached to this entity. [read only]
 * @property {pc.ElementComponent} [element] Gets the {@link pc.ElementComponent} attached to this entity. [read only]
 * @property {pc.LayoutChildComponent} [layoutchild] Gets the {@link pc.LayoutChildComponent} attached to this entity. [read only]
 * @property {pc.LayoutGroupComponent} [layoutgroup] Gets the {@link pc.LayoutGroupComponent} attached to this entity. [read only]
 * @property {pc.LightComponent} [light] Gets the {@link pc.LightComponent} attached to this entity. [read only]
 * @property {pc.ModelComponent} [model] Gets the {@link pc.ModelComponent} attached to this entity. [read only]
 * @property {pc.ParticleSystemComponent} [particlesystem] Gets the {@link pc.ParticleSystemComponent} attached to this entity. [read only]
 * @property {pc.RigidBodyComponent} [rigidbody] Gets the {@link pc.RigidBodyComponent} attached to this entity. [read only]
 * @property {pc.ScreenComponent} [screen] Gets the {@link pc.ScreenComponent} attached to this entity. [read only]
 * @property {pc.ScriptComponent} [script] Gets the {@link pc.ScriptComponent} attached to this entity. [read only]
 * @property {pc.ScrollViewComponent} [scrollview] Gets the {@link pc.ScrollViewComponent} attached to this entity. [read only]
 * @property {pc.SoundComponent} [sound] Gets the {@link pc.SoundComponent} attached to this entity. [read only]
 * @property {pc.SpriteComponent} [sprite] Gets the {@link pc.SpriteComponent} attached to this entity. [read only]
 * @example
 * var entity = new pc.Entity();
 *
 * // Add a Component to the Entity
 * entity.addComponent("camera", {
 *     fov: 45,
 *     nearClip: 1,
 *     farClip: 10000
 * });
 *
 * // Add the Entity into the scene graph
 * app.root.addChild(entity);
 *
 * // Move the entity
 * entity.translate(10, 0, 0);
 *
 * // Or translate it by setting it's position directly
 * var p = entity.getPosition();
 * entity.setPosition(p.x + 10, p.y, p.z);
 *
 * // Change the entity's rotation in local space
 * var e = entity.getLocalEulerAngles();
 * entity.setLocalEulerAngles(e.x, e.y + 90, e.z);
 *
 * // Or use rotateLocal
 * entity.rotateLocal(0, 90, 0);
 */
function Entity(name, app) {
    GraphNode.call(this, name);

    if (name instanceof Application) app = name;
    this._batchHandle = null; // The handle for a RequestBatch, set this if you want to Component's to load their resources using a pre-existing RequestBatch.
    this.c = {}; // Component storage

    this._app = app; // store app
    if (!app) {
        this._app = Application.getApplication(); // get the current application
        if (!this._app) {
            throw new Error("Couldn't find current application");
        }
    }

    this._guid = null;

    // used by component systems to speed up destruction
    this._destroying = false;
}
Entity.prototype = Object.create(GraphNode.prototype);
Entity.prototype.constructor = Entity;

/**
 * @function
 * @name pc.Entity#addComponent
 * @description Create a new component and add it to the entity.
 * Use this to add functionality to the entity like rendering a model, playing sounds and so on.
 * @param {string} type - The name of the component to add. Valid strings are:
 *
 * * "animation" - see {@link pc.AnimationComponent}
 * * "audiolistener" - see {@link pc.AudioListenerComponent}
 * * "button" - see {@link pc.ButtonComponent}
 * * "camera" - see {@link pc.CameraComponent}
 * * "collision" - see {@link pc.CollisionComponent}
 * * "element" - see {@link pc.ElementComponent}
 * * "layoutchild" - see {@link pc.LayoutChildComponent}
 * * "layoutgroup" - see {@link pc.LayoutGroupComponent}
 * * "light" - see {@link pc.LightComponent}
 * * "model" - see {@link pc.ModelComponent}
 * * "particlesystem" - see {@link pc.ParticleSystemComponent}
 * * "rigidbody" - see {@link pc.RigidBodyComponent}
 * * "screen" - see {@link pc.ScreenComponent}
 * * "script" - see {@link pc.ScriptComponent}
 * * "scrollbar" - see {@link pc.ScrollbarComponent}
 * * "scrollview" - see {@link pc.ScrollViewComponent}
 * * "sound" - see {@link pc.SoundComponent}
 * * "sprite" - see {@link pc.SpriteComponent}
 *
 * @param {object} [data] - The initialization data for the specific component type. Refer to each
 * specific component's API reference page for details on valid values for this parameter.
 * @returns {pc.Component} The new Component that was attached to the entity or null if there
 * was an error.
 * @example
 * var entity = new pc.Entity();
 *
 * // Add a light component with default properties
 * entity.addComponent("light");
 *
 * // Add a camera component with some specified properties
 * entity.addComponent("camera", {
 *     fov: 45,
 *     clearColor: new pc.Color(1, 0, 0)
 * });
 */
Entity.prototype.addComponent = function (type, data) {
    var system = this._app.systems[type];
    if (!system) {
        // #ifdef DEBUG
        console.error("addComponent: System " + type + " doesn't exist");
        // #endif
        return null;
    }
    if (this.c[type]) {
        // #ifdef DEBUG
        console.warn("addComponent: Entity already has " + type + " component");
        // #endif
        return null;
    }
    return system.addComponent(this, data);
};

/**
 * @function
 * @name pc.Entity#removeComponent
 * @description Remove a component from the Entity.
 * @param {string} type - The name of the Component type.
 * @example
 * var entity = new pc.Entity();
 * entity.addComponent("light"); // add new light component
 *
 * entity.removeComponent("light"); // remove light component
 */
Entity.prototype.removeComponent = function (type) {
    var system = this._app.systems[type];
    if (!system) {
        // #ifdef DEBUG
        console.error("removeComponent: System " + type + " doesn't exist");
        // #endif
        return;
    }
    if (!this.c[type]) {
        // #ifdef DEBUG
        console.warn("removeComponent: Entity doesn't have " + type + " component");
        // #endif
        return;
    }
    system.removeComponent(this);
};

/**
 * @function
 * @name pc.Entity#findComponent
 * @description Search the entity and all of its descendants for the first component of specified type.
 * @param {string} type - The name of the component type to retrieve.
 * @returns {pc.Component} A component of specified type, if the entity or any of its descendants has
 * one. Returns undefined otherwise.
 * @example
 * // Get the first found light component in the hierarchy tree that starts with this entity
 * var light = entity.findComponent("light");
 */
Entity.prototype.findComponent = function (type) {
    var entity = this.findOne(function (node) {
        return node.c && node.c[type];
    });
    return entity && entity.c[type];
};

/**
 * @function
 * @name pc.Entity#findComponents
 * @description Search the entity and all of its descendants for all components of specified type.
 * @param {string} type - The name of the component type to retrieve.
 * @returns {pc.Component} All components of specified type in the entity or any of its descendants.
 * Returns empty array if none found.
 * @example
 * // Get all light components in the hierarchy tree that starts with this entity
 * var lights = entity.findComponents("light");
 */
Entity.prototype.findComponents = function (type) {
    var entities = this.find(function (node) {
        return node.c && node.c[type];
    });
    return entities.map(function (entity) {
        return entity.c[type];
    });
};

/**
 * @private
 * @function
 * @name pc.Entity#getGuid
 * @description Get the GUID value for this Entity.
 * @returns {string} The GUID of the Entity.
 */
Entity.prototype.getGuid = function () {
    // if the guid hasn't been set yet then set it now
    // before returning it
    if (! this._guid) {
        this.setGuid(guid.create());
    }

    return this._guid;
};

/**
 * @private
 * @function
 * @name pc.Entity#setGuid
 * @description Set the GUID value for this Entity.
 *
 * N.B. It is unlikely that you should need to change the GUID value of an Entity at run-time. Doing so will corrupt the graph this Entity is in.
 * @param {string} guid - The GUID to assign to the Entity.
 */
Entity.prototype.setGuid = function (guid) {
    // remove current guid from entityIndex
    var index = this._app._entityIndex;
    if (this._guid) {
        delete index[this._guid];
    }

    // add new guid to entityIndex
    this._guid = guid;
    index[this._guid] = this;
};

Entity.prototype._notifyHierarchyStateChanged = function (node, enabled) {
    var enableFirst = false;
    if (node === this && this._app._enableList.length === 0)
        enableFirst = true;

    node._beingEnabled = true;

    node._onHierarchyStateChanged(enabled);

    if (node._onHierarchyStatePostChanged)
        this._app._enableList.push(node);

    var i, len;
    var c = node._children;
    for (i = 0, len = c.length; i < len; i++) {
        if (c[i]._enabled)
            this._notifyHierarchyStateChanged(c[i], enabled);
    }

    node._beingEnabled = false;

    if (enableFirst) {
        // do not cache the length here, as enableList may be added to during loop
        for (i = 0; i < this._app._enableList.length; i++) {
            this._app._enableList[i]._onHierarchyStatePostChanged();
        }

        this._app._enableList.length = 0;
    }
};

Entity.prototype._onHierarchyStateChanged = function (enabled) {
    GraphNode.prototype._onHierarchyStateChanged.call(this, enabled);

    // enable / disable all the components
    var component;
    var components = this.c;
    for (var type in components) {
        if (components.hasOwnProperty(type)) {
            component = components[type];
            if (component.enabled) {
                if (enabled) {
                    component.onEnable();
                } else {
                    component.onDisable();
                }
            }
        }
    }
};

Entity.prototype._onHierarchyStatePostChanged = function () {
    // post enable all the components
    var components = this.c;
    for (var type in components) {
        if (components.hasOwnProperty(type))
            components[type].onPostStateChange();
    }
};

/**
 * @function
 * @name pc.Entity#findByGuid
 * @description Find a descendant of this Entity with the GUID.
 * @param {string} guid - The GUID to search for.
 * @returns {pc.Entity} The Entity with the GUID or null.
 */
Entity.prototype.findByGuid = function (guid) {
    if (this._guid === guid) return this;

    var e = this._app._entityIndex[guid];
    if (e && (e === this || e.isDescendantOf(this))) {
        return e;
    }

    return null;
};

/**
 * @function
 * @name pc.Entity#destroy
 * @description Remove all components from the Entity and detach it from the Entity hierarchy. Then recursively destroy all ancestor Entities.
 * @example
 * var firstChild = this.entity.children[0];
 * firstChild.destroy(); // delete child, all components and remove from hierarchy
 */
Entity.prototype.destroy = function () {
    var name;

    this._destroying = true;

    // Disable all enabled components first
    for (name in this.c) {
        this.c[name].enabled = false;
    }

    // Remove all components
    for (name in this.c) {
        this.c[name].system.removeComponent(this);
    }

    // Detach from parent
    if (this._parent)
        this._parent.removeChild(this);

    var children = this._children;
    var child = children.shift();
    while (child) {
        if (child instanceof Entity) {
            child.destroy();
        }

        // make sure child._parent is null because
        // we have removed it from the children array before calling
        // destroy on it
        child._parent = null;

        child = children.shift();
    }

    // fire destroy event
    this.fire('destroy', this);

    // clear all events
    this.off();

    // remove from entity index
    if (this._guid) {
        delete this._app._entityIndex[this._guid];
    }

    this._destroying = false;
};

/**
 * @function
 * @name pc.Entity#clone
 * @description Create a deep copy of the Entity. Duplicate the full Entity hierarchy, with all Components and all descendants.
 * Note, this Entity is not in the hierarchy and must be added manually.
 * @returns {pc.Entity} A new Entity which is a deep copy of the original.
 * @example
 * var e = this.entity.clone();
 *
 * // Add clone as a sibling to the original
 * this.entity.parent.addChild(e);
 */
Entity.prototype.clone = function () {
    var duplicatedIdsMap = {};
    var clone = this._cloneRecursively(duplicatedIdsMap);
    duplicatedIdsMap[this.getGuid()] = clone;

    resolveDuplicatedEntityReferenceProperties(this, this, clone, duplicatedIdsMap);

    return clone;
};

Entity.prototype._cloneRecursively = function (duplicatedIdsMap) {
    var clone = new Entity(this._app);
    GraphNode.prototype._cloneInternal.call(this, clone);

    for (var type in this.c) {
        var component = this.c[type];
        component.system.cloneComponent(this, clone);
    }

    var i;
    for (i = 0; i < this._children.length; i++) {
        var oldChild = this._children[i];
        if (oldChild instanceof Entity) {
            var newChild = oldChild._cloneRecursively(duplicatedIdsMap);
            clone.addChild(newChild);
            duplicatedIdsMap[oldChild.getGuid()] = newChild;
        }
    }

    return clone;
};

// When an entity that has properties that contain references to other
// entities within its subtree is duplicated, the expectation of the
// user is likely that those properties will be updated to point to
// the corresponding entities within the newly-created duplicate subtree.
//
// To handle this, we need to search for properties that refer to entities
// within the old duplicated structure, find their newly-cloned partners
// within the new structure, and update the references accordingly. This
// function implements that requirement.
function resolveDuplicatedEntityReferenceProperties(oldSubtreeRoot, oldEntity, newEntity, duplicatedIdsMap) {
    var i, len;

    if (oldEntity instanceof Entity) {
        var components = oldEntity.c;

        // Handle component properties
        for (var componentName in components) {
            var component = components[componentName];
            var entityProperties = component.system.getPropertiesOfType('entity');

            for (i = 0, len = entityProperties.length; i < len; i++) {
                var propertyDescriptor = entityProperties[i];
                var propertyName = propertyDescriptor.name;
                var oldEntityReferenceId = component[propertyName];
                var entityIsWithinOldSubtree = !!oldSubtreeRoot.findByGuid(oldEntityReferenceId);

                if (entityIsWithinOldSubtree) {
                    var newEntityReferenceId = duplicatedIdsMap[oldEntityReferenceId].getGuid();

                    if (newEntityReferenceId) {
                        newEntity.c[componentName][propertyName] = newEntityReferenceId;
                    } else {
                        console.warn('Could not find corresponding entity id when resolving duplicated entity references');
                    }
                }
            }
        }

        // Handle entity script attributes
        if (components.script && ! newEntity._app.useLegacyScriptAttributeCloning) {
            newEntity.script.resolveDuplicatedEntityReferenceProperties(components.script, duplicatedIdsMap);
        }

        // Recurse into children. Note that we continue to pass in the same `oldSubtreeRoot`,
        // in order to correctly handle cases where a child has an entity reference
        // field that points to a parent or other ancestor that is still within the
        // duplicated subtree.
        var _old = oldEntity.children.filter(function (e) {
            return (e instanceof Entity);
        });
        var _new = newEntity.children.filter(function (e) {
            return (e instanceof Entity);
        });

        for (i = 0, len = _old.length; i < len; i++) {
            resolveDuplicatedEntityReferenceProperties(oldSubtreeRoot, _old[i], _new[i], duplicatedIdsMap);
        }
    }
}

/**
 * @event
 * @name pc.Entity#destroy
 * @description Fired after the entity is destroyed.
 * @param {pc.Entity} entity - The entity that was destroyed.
 * @example
 * entity.on("destroy", function (e) {
 *     console.log('entity ' + e.name + ' has been destroyed');
 * });
 */

export { Entity };
