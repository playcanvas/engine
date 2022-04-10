import { Asset } from '../../../asset/asset.js';
import { Vec3 } from '../../../math/vec3.js';

import { Component } from '../component.js';

/** @typedef {import('../../../math/vec3.js').Vec3} Vec3 */
/** @typedef {import('../../../scene/model.js').Model} Model */
/** @typedef {import('../../entity.js').Entity} Entity */
/** @typedef {import('./system.js').CollisionComponentSystem} CollisionComponentSystem */

/**
 * A collision volume. Use this in conjunction with a {@link RigidBodyComponent} to make a
 * collision volume that can be simulated using the physics engine.
 *
 * If the {@link Entity} does not have a {@link RigidBodyComponent} then this collision volume will
 * act as a trigger volume. When an entity with a dynamic or kinematic body enters or leaves an
 * entity with a trigger volume, both entities will receive trigger events.
 *
 * The following table shows all the events that can be fired between two Entities:
 *
 * |                                       | Rigid Body (Static)                                                   | Rigid Body (Dynamic or Kinematic)                                     | Trigger Volume                                      |
 * | ------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------- |
 * | **Rigid Body (Static)**               |                                                                       | <ul><li>contact</li><li>collisionstart</li><li>collisionend</li></ul> |                                                     |
 * | **Rigid Body (Dynamic or Kinematic)** | <ul><li>contact</li><li>collisionstart</li><li>collisionend</li></ul> | <ul><li>contact</li><li>collisionstart</li><li>collisionend</li></ul> | <ul><li>triggerenter</li><li>triggerleave</li></ul> |
 * | **Trigger Volume**                    |                                                                       | <ul><li>triggerenter</li><li>triggerleave</li></ul>                   |                                                     |
 *
 * @augments Component
 */
class CollisionComponent extends Component {
    /** @private */
    _type = 'box';

    /** @private */
    _halfExtents = new Vec3(0.5, 0.5, 0.5);

    /** @private */
    _radius = 0.5;

    /** @private */
    _height = 2;

    /** @private */
    _axis = 1;

    /** @private */
    _initialized = false;

    /** @private */
    _asset = null;

    /** @private */
    _model = null;

    /** @private */
    _renderAsset = null;

    /** @private */
    _render = null;

    /** @private */
    _shape = null;

    /** @private */
    _compoundParent = null;

    /**
     * Create a new CollisionComponent.
     *
     * @param {CollisionComponentSystem} system - The ComponentSystem that created this Component.
     * @param {Entity} entity - The Entity that this Component is attached to.
     */
    constructor(system, entity) {
        super(system, entity);

        this.entity.on('insert', this._onInsert, this);
    }

    /**
     * Sets the collision shape type. Possible values: "box", "capsule",
     * "compound", "cone", "cylinder", "mesh", "sphere".
     *
     * @type {string}
     */
    set type(type) {
        if (this._type !== type) {
            this._type = type;

            if (this._initialized) {
                this.system.changeType(this, type);
                this._type = type;
            }
        }
    }

    get type() {
        return this._type;
    }

    /**
     * The half-extents of the collision box. This is a 3-dimensional vector:
     * local space half-width, half-height, and half-depth.
     *
     * @type {Vec3}
     */
    set halfExtents(he) {
        if (this._type === 'box' && !this._halfExtents.equals(he)) {
            this._halfExtents.copy(he);
            if (this._initialized) this.system.recreatePhysicalShapes(this);
        }
    }

    get halfExtents() {
        return this._halfExtents;
    }

    /**
     * The radius of the capsule/cylinder/sphere/cone body.
     *
     * @type {number}
     */
    set radius(radius) {
        const t = this._type;
        if (this._radius !== radius && (t === 'sphere' || t === 'capsule' || t === 'cylinder' || t === 'cone')) {
            this._radius = radius;
            if (this._initialized) this.system.recreatePhysicalShapes(this);
        }
    }

    get radius() {
        return this._radius;
    }

    /**
     * The tip-to-tip height of the capsule/cylinder/cone.
     *
     * @type {number}
     */
    set height(height) {
        const t = this._type;
        if (this._height !== height && (t === 'capsule' || t === 'cylinder' || t === 'cone')) {
            this._height = height;
            if (this._initialized) this.system.recreatePhysicalShapes(this);
        }
    }

    get height() {
        return this._height;
    }

    /**
     * Aligns the capsule/cylinder/cone with the local-space X(0), Y(1) or Z(2)
     * axis of the entity.
     *
     * @type {number}
     */
    set axis(axis) {
        const t = this._type;
        if (this._axis !== axis && (t === 'capsule' || t === 'cylinder' || t === 'cone')) {
            this._axis = axis;
            if (this._initialized) this.system.recreatePhysicalShapes(this);
        }
    }

    get axis() {
        return this._axis;
    }

    /**
     * A model asset that will be used as a source for the triangle-based collision mesh.
     *
     * @type {Asset|number}
     */
    set asset(asset) {
        const assets = this.system.app.assets;

        if (this._asset) {
            // Remove old listeners
            const oldAsset = assets.get(this._asset);
            if (oldAsset) {
                oldAsset.off('remove', this.onAssetRemoved, this);
            }
        }

        if (asset) {
            if (asset instanceof Asset) {
                this._asset = asset.id;
            }

            const current = assets.get(this._asset);
            if (current) {
                // make sure we don't subscribe twice
                current.off('remove', this.onAssetRemoved, this);
                current.on('remove', this.onAssetRemoved, this);
            }
        }

        if (this._initialized && this._type === 'mesh') {
            if (!asset) {
                // if asset is null set model to null
                // so that it's going to be removed from the simulation
                this._model = null;
            }
            this.system.recreatePhysicalShapes(this);
        }
    }

    get asset() {
        return this._asset;
    }

    /**
     * The render asset that will be used as a source for the triangle-based collision mesh.
     *
     * @type {Asset|number}
     */
    set renderAsset(asset) {
        const assets = this.system.app.assets;

        if (this._renderAsset) {
            // Remove old listeners
            const oldAsset = assets.get(this._renderAsset);
            if (oldAsset) {
                oldAsset.off('remove', this.onRenderAssetRemoved, this);
            }
        }

        if (asset) {
            if (asset instanceof Asset) {
                this._renderAsset = asset.id;
            }

            const current = assets.get(this._renderAsset);
            if (current) {
                // make sure we don't subscribe twice
                current.off('remove', this.onRenderAssetRemoved, this);
                current.on('remove', this.onRenderAssetRemoved, this);
            }
        }

        if (this._initialized && this._type === 'mesh') {
            if (!asset) {
                // if render asset is null set render to null
                // so that it's going to be removed from the simulation
                this._render = null;
            }
            this.system.recreatePhysicalShapes(this);
        }
    }

    get renderAsset() {
        return this._renderAsset;
    }

    /**
     * A model that is added to the scene graph for the mesh collision volume.
     *
     * @type {Model}
     */
    set model(model) {
        if (this._initialized && this._type === 'mesh') {
            // recreate physical shapes skipping loading the model
            // from the 'asset' as the model passed in attribute might
            // have been created procedurally
            this.system.implementations.mesh.doRecreatePhysicalShape(this);
        } else {
            this._model = model;
        }
    }

    get model() {
        return this._model;
    }

    set render(render) {
        if (this._initialized && this._type === 'mesh') {
            this.system.implementations.mesh.doRecreatePhysicalShape(this);
        } else {
            this._render = render;
        }
    }

    get render() {
        return this._render;
    }

    set shape(shape) {
        this._shape = shape;
    }

    get shape() {
        return this._shape;
    }

    set initialized(bool) {
        this._initialized = bool;
    }

    get initialized() {
        return this._initialized;
    }

    set compoundParent(component) {
        this._compoundParent = component;
    }

    get compoundParent() {
        return this._compoundParent;
    }

    /**
     * @param {Asset} asset - Asset that was removed.
     * @private
     */
    onAssetRemoved(asset) {
        asset.off('remove', this.onAssetRemoved, this);
        if (this._asset === asset.id) {
            this._asset = null;
        }
    }

    /**
     * @param {Asset} asset - Asset that was removed.
     * @private
     */
    onRenderAssetRemoved(asset) {
        asset.off('remove', this.onRenderAssetRemoved, this);
        if (this._renderAsset === asset.id) {
            this._renderAsset = null;
        }
    }

    /**
     * @param {*} shape - Ammo shape.
     * @returns {number|null} The shape's index in the child array of the compound shape.
     * @private
     */
    _getCompoundChildShapeIndex(shape) {
        const compound = this._shape;
        const shapes = compound.getNumChildShapes();

        for (let i = 0; i < shapes; i++) {
            const childShape = compound.getChildShape(i);
            if (childShape.ptr === shape.ptr) {
                return i;
            }
        }

        return null;
    }

    /**
     * @param {GraphNode} parent - The parent node.
     * @private
     */
    _onInsert(parent) {
        // TODO
        // if is child of compound shape
        // and there is no change of compoundParent, then update child transform
        // once updateChildTransform is exposed in ammo.js

        if (typeof Ammo === 'undefined')
            return;

        if (this._compoundParent) {
            this.system.recreatePhysicalShapes(this);
        } else if (!this.entity.rigidbody) {
            let ancestor = this.entity.parent;
            while (ancestor) {
                if (ancestor.collision && ancestor.collision.type === 'compound') {
                    if (ancestor.collision.shape.getNumChildShapes() === 0) {
                        this.system.recreatePhysicalShapes(ancestor.collision);
                    } else {
                        this.system.recreatePhysicalShapes(this);
                    }
                    break;
                }
                ancestor = ancestor.parent;
            }
        }
    }

    /** @private */
    _updateCompound() {
        const entity = this.entity;
        if (entity._dirtyWorld) {
            let dirty = entity._dirtyLocal;
            let parent = entity;
            while (parent && !dirty) {
                if (parent.collision && parent.collision === this._compoundParent)
                    break;

                if (parent._dirtyLocal)
                    dirty = true;

                parent = parent.parent;
            }

            if (dirty) {
                entity.forEach(this.system.implementations.compound._updateEachDescendantTransform, entity);

                const bodyComponent = this._compoundParent.entity.rigidbody;
                if (bodyComponent)
                    bodyComponent.activate();
            }
        }
    }

    /** @private */
    onEnable() {
        if (this._type === 'mesh' && (this._asset || this._renderAsset) && this._initialized) {
            const asset = this.system.app.assets.get(this._asset || this._renderAsset);
            // recreate the collision shape if the model asset is not loaded
            // or the shape does not exist
            if (asset && (!asset.resource || !this._shape)) {
                this.system.recreatePhysicalShapes(this);
                return;
            }
        }

        if (this.entity.rigidbody) {
            if (this.entity.rigidbody.enabled) {
                this.entity.rigidbody.enableSimulation();
            }
        } else if (this._compoundParent && this !== this._compoundParent) {
            if (this._compoundParent.shape.getNumChildShapes() === 0) {
                this.system.recreatePhysicalShapes(this._compoundParent);
            } else {
                const transform = this.system._getNodeTransform(this.entity, this._compoundParent.entity);
                this._compoundParent.shape.addChildShape(transform, this._shape);
                Ammo.destroy(transform);

                if (this._compoundParent.entity.rigidbody)
                    this._compoundParent.entity.rigidbody.activate();
            }
        } else if (this.entity.trigger) {
            this.entity.trigger.enable();
        }
    }

    /** @private */
    onDisable() {
        if (this.entity.rigidbody) {
            this.entity.rigidbody.disableSimulation();
        } else if (this._compoundParent && this !== this._compoundParent) {
            if (!this._compoundParent.entity._destroying) {
                this.system._removeCompoundChild(this._compoundParent, this._shape);

                if (this._compoundParent.entity.rigidbody)
                    this._compoundParent.entity.rigidbody.activate();
            }
        } else if (this.entity.trigger) {
            this.entity.trigger.disable();
        }
    }

    /** @private */
    onBeforeRemove() {
        if (this._asset) {
            this._asset = null;
        }
        if (this._renderAsset) {
            this._renderAsset = null;
        }

        this.entity.off('insert', this._onInsert, this);

        this.off();
    }
}

// Events Documentation
/**
 * @event
 * @name CollisionComponent#contact
 * @description The 'contact' event is fired when a contact occurs between two rigid bodies.
 * @param {ContactResult} result - Details of the contact between the two rigid bodies.
 */

/**
 * @event
 * @name CollisionComponent#collisionstart
 * @description The 'collisionstart' event is fired when two rigid bodies start touching.
 * @param {ContactResult} result - Details of the contact between the two Entities.
 */

/**
 * @event
 * @name CollisionComponent#collisionend
 * @description The 'collisionend' event is fired two rigid-bodies stop touching.
 * @param {Entity} other - The {@link Entity} that stopped touching this collision volume.
 */

/**
 * @event
 * @name CollisionComponent#triggerenter
 * @description The 'triggerenter' event is fired when a rigid body enters a trigger volume.
 * a {@link RigidBodyComponent} attached.
 * @param {Entity} other - The {@link Entity} that entered this collision volume.
 */

/**
 * @event
 * @name CollisionComponent#triggerleave
 * @description The 'triggerleave' event is fired when a rigid body exits a trigger volume.
 * a {@link RigidBodyComponent} attached.
 * @param {Entity} other - The {@link Entity} that exited this collision volume.
 */

export { CollisionComponent };
