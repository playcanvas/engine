import { Debug } from '../core/debug.js';
import { guid } from '../core/guid.js';
import { GraphNode } from '../scene/graph-node.js';
import { getApplication } from './globals.js';

/**
 * @import { AnimComponent } from './components/anim/component.js'
 * @import { AnimationComponent } from './components/animation/component.js'
 * @import { AppBase } from './app-base.js'
 * @import { AudioListenerComponent } from './components/audio-listener/component.js'
 * @import { ButtonComponent } from './components/button/component.js'
 * @import { CameraComponent } from './components/camera/component.js'
 * @import { CollisionComponent } from './components/collision/component.js'
 * @import { Component } from './components/component.js'
 * @import { ElementComponent } from './components/element/component.js'
 * @import { GSplatComponent } from './components/gsplat/component.js'
 * @import { LayoutChildComponent } from './components/layout-child/component.js'
 * @import { LayoutGroupComponent } from './components/layout-group/component.js'
 * @import { LightComponent } from './components/light/component.js'
 * @import { ModelComponent } from './components/model/component.js'
 * @import { ParticleSystemComponent } from './components/particle-system/component.js'
 * @import { RenderComponent } from './components/render/component.js'
 * @import { RigidBodyComponent } from './components/rigid-body/component.js'
 * @import { ScreenComponent } from './components/screen/component.js'
 * @import { ScriptComponent } from './components/script/component.js'
 * @import { ScriptType } from './script/script-type.js'
 * @import { ScrollViewComponent } from './components/scroll-view/component.js'
 * @import { ScrollbarComponent } from './components/scrollbar/component.js'
 * @import { SoundComponent } from './components/sound/component.js'
 * @import { SpriteComponent } from './components/sprite/component.js'
 */

/**
 * @param {Component} a - First object with `order` property.
 * @param {Component} b - Second object with `order` property.
 * @returns {number} A number indicating the relative position.
 */
const cmpStaticOrder = (a, b) => a.constructor.order - b.constructor.order;

/**
 * @param {Array<Component>} arr - Array to be sorted in place where each element contains
 * an object with a static `order` property.
 * @returns {Array<Component>} In place sorted array.
 */
const sortStaticOrder = arr => arr.sort(cmpStaticOrder);

/**
 * @type {GraphNode[]}
 */
const _enableList = [];

/**
 * @type {Array<Array<Component>>}
 */
const tmpPool = [];

const getTempArray = () => {
    return tmpPool.pop() ?? [];
};

/**
 * @param {Array<Component>} a - Array to return back to pool.
 */
const releaseTempArray = (a) => {
    a.length = 0;
    tmpPool.push(a);
};

/**
 * The Entity is a core primitive of a PlayCanvas application. Generally speaking, any object in
 * your application will be represented by an Entity, along with a set of {@link Component}s. Each
 * component enables a particular capability. For example, the {@link RenderComponent} enables an
 * entity to render a 3D model, and the {@link ScriptComponent} enables an entity to run code that
 * implements custom behavior.
 *
 * Entity is a subclass of {@link GraphNode} which allows entities to form a tree-like hierarchy
 * (based on parent/child relationships). The root of the entity hierarchy can be queried with
 * {@link AppBase#root}. Entities inherit a 3D transform from {@link GraphNode} which allows them
 * to be positioned, rotated and scaled.
 */
class Entity extends GraphNode {
    /**
     * Fired after the entity is destroyed.
     *
     * @event
     * @example
     * entity.on('destroy', (e) => {
     *     console.log(`Entity ${e.name} has been destroyed`);
     * });
     */
    static EVENT_DESTROY = 'destroy';

    /**
     * Gets the {@link AnimComponent} attached to this entity.
     *
     * @type {AnimComponent|undefined}
     * @readonly
     */
    anim;

    /**
     * Gets the {@link AnimationComponent} attached to this entity.
     *
     * @type {AnimationComponent|undefined}
     * @readonly
     */
    animation;

    /**
     * Gets the {@link AudioListenerComponent} attached to this entity.
     *
     * @type {AudioListenerComponent|undefined}
     * @readonly
     */
    audiolistener;

    /**
     * Gets the {@link ButtonComponent} attached to this entity.
     *
     * @type {ButtonComponent|undefined}
     * @readonly
     */
    button;

    /**
     * Gets the {@link CameraComponent} attached to this entity.
     *
     * @type {CameraComponent|undefined}
     * @readonly
     */
    camera;

    /**
     * Gets the {@link CollisionComponent} attached to this entity.
     *
     * @type {CollisionComponent|undefined}
     * @readonly
     */
    collision;

    /**
     * Gets the {@link ElementComponent} attached to this entity.
     *
     * @type {ElementComponent|undefined}
     * @readonly
     */
    element;

    /**
     * Gets the {@link GSplatComponent} attached to this entity.
     *
     * @type {GSplatComponent|undefined}
     * @readonly
     */
    gsplat;

    /**
     * Gets the {@link LayoutChildComponent} attached to this entity.
     *
     * @type {LayoutChildComponent|undefined}
     * @readonly
     */
    layoutchild;

    /**
     * Gets the {@link LayoutGroupComponent} attached to this entity.
     *
     * @type {LayoutGroupComponent|undefined}
     * @readonly
     */
    layoutgroup;

    /**
     * Gets the {@link LightComponent} attached to this entity.
     *
     * @type {LightComponent|undefined}
     * @readonly
     */
    light;

    /**
     * Gets the {@link ModelComponent} attached to this entity.
     *
     * @type {ModelComponent|undefined}
     * @readonly
     */
    model;

    /**
     * Gets the {@link ParticleSystemComponent} attached to this entity.
     *
     * @type {ParticleSystemComponent|undefined}
     * @readonly
     */
    particlesystem;

    /**
     * Gets the {@link RenderComponent} attached to this entity.
     *
     * @type {RenderComponent|undefined}
     * @readonly
     */
    render;

    /**
     * Gets the {@link RigidBodyComponent} attached to this entity.
     *
     * @type {RigidBodyComponent|undefined}
     * @readonly
     */
    rigidbody;

    /**
     * Gets the {@link ScreenComponent} attached to this entity.
     *
     * @type {ScreenComponent|undefined}
     * @readonly
     */
    screen;

    /**
     * Gets the {@link ScriptComponent} attached to this entity.
     *
     * @type {ScriptComponent|undefined}
     * @readonly
     */
    script;

    /**
     * Gets the {@link ScrollbarComponent} attached to this entity.
     *
     * @type {ScrollbarComponent|undefined}
     * @readonly
     */
    scrollbar;

    /**
     * Gets the {@link ScrollViewComponent} attached to this entity.
     *
     * @type {ScrollViewComponent|undefined}
     * @readonly
     */
    scrollview;

    /**
     * Gets the {@link SoundComponent} attached to this entity.
     *
     * @type {SoundComponent|undefined}
     * @readonly
     */
    sound;

    /**
     * Gets the {@link SpriteComponent} attached to this entity.
     *
     * @type {SpriteComponent|undefined}
     * @readonly
     */
    sprite;

    /**
     * Component storage.
     *
     * @type {Object<string, Component>}
     * @ignore
     */
    c = {};

    /**
     * @type {AppBase}
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
     * @param {AppBase} [app] - The application the entity belongs to, default is the current
     * application.
     * @example
     * const entity = new pc.Entity();
     *
     * // Add a Component to the Entity
     * entity.addComponent('camera', {
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
     * const p = entity.getPosition();
     * entity.setPosition(p.x + 10, p.y, p.z);
     *
     * // Change the entity's rotation in local space
     * const e = entity.getLocalEulerAngles();
     * entity.setLocalEulerAngles(e.x, e.y + 90, e.z);
     *
     * // Or use rotateLocal
     * entity.rotateLocal(0, 90, 0);
     */
    constructor(name, app = getApplication()) {
        super(name);

        Debug.assert(app, 'Could not find current application');
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
     * - "gsplat" - see {@link GSplatComponent}
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
     * const entity = new pc.Entity();
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
            Debug.error(`addComponent: System '${type}' doesn't exist`);
            return null;
        }
        if (this.c[type]) {
            Debug.warn(`addComponent: Entity already has '${type}' component`);
            return null;
        }
        return system.addComponent(this, data);
    }

    /**
     * Remove a component from the Entity.
     *
     * @param {string} type - The name of the Component type.
     * @example
     * const entity = new pc.Entity();
     * entity.addComponent("light"); // add new light component
     *
     * entity.removeComponent("light"); // remove light component
     */
    removeComponent(type) {
        const system = this._app.systems[type];
        if (!system) {
            Debug.error(`removeComponent: System '${type}' doesn't exist`);
            return;
        }
        if (!this.c[type]) {
            Debug.warn(`removeComponent: Entity doesn't have '${type}' component`);
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
     * const light = entity.findComponent("light");
     */
    findComponent(type) {
        const entity = this.findOne(entity => entity.c?.[type]);
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
     * const lights = entity.findComponents("light");
     */
    findComponents(type) {
        return this.find(entity => entity.c?.[type]).map(entity => entity.c[type]);
    }

    /**
     * Search the entity and all of its descendants for the first script instance of specified type.
     *
     * @param {string|typeof ScriptType} nameOrType - The name or type of {@link ScriptType}.
     * @returns {ScriptType|undefined} A script instance of specified type, if the entity or any of
     * its descendants has one. Returns undefined otherwise.
     * @example
     * // Get the first found "playerController" instance in the hierarchy tree that starts with this entity
     * const controller = entity.findScript("playerController");
     */
    findScript(nameOrType) {
        const entity = this.findOne(node => node.c?.script?.has(nameOrType));
        return entity?.c.script.get(nameOrType);
    }

    /**
     * Search the entity and all of its descendants for all script instances of specified type.
     *
     * @param {string|typeof ScriptType} nameOrType - The name or type of {@link ScriptType}.
     * @returns {ScriptType[]} All script instances of specified type in the entity or any of its
     * descendants. Returns empty array if none found.
     * @example
     * // Get all "playerController" instances in the hierarchy tree that starts with this entity
     * const controllers = entity.findScripts("playerController");
     */
    findScripts(nameOrType) {
        const entities = this.find(node => node.c?.script?.has(nameOrType));
        return entities.map(entity => entity.c.script.get(nameOrType));
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
     * @protected
     */
    _notifyHierarchyStateChanged(node, enabled) {
        let enableFirst = false;
        if (node === this && _enableList.length === 0) {
            enableFirst = true;
        }

        node._beingEnabled = true;

        node._onHierarchyStateChanged(enabled);

        if (node._onHierarchyStatePostChanged) {
            _enableList.push(node);
        }

        const c = node._children;
        for (let i = 0, len = c.length; i < len; i++) {
            if (c[i]._enabled) {
                this._notifyHierarchyStateChanged(c[i], enabled);
            }
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
     * @protected
     */
    _onHierarchyStateChanged(enabled) {
        super._onHierarchyStateChanged(enabled);

        const components = this._getSortedComponents();
        for (let i = 0; i < components.length; i++) {
            const component = components[i];
            if (component.enabled) {
                if (enabled) {
                    component.onEnable();
                } else {
                    component.onDisable();
                }
            }
        }

        releaseTempArray(components);
    }

    /** @private */
    _onHierarchyStatePostChanged() {
        // post enable all the components
        const components = this._getSortedComponents();
        for (let i = 0; i < components.length; i++) {
            components[i].onPostStateChange();
        }

        releaseTempArray(components);
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
     * Destroy the entity and all of its descendants. First, all of the entity's components are
     * disabled and then removed. Then, the entity is removed from the hierarchy. This is then
     * repeated recursively for all descendants of the entity.
     *
     * The last thing the entity does is fire the `destroy` event.
     *
     * @example
     * const firstChild = this.entity.children[0];
     * firstChild.destroy(); // destroy child and all of its descendants
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

        super.destroy();

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
     * @returns {this} A new Entity which is a deep copy of the original.
     * @example
     * const e = this.entity.clone();
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

    _getSortedComponents() {
        const components = this.c;
        const sortedArray = getTempArray();
        let needSort = 0;
        for (const type in components) {
            if (components.hasOwnProperty(type)) {
                const component = components[type];
                needSort |= component.constructor.order !== 0;
                sortedArray.push(component);
            }
        }

        if (needSort && sortedArray.length > 1) {
            sortStaticOrder(sortedArray);
        }

        return sortedArray;
    }

    /**
     * @param {Object<string, Entity>} duplicatedIdsMap - A map of original entity GUIDs to cloned
     * entities.
     * @returns {this} A new Entity which is a deep copy of the original.
     * @private
     */
    _cloneRecursively(duplicatedIdsMap) {
        /** @type {this} */
        const clone = new this.constructor(undefined, this._app);
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
}

/**
 * When an entity that has properties that contain references to other entities within its subtree
 * is duplicated, the expectation of the user is likely that those properties will be updated to
 * point to the corresponding entities within the newly-created duplicate subtree.
 *
 * To handle this, we need to search for properties that refer to entities within the old
 * duplicated structure, find their newly-cloned partners within the new structure, and update the
 * references accordingly. This function implements that requirement.
 *
 * @param {Entity} oldSubtreeRoot - The root of the duplicated entity subtree that is being
 * resolved.
 * @param {Entity} oldEntity - The entity within the old duplicated subtree that is being resolved.
 * @param {Entity} newEntity - The entity within the new duplicated subtree that is being resolved.
 * @param {Object<string, Entity>} duplicatedIdsMap - A map of original entity GUIDs to cloned
 * entities.
 * @private
 */
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
        if (components.script) {
            newEntity.script.resolveDuplicatedEntityReferenceProperties(components.script, duplicatedIdsMap);
        }

        // Handle entity render attributes
        if (components.render) {
            newEntity.render.resolveDuplicatedEntityReferenceProperties(components.render, duplicatedIdsMap);
        }

        // Handle entity button attributes
        if (components.button) {
            newEntity.button.resolveDuplicatedEntityReferenceProperties(components.button, duplicatedIdsMap);
        }

        // Handle entity scrollview attributes
        if (components.scrollview) {
            newEntity.scrollview.resolveDuplicatedEntityReferenceProperties(components.scrollview, duplicatedIdsMap);
        }

        // Handle entity scrollbar attributes
        if (components.scrollbar) {
            newEntity.scrollbar.resolveDuplicatedEntityReferenceProperties(components.scrollbar, duplicatedIdsMap);
        }

        // Handle entity anim attributes
        if (components.anim) {
            newEntity.anim.resolveDuplicatedEntityReferenceProperties(components.anim, duplicatedIdsMap);
        }

        // Recurse into children. Note that we continue to pass in the same `oldSubtreeRoot`, in
        // order to correctly handle cases where a child has an entity reference field that points
        // to a parent or other ancestor that is still within the duplicated subtree.
        const _old = oldEntity.children.filter(e => e instanceof Entity);
        const _new = newEntity.children.filter(e => e instanceof Entity);

        for (let i = 0, len = _old.length; i < len; i++) {
            resolveDuplicatedEntityReferenceProperties(oldSubtreeRoot, _old[i], _new[i], duplicatedIdsMap);
        }
    }
}

export { Entity };
