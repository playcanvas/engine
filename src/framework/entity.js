import { Debug } from '../core/debug.js';
import { guid } from '../core/guid.js';

import { GraphNode } from '../scene/graph-node.js';

import { Application } from './application.js';

/** @typedef {import('./components/component.js').Component} Component */
/** @typedef {import('./components/anim/component.js').AnimComponent} AnimComponent */
/** @typedef {import('./components/animation/component.js').AnimationComponent} AnimationComponent */
/** @typedef {import('./components/audio-listener/component.js').AudioListenerComponent} AudioListenerComponent */
/** @typedef {import('./components/button/component.js').ButtonComponent} ButtonComponent */
/** @typedef {import('./components/camera/component.js').CameraComponent} CameraComponent */
/** @typedef {import('./components/collision/component.js').CollisionComponent} CollisionComponent */
/** @typedef {import('./components/element/component.js').ElementComponent} ElementComponent */
/** @typedef {import('./components/layout-child/component.js').LayoutChildComponent} LayoutChildComponent */
/** @typedef {import('./components/layout-group/component.js').LayoutGroupComponent} LayoutGroupComponent */
/** @typedef {import('./components/light/component.js').LightComponent} LightComponent */
/** @typedef {import('./components/model/component.js').ModelComponent} ModelComponent */
/** @typedef {import('./components/particle-system/component.js').ParticleSystemComponent} ParticleSystemComponent */
/** @typedef {import('./components/render/component.js').RenderComponent} RenderComponent */
/** @typedef {import('./components/rigid-body/component.js').RigidBodyComponent} RigidBodyComponent */
/** @typedef {import('./components/screen/component.js').ScreenComponent} ScreenComponent */
/** @typedef {import('./components/script/component.js').ScriptComponent} ScriptComponent */
/** @typedef {import('./components/scrollbar/component.js').ScrollbarComponent} ScrollbarComponent */
/** @typedef {import('./components/scroll-view/component.js').ScrollViewComponent} ScrollViewComponent */
/** @typedef {import('./components/sound/component.js').SoundComponent} SoundComponent */
/** @typedef {import('./components/sprite/component.js').SpriteComponent} SpriteComponent */

/**
 * @type {GraphNode[]}
 * @ignore
 */
const _enableList = [];

/**
 * The Entity is the core primitive of a PlayCanvas game. Generally speaking an object in your game
 * will consist of an {@link Entity}, and a set of {@link Component}s which are managed by their
 * respective {@link ComponentSystem}s. One of those components maybe a {@link ScriptComponent}
 * which allows you to write custom code to attach to your Entity.
 *
 * The Entity uniquely identifies the object and also provides a transform for position and
 * orientation which it inherits from {@link GraphNode} so can be added into the scene graph. The
 * Component and ComponentSystem provide the logic to give an Entity a specific type of behavior.
 * e.g. the ability to render a model or play a sound. Components are specific to an instance of an
 * Entity and are attached (e.g. `this.entity.model`) ComponentSystems allow access to all Entities
 * and Components and are attached to the {@link Application}.
 *
 * @augments GraphNode
 */
class Entity extends GraphNode {
    /**
     * Gets the {@link AnimComponent} attached to this entity.
     *
     * @type {AnimComponent}
     * @readonly
     */
    anim;

    /**
     * Gets the {@link AnimationComponent} attached to this entity.
     *
     * @type {AnimationComponent}
     * @readonly
     */
    animation;

    /**
     * Gets the {@link AudioListenerComponent} attached to this entity.
     *
     * @type {AudioListenerComponent}
     * @readonly
     */
    audiolistener;

    /**
     * Gets the {@link ButtonComponent} attached to this entity.
     *
     * @type {ButtonComponent}
     * @readonly
     */
    button;

    /**
     * Gets the {@link CameraComponent} attached to this entity.
     *
     * @type {CameraComponent}
     * @readonly
     */
    camera;

    /**
     * Gets the {@link CollisionComponent} attached to this entity.
     *
     * @type {CollisionComponent}
     * @readonly
     */
    collision;

    /**
     * Gets the {@link ElementComponent} attached to this entity.
     *
     * @type {ElementComponent}
     * @readonly
     */
    element;

    /**
     * Gets the {@link LayoutChildComponent} attached to this entity.
     *
     * @type {LayoutChildComponent}
     * @readonly
     */
    layoutchild;

    /**
     * Gets the {@link LayoutGroupComponent} attached to this entity.
     *
     * @type {LayoutGroupComponent}
     * @readonly
     */
    layoutgroup;

    /**
     * Gets the {@link LightComponent} attached to this entity.
     *
     * @type {LightComponent}
     * @readonly
     */
    light;

    /**
     * Gets the {@link ModelComponent} attached to this entity.
     *
     * @type {ModelComponent}
     * @readonly
     */
    model;

    /**
     * Gets the {@link ParticleSystemComponent} attached to this entity.
     *
     * @type {ParticleSystemComponent}
     * @readonly
     */
    particlesystem;

    /**
     * Gets the {@link RenderComponent} attached to this entity.
     *
     * @type {RenderComponent}
     * @readonly
     */
    render;

    /**
     * Gets the {@link RigidBodyComponent} attached to this entity.
     *
     * @type {RigidBodyComponent}
     * @readonly
     */
    rigidbody;

    /**
     * Gets the {@link ScreenComponent} attached to this entity.
     *
     * @type {ScreenComponent}
     * @readonly
     */
    screen;

    /**
     * Gets the {@link ScriptComponent} attached to this entity.
     *
     * @type {ScriptComponent}
     * @readonly
     */
    script;

    /**
     * Gets the {@link ScrollbarComponent} attached to this entity.
     *
     * @type {ScrollbarComponent}
     * @readonly
     */
    scrollbar;

    /**
     * Gets the {@link ScrollViewComponent} attached to this entity.
     *
     * @type {ScrollViewComponent}
     * @readonly
     */
    scrollview;

    /**
     * Gets the {@link SoundComponent} attached to this entity.
     *
     * @type {SoundComponent}
     * @readonly
     */
    sound;

    /**
     * Gets the {@link SpriteComponent} attached to this entity.
     *
     * @type {SpriteComponent}
     * @readonly
     */
    sprite;

    /* eslint-disable jsdoc/check-types */
    /**
     * Component storage.
     *
     * @type {Object.<string, Component>}
     * @ignore
     */
    c = {};
    /* eslint-enable jsdoc/check-types */

    /**
     * @type {Application}
     * @private
     */
    _app;

    /**
     * Used by component systems to speed up destruction.
     *
     * @type {boolean}
     * @ignore
     */
    _destroying = false;

    /**
     * @type {string|null}
     * @private
     */
    _guid = null;

    /**
     * Used to differentiate between the entities of a template root instance, which have it set to
     * true, and the cloned instance entities (set to false).
     *
     * @type {boolean}
     * @ignore
     */
    _template = false;

    /**
     * Create a new Entity.
     *
     * @param {string} [name] - The non-unique name of the entity, default is "Untitled".
     * @param {Application} [app] - The application the entity belongs to, default is the current application.
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
     * // Or translate it by setting its position directly
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
    constructor(name, app) {
        super(name);

        if (name instanceof Application) app = name;

        if (!app) {
            app = Application.getApplication(); // get the current application
            if (!app) {
                throw new Error("Couldn't find current application");
            }
        }

        this._app = app;
    }

    /**
     * Create a new component and add it to the entity. Use this to add functionality to the entity
     * like rendering a model, playing sounds and so on.
     *
     * @param {string} type - The name of the component to add. Valid strings are:
     *
     * - "anim" - see {@link AnimComponent}
     * - "animation" - see {@link AnimationComponent}
     * - "audiolistener" - see {@link AudioListenerComponent}
     * - "button" - see {@link ButtonComponent}
     * - "camera" - see {@link CameraComponent}
     * - "collision" - see {@link CollisionComponent}
     * - "element" - see {@link ElementComponent}
     * - "layoutchild" - see {@link LayoutChildComponent}
     * - "layoutgroup" - see {@link LayoutGroupComponent}
     * - "light" - see {@link LightComponent}
     * - "model" - see {@link ModelComponent}
     * - "particlesystem" - see {@link ParticleSystemComponent}
     * - "render" - see {@link RenderComponent}
     * - "rigidbody" - see {@link RigidBodyComponent}
     * - "screen" - see {@link ScreenComponent}
     * - "script" - see {@link ScriptComponent}
     * - "scrollbar" - see {@link ScrollbarComponent}
     * - "scrollview" - see {@link ScrollViewComponent}
     * - "sound" - see {@link SoundComponent}
     * - "sprite" - see {@link SpriteComponent}
     *
     * @param {object} [data] - The initialization data for the specific component type. Refer to
     * each specific component's API reference page for details on valid values for this parameter.
     * @returns {Component|null} The new Component that was attached to the entity or null if there
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
        const system = this._app.systems[type];
        if (!system) {
            Debug.error(`addComponent: System ${type} doesn't exist`);
            return null;
        }
        if (this.c[type]) {
            Debug.warn(`addComponent: Entity already has ${type} component`);
            return null;
        }
        return system.addComponent(this, data);
    }

    /**
     * Remove a component from the Entity.
     *
     * @param {string} type - The name of the Component type.
     * @example
     * var entity = new pc.Entity();
     * entity.addComponent("light"); // add new light component
     *
     * entity.removeComponent("light"); // remove light component
     */
    removeComponent(type) {
        const system = this._app.systems[type];
        if (!system) {
            Debug.error(`addComponent: System ${type} doesn't exist`);
            return;
        }
        if (!this.c[type]) {
            Debug.warn(`removeComponent: Entity doesn't have ${type} component`);
            return;
        }
        system.removeComponent(this);
    }

    /**
     * Search the entity and all of its descendants for the first component of specified type.
     *
     * @param {string} type - The name of the component type to retrieve.
     * @returns {Component} A component of specified type, if the entity or any of its descendants
     * has one. Returns undefined otherwise.
     * @example
     * // Get the first found light component in the hierarchy tree that starts with this entity
     * var light = entity.findComponent("light");
     */
    findComponent(type) {
        const entity = this.findOne(function (node) {
            return node.c && node.c[type];
        });
        return entity && entity.c[type];
    }

    /**
     * Search the entity and all of its descendants for all components of specified type.
     *
     * @param {string} type - The name of the component type to retrieve.
     * @returns {Component[]} All components of specified type in the entity or any of its
     * descendants. Returns empty array if none found.
     * @example
     * // Get all light components in the hierarchy tree that starts with this entity
     * var lights = entity.findComponents("light");
     */
    findComponents(type) {
        const entities = this.find(function (node) {
            return node.c && node.c[type];
        });
        return entities.map(function (entity) {
            return entity.c[type];
        });
    }

    /**
     * Get the GUID value for this Entity.
     *
     * @returns {string} The GUID of the Entity.
     * @ignore
     */
    getGuid() {
        // if the guid hasn't been set yet then set it now before returning it
        if (!this._guid) {
            this.setGuid(guid.create());
        }

        return this._guid;
    }

    /**
     * Set the GUID value for this Entity. Note that it is unlikely that you should need to change
     * the GUID value of an Entity at run-time. Doing so will corrupt the graph this Entity is in.
     *
     * @param {string} guid - The GUID to assign to the Entity.
     * @ignore
     */
    setGuid(guid) {
        // remove current guid from entityIndex
        const index = this._app._entityIndex;
        if (this._guid) {
            delete index[this._guid];
        }

        // add new guid to entityIndex
        this._guid = guid;
        index[this._guid] = this;
    }

    /**
     * @param {GraphNode} node - The node to update.
     * @param {boolean} enabled - Enable or disable the node.
     * @private
     */
    _notifyHierarchyStateChanged(node, enabled) {
        let enableFirst = false;
        if (node === this && _enableList.length === 0)
            enableFirst = true;

        node._beingEnabled = true;

        node._onHierarchyStateChanged(enabled);

        if (node._onHierarchyStatePostChanged)
            _enableList.push(node);

        const c = node._children;
        for (let i = 0, len = c.length; i < len; i++) {
            if (c[i]._enabled)
                this._notifyHierarchyStateChanged(c[i], enabled);
        }

        node._beingEnabled = false;

        if (enableFirst) {
            // do not cache the length here, as enableList may be added to during loop
            for (let i = 0; i < _enableList.length; i++) {
                _enableList[i]._onHierarchyStatePostChanged();
            }

            _enableList.length = 0;
        }
    }

    /**
     * @param {boolean} enabled - Enable or disable the node.
     * @private
     */
    _onHierarchyStateChanged(enabled) {
        super._onHierarchyStateChanged(enabled);

        // enable / disable all the components
        const components = this.c;
        for (const type in components) {
            if (components.hasOwnProperty(type)) {
                const component = components[type];
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

    /** @private */
    _onHierarchyStatePostChanged() {
        // post enable all the components
        const components = this.c;
        for (const type in components) {
            if (components.hasOwnProperty(type))
                components[type].onPostStateChange();
        }
    }

    /**
     * Find a descendant of this entity with the GUID.
     *
     * @param {string} guid - The GUID to search for.
     * @returns {Entity|null} The entity with the matching GUID or null if no entity is found.
     */
    findByGuid(guid) {
        if (this._guid === guid) return this;

        const e = this._app._entityIndex[guid];
        if (e && (e === this || e.isDescendantOf(this))) {
            return e;
        }

        return null;
    }

    /**
     * Remove all components from the Entity and detach it from the Entity hierarchy. Then
     * recursively destroy all ancestor Entities.
     *
     * @example
     * var firstChild = this.entity.children[0];
     * firstChild.destroy(); // delete child, all components and remove from hierarchy
     */
    destroy() {
        this._destroying = true;

        // Disable all enabled components first
        for (const name in this.c) {
            this.c[name].enabled = false;
        }

        // Remove all components
        for (const name in this.c) {
            this.c[name].system.removeComponent(this);
        }

        // Detach from parent
        if (this._parent)
            this._parent.removeChild(this);

        const children = this._children;
        let child = children.shift();
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
     * Create a deep copy of the Entity. Duplicate the full Entity hierarchy, with all Components
     * and all descendants. Note, this Entity is not in the hierarchy and must be added manually.
     *
     * @returns {GraphNode} A new Entity which is a deep copy of the original.
     * @example
     * var e = this.entity.clone();
     *
     * // Add clone as a sibling to the original
     * this.entity.parent.addChild(e);
     */
    clone() {
        const duplicatedIdsMap = {};
        const clone = this._cloneRecursively(duplicatedIdsMap);
        duplicatedIdsMap[this.getGuid()] = clone;

        resolveDuplicatedEntityReferenceProperties(this, this, clone, duplicatedIdsMap);

        return clone;
    }

    /* eslint-disable jsdoc/check-types */
    /**
     * @param {Object.<string, Entity>} duplicatedIdsMap - A map of original entity GUIDs to cloned
     * entities.
     * @returns {Entity} A new Entity which is a deep copy of the original.
     * @private
     */
    _cloneRecursively(duplicatedIdsMap) {
        const clone = new Entity(this._app);
        super._cloneInternal(clone);

        for (const type in this.c) {
            const component = this.c[type];
            component.system.cloneComponent(this, clone);
        }

        for (let i = 0; i < this._children.length; i++) {
            const oldChild = this._children[i];
            if (oldChild instanceof Entity) {
                const newChild = oldChild._cloneRecursively(duplicatedIdsMap);
                clone.addChild(newChild);
                duplicatedIdsMap[oldChild.getGuid()] = newChild;
            }
        }

        return clone;
    }
    /* eslint-enable jsdoc/check-types */
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
    if (oldEntity instanceof Entity) {
        const components = oldEntity.c;

        // Handle component properties
        for (const componentName in components) {
            const component = components[componentName];
            const entityProperties = component.system.getPropertiesOfType('entity');

            for (let i = 0, len = entityProperties.length; i < len; i++) {
                const propertyDescriptor = entityProperties[i];
                const propertyName = propertyDescriptor.name;
                const oldEntityReferenceId = component[propertyName];
                const entityIsWithinOldSubtree = !!oldSubtreeRoot.findByGuid(oldEntityReferenceId);

                if (entityIsWithinOldSubtree) {
                    const newEntityReferenceId = duplicatedIdsMap[oldEntityReferenceId].getGuid();

                    if (newEntityReferenceId) {
                        newEntity.c[componentName][propertyName] = newEntityReferenceId;
                    } else {
                        Debug.warn('Could not find corresponding entity id when resolving duplicated entity references');
                    }
                }
            }
        }

        // Handle entity script attributes
        if (components.script && !newEntity._app.useLegacyScriptAttributeCloning) {
            newEntity.script.resolveDuplicatedEntityReferenceProperties(components.script, duplicatedIdsMap);
        }

        // Handle entity render attributes
        if (components.render) {
            newEntity.render.resolveDuplicatedEntityReferenceProperties(components.render, duplicatedIdsMap);
        }

        // Handle entity anim attributes
        if (components.anim) {
            newEntity.anim.resolveDuplicatedEntityReferenceProperties(components.anim, duplicatedIdsMap);
        }

        // Recurse into children. Note that we continue to pass in the same `oldSubtreeRoot`,
        // in order to correctly handle cases where a child has an entity reference
        // field that points to a parent or other ancestor that is still within the
        // duplicated subtree.
        const _old = oldEntity.children.filter(function (e) {
            return (e instanceof Entity);
        });
        const _new = newEntity.children.filter(function (e) {
            return (e instanceof Entity);
        });

        for (let i = 0, len = _old.length; i < len; i++) {
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
