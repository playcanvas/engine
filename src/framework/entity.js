import { guid } from '../core/guid.js';

import { GraphNode } from '../scene/graph-node.js';

import { Application } from './application.js';

/**
 * @class
 * @name Entity
 * @augments GraphNode
 * @classdesc The Entity is the core primitive of a PlayCanvas game. Generally speaking an object in your game will consist of an {@link Entity},
 * and a set of {@link Component}s which are managed by their respective {@link ComponentSystem}s. One of those components maybe a
 * {@link ScriptComponent} which allows you to write custom code to attach to your Entity.
 * <p>
 * The Entity uniquely identifies the object and also provides a transform for position and orientation
 * which it inherits from {@link GraphNode} so can be added into the scene graph.
 * The Component and ComponentSystem provide the logic to give an Entity a specific type of behavior. e.g. the ability to
 * render a model or play a sound. Components are specific to an instance of an Entity and are attached (e.g. `this.entity.model`)
 * ComponentSystems allow access to all Entities and Components and are attached to the {@link Application}.
 * @param {string} [name] - The non-unique name of the entity, default is "Untitled".
 * @param {Application} [app] - The application the entity belongs to, default is the current application.
 * @property {AnimationComponent} [animation] Gets the {@link AnimationComponent} attached to this entity. [read only]
 * @property {AudioListenerComponent} [audiolistener] Gets the {@link AudioListenerComponent} attached to this entity. [read only]
 * @property {ButtonComponent} [button] Gets the {@link ButtonComponent} attached to this entity. [read only]
 * @property {CameraComponent} [camera] Gets the {@link CameraComponent} attached to this entity. [read only]
 * @property {CollisionComponent} [collision] Gets the {@link CollisionComponent} attached to this entity. [read only]
 * @property {ElementComponent} [element] Gets the {@link ElementComponent} attached to this entity. [read only]
 * @property {LayoutChildComponent} [layoutchild] Gets the {@link LayoutChildComponent} attached to this entity. [read only]
 * @property {LayoutGroupComponent} [layoutgroup] Gets the {@link LayoutGroupComponent} attached to this entity. [read only]
 * @property {LightComponent} [light] Gets the {@link LightComponent} attached to this entity. [read only]
 * @property {ModelComponent} [model] Gets the {@link ModelComponent} attached to this entity. [read only]
 * @property {ParticleSystemComponent} [particlesystem] Gets the {@link ParticleSystemComponent} attached to this entity. [read only]
 * @property {RigidBodyComponent} [rigidbody] Gets the {@link RigidBodyComponent} attached to this entity. [read only]
 * @property {ScreenComponent} [screen] Gets the {@link ScreenComponent} attached to this entity. [read only]
 * @property {ScriptComponent} [script] Gets the {@link ScriptComponent} attached to this entity. [read only]
 * @property {ScrollViewComponent} [scrollview] Gets the {@link ScrollViewComponent} attached to this entity. [read only]
 * @property {SoundComponent} [sound] Gets the {@link SoundComponent} attached to this entity. [read only]
 * @property {SpriteComponent} [sprite] Gets the {@link SpriteComponent} attached to this entity. [read only]
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
class Entity extends GraphNode {
    constructor(name, app) {
        super(name);

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

        // used to differentiate between the entities of a template root instance,
        // which have it set to true, and the cloned instance entities (set to false)
        this._template = false;
    }

    /**
     * @function
     * @name Entity#addComponent
     * @description Create a new component and add it to the entity.
     * Use this to add functionality to the entity like rendering a model, playing sounds and so on.
     * @param {string} type - The name of the component to add. Valid strings are:
     *
     * * "animation" - see {@link AnimationComponent}
     * * "audiolistener" - see {@link AudioListenerComponent}
     * * "button" - see {@link ButtonComponent}
     * * "camera" - see {@link CameraComponent}
     * * "collision" - see {@link CollisionComponent}
     * * "element" - see {@link ElementComponent}
     * * "layoutchild" - see {@link LayoutChildComponent}
     * * "layoutgroup" - see {@link LayoutGroupComponent}
     * * "light" - see {@link LightComponent}
     * * "model" - see {@link ModelComponent}
     * * "particlesystem" - see {@link ParticleSystemComponent}
     * * "rigidbody" - see {@link RigidBodyComponent}
     * * "screen" - see {@link ScreenComponent}
     * * "script" - see {@link ScriptComponent}
     * * "scrollbar" - see {@link ScrollbarComponent}
     * * "scrollview" - see {@link ScrollViewComponent}
     * * "sound" - see {@link SoundComponent}
     * * "sprite" - see {@link SpriteComponent}
     *
     * @param {object} [data] - The initialization data for the specific component type. Refer to each
     * specific component's API reference page for details on valid values for this parameter.
     * @returns {Component} The new Component that was attached to the entity or null if there
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
    addComponent(type, data) {
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
    }

    /**
     * @function
     * @name Entity#removeComponent
     * @description Remove a component from the Entity.
     * @param {string} type - The name of the Component type.
     * @example
     * var entity = new pc.Entity();
     * entity.addComponent("light"); // add new light component
     *
     * entity.removeComponent("light"); // remove light component
     */
    removeComponent(type) {
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
    }

    /**
     * @function
     * @name Entity#findComponent
     * @description Search the entity and all of its descendants for the first component of specified type.
     * @param {string} type - The name of the component type to retrieve.
     * @returns {Component} A component of specified type, if the entity or any of its descendants has
     * one. Returns undefined otherwise.
     * @example
     * // Get the first found light component in the hierarchy tree that starts with this entity
     * var light = entity.findComponent("light");
     */
    findComponent(type) {
        var entity = this.findOne(function (node) {
            return node.c && node.c[type];
        });
        return entity && entity.c[type];
    }

    /**
     * @function
     * @name Entity#findComponents
     * @description Search the entity and all of its descendants for all components of specified type.
     * @param {string} type - The name of the component type to retrieve.
     * @returns {Component[]} All components of specified type in the entity or any of its descendants.
     * Returns empty array if none found.
     * @example
     * // Get all light components in the hierarchy tree that starts with this entity
     * var lights = entity.findComponents("light");
     */
    findComponents(type) {
        var entities = this.find(function (node) {
            return node.c && node.c[type];
        });
        return entities.map(function (entity) {
            return entity.c[type];
        });
    }

    /**
     * @private
     * @function
     * @name Entity#getGuid
     * @description Get the GUID value for this Entity.
     * @returns {string} The GUID of the Entity.
     */
    getGuid() {
        // if the guid hasn't been set yet then set it now
        // before returning it
        if (! this._guid) {
            this.setGuid(guid.create());
        }

        return this._guid;
    }

    /**
     * @private
     * @function
     * @name Entity#setGuid
     * @description Set the GUID value for this Entity.
     *
     * N.B. It is unlikely that you should need to change the GUID value of an Entity at run-time. Doing so will corrupt the graph this Entity is in.
     * @param {string} guid - The GUID to assign to the Entity.
     */
    setGuid(guid) {
        // remove current guid from entityIndex
        var index = this._app._entityIndex;
        if (this._guid) {
            delete index[this._guid];
        }

        // add new guid to entityIndex
        this._guid = guid;
        index[this._guid] = this;
    }

    _notifyHierarchyStateChanged(node, enabled) {
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
    }

    _onHierarchyStateChanged(enabled) {
        super._onHierarchyStateChanged(enabled);

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
    }

    _onHierarchyStatePostChanged() {
        // post enable all the components
        var components = this.c;
        for (var type in components) {
            if (components.hasOwnProperty(type))
                components[type].onPostStateChange();
        }
    }

    /**
     * @function
     * @name Entity#findByGuid
     * @description Find a descendant of this Entity with the GUID.
     * @param {string} guid - The GUID to search for.
     * @returns {Entity} The Entity with the GUID or null.
     */
    findByGuid(guid) {
        if (this._guid === guid) return this;

        var e = this._app._entityIndex[guid];
        if (e && (e === this || e.isDescendantOf(this))) {
            return e;
        }

        return null;
    }

    /**
     * @function
     * @name Entity#destroy
     * @description Remove all components from the Entity and detach it from the Entity hierarchy. Then recursively destroy all ancestor Entities.
     * @example
     * var firstChild = this.entity.children[0];
     * firstChild.destroy(); // delete child, all components and remove from hierarchy
     */
    destroy() {
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
    }

    /**
     * @function
     * @name Entity#clone
     * @description Create a deep copy of the Entity. Duplicate the full Entity hierarchy, with all Components and all descendants.
     * Note, this Entity is not in the hierarchy and must be added manually.
     * @returns {Entity} A new Entity which is a deep copy of the original.
     * @example
     * var e = this.entity.clone();
     *
     * // Add clone as a sibling to the original
     * this.entity.parent.addChild(e);
     */
    clone() {
        var duplicatedIdsMap = {};
        var clone = this._cloneRecursively(duplicatedIdsMap);
        duplicatedIdsMap[this.getGuid()] = clone;

        resolveDuplicatedEntityReferenceProperties(this, this, clone, duplicatedIdsMap);

        return clone;
    }

    _cloneRecursively(duplicatedIdsMap) {
        var clone = new Entity(this._app);
        super._cloneInternal(clone);

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
    }
}

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
 * @name Entity#destroy
 * @description Fired after the entity is destroyed.
 * @param {Entity} entity - The entity that was destroyed.
 * @example
 * entity.on("destroy", function (e) {
 *     console.log('entity ' + e.name + ' has been destroyed');
 * });
 */

export { Entity };
