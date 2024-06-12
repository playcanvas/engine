import { Quat } from '../../../core/math/quat.js';
import { Vec3 } from '../../../core/math/vec3.js';

import { Asset } from '../../asset/asset.js';

import { Component } from '../component.js';

const _vec3 = new Vec3();
const _quat = new Quat();

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
 * @category Physics
 */
class CollisionComponent extends Component {
    /**
     * Fired when a contact occurs between two rigid bodies. The handler is passed a
     * {@link ContactResult} object which contains details of the contact between the two rigid
     * bodies.
     *
     * @event
     * @example
     * entity.collision.on('contact', (result) => {
     *    console.log(`Contact between ${entity.name} and ${result.other.name}`);
     * });
     */
    static EVENT_CONTACT = 'contact';

    /**
     * Fired when two rigid bodies start touching. The handler is passed the {@link ContactResult}
     * object which contains details of the contact between the two rigid bodies.
     *
     * @event
     * @example
     * entity.collision.on('collisionstart', (result) => {
     *    console.log(`${entity.name} started touching ${result.other.name}`);
     * });
     */
    static EVENT_COLLISIONSTART = 'collisionstart';

    /**
     * Fired two rigid-bodies stop touching. The handler is passed an {@link Entity} that
     * represents the other rigid body involved in the collision.
     *
     * @event
     * @example
     * entity.collision.on('collisionend', (other) => {
     *     console.log(`${entity.name} stopped touching ${other.name}`);
     * });
     */
    static EVENT_COLLISIONEND = 'collisionend';

    /**
     * Fired when a rigid body enters a trigger volume. The handler is passed an {@link Entity}
     * representing the rigid body that entered this collision volume.
     *
     * @event
     * @example
     * entity.collision.on('triggerenter', (other) => {
     *     console.log(`${other.name} entered trigger volume ${entity.name}`);
     * });
     */
    static EVENT_TRIGGERENTER = 'triggerenter';

    /**
     * Fired when a rigid body exits a trigger volume. The handler is passed an {@link Entity}
     * representing the rigid body that exited this collision volume.
     *
     * @event
     * @example
     * entity.collision.on('triggerleave', (other) => {
     *     console.log(`${other.name} exited trigger volume ${entity.name}`);
     * });
     */
    static EVENT_TRIGGERLEAVE = 'triggerleave';

    /**
     * Create a new CollisionComponent.
     *
     * @param {import('./system.js').CollisionComponentSystem} system - The ComponentSystem that
     * created this Component.
     * @param {import('../../entity.js').Entity} entity - The Entity that this Component is
     * attached to.
     */
    constructor(system, entity) {
        super(system, entity);

        /** @private */
        this._compoundParent = null;
        this._hasOffset = false;

        this.entity.on('insert', this._onInsert, this);

        this.on('set_type', this.onSetType, this);
        this.on('set_convexHull', this.onSetModel, this);
        this.on('set_halfExtents', this.onSetHalfExtents, this);
        this.on('set_linearOffset', this.onSetOffset, this);
        this.on('set_angularOffset', this.onSetOffset, this);
        this.on('set_radius', this.onSetRadius, this);
        this.on('set_height', this.onSetHeight, this);
        this.on('set_axis', this.onSetAxis, this);
        this.on('set_asset', this.onSetAsset, this);
        this.on('set_renderAsset', this.onSetRenderAsset, this);
        this.on('set_model', this.onSetModel, this);
        this.on('set_render', this.onSetRender, this);
    }

    // TODO: Remove this override in upgrading component
    /**
     * @type {import('./data.js').CollisionComponentData}
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
        this._setValue('enabled', arg);
    }

    /**
     * Gets the enabled state of the component.
     *
     * @type {boolean}
     */
    get enabled() {
        return this.data.enabled;
    }

    /**
     * Sets the type of the collision volume. Can be:
     *
     * - "box": A box-shaped collision volume.
     * - "capsule": A capsule-shaped collision volume.
     * - "compound": A compound shape. Any descendant entities with a collision component of type
     * box, capsule, cone, cylinder or sphere will be combined into a single, rigid shape.
     * - "cone": A cone-shaped collision volume.
     * - "cylinder": A cylinder-shaped collision volume.
     * - "mesh": A collision volume that uses a model asset as its shape.
     * - "sphere": A sphere-shaped collision volume.
     *
     * Defaults to "box".
     *
     * @type {string}
     */
    set type(arg) {
        this._setValue('type', arg);
    }

    /**
     * Gets the type of the collision volume.
     *
     * @type {string}
     */
    get type() {
        return this.data.type;
    }

    /**
     * Sets the half-extents of the box-shaped collision volume in the x, y and z axes. Defaults to
     * `[0.5, 0.5, 0.5]`.
     *
     * @type {Vec3}
     */
    set halfExtents(arg) {
        this._setValue('halfExtents', arg);
    }

    /**
     * Gets the half-extents of the box-shaped collision volume in the x, y and z axes.
     *
     * @type {Vec3}
     */
    get halfExtents() {
        return this.data.halfExtents;
    }

    /**
     * Sets the positional offset of the collision shape from the Entity position along the local
     * axes. Defaults to `[0, 0, 0]`.
     *
     * @type {Vec3}
     */
    set linearOffset(arg) {
        this._setValue('linearOffset', arg);
    }

    /**
     * Gets the positional offset of the collision shape from the Entity position along the local
     * axes.
     *
     * @type {Vec3}
     */
    get linearOffset() {
        return this.data.linearOffset;
    }

    /**
     * Sets the rotational offset of the collision shape from the Entity rotation in local space.
     * Defaults to identity.
     *
     * @type {Quat}
     */
    set angularOffset(arg) {
        this._setValue('angularOffset', arg);
    }

    /**
     * Gets the rotational offset of the collision shape from the Entity rotation in local space.
     *
     * @type {Quat}
     */
    get angularOffset() {
        return this.data.angularOffset;
    }

    /**
     * Sets the radius of the sphere, capsule, cylinder or cone-shaped collision volumes.
     * Defaults to 0.5.
     *
     * @type {number}
     */
    set radius(arg) {
        this._setValue('radius', arg);
    }

    /**
     * Gets the radius of the sphere, capsule, cylinder or cone-shaped collision volumes.
     *
     * @type {number}
     */
    get radius() {
        return this.data.radius;
    }

    /**
     * Sets the local space axis with which the capsule, cylinder or cone-shaped collision volume's
     * length is aligned. 0 for X, 1 for Y and 2 for Z. Defaults to 1 (Y-axis).
     *
     * @type {number}
     */
    set axis(arg) {
        this._setValue('axis', arg);
    }

    /**
     * Gets the local space axis with which the capsule, cylinder or cone-shaped collision volume's
     * length is aligned.
     *
     * @type {number}
     */
    get axis() {
        return this.data.axis;
    }

    /**
     * Sets the total height of the capsule, cylinder or cone-shaped collision volume from tip to
     * tip. Defaults to 2.
     *
     * @type {number}
     */
    set height(arg) {
        this._setValue('height', arg);
    }

    /**
     * Gets the total height of the capsule, cylinder or cone-shaped collision volume from tip to
     * tip.
     *
     * @type {number}
     */
    get height() {
        return this.data.height;
    }

    /**
     * Sets the asset or asset id for the model of the mesh collision volume. Defaults to null.
     *
     * @type {Asset|number|null}
     */
    set asset(arg) {
        this._setValue('asset', arg);
    }

    /**
     * Gets the asset or asset id for the model of the mesh collision volume.
     *
     * @type {Asset|number|null}
     */
    get asset() {
        return this.data.asset;
    }

    /**
     * Sets the render asset or asset id of the mesh collision volume. Defaults to null.
     * If not set then the asset property will be checked instead.
     *
     * @type {Asset|number|null}
     */
    set renderAsset(arg) {
        this._setValue('renderAsset', arg);
    }

    /**
     * Gets the render asset id of the mesh collision volume.
     *
     * @type {Asset|number|null}
     */
    get renderAsset() {
        return this.data.renderAsset;
    }

    /**
     * Sets whether the collision mesh should be treated as a convex hull. When false, the mesh can
     * only be used with a static body. When true, the mesh can be used with a static, dynamic or
     * kinematic body. Defaults to `false`.
     *
     * @type {boolean}
     */
    set convexHull(arg) {
        this._setValue('convexHull', arg);
    }

    /**
     * Gets whether the collision mesh should be treated as a convex hull.
     *
     * @type {boolean}
     */
    get convexHull() {
        return this.data.convexHull;
    }

    set shape(arg) {
        this._setValue('shape', arg);
    }

    get shape() {
        return this.data.shape;
    }

    /**
     * Sets the model that is added to the scene graph for the mesh collision volume.
     *
     * @type {import('../../../scene/model.js').Model | null}
     */
    set model(arg) {
        this._setValue('model', arg);
    }

    /**
     * Gets the model that is added to the scene graph for the mesh collision volume.
     *
     * @type {import('../../../scene/model.js').Model | null}
     */
    get model() {
        return this.data.model;
    }

    set render(arg) {
        this._setValue('render', arg);
    }

    get render() {
        return this.data.render;
    }

    /**
     * Sets whether checking for duplicate vertices should be enabled when creating collision meshes.
     *
     * @type {boolean}
     */
    set checkVertexDuplicates(arg) {
        this._setValue('checkVertexDuplicates', arg);
    }

    /**
     * Gets whether checking for duplicate vertices should be enabled when creating collision meshes.
     *
     * @type {boolean}
     */
    get checkVertexDuplicates() {
        return this.data.checkVertexDuplicates;
    }

    /** @ignore */
    _setValue(name, value) {
        const data = this.data;
        const oldValue = data[name];
        data[name] = value;
        this.fire('set', name, oldValue, value);
    }

    /**
     * @param {string} name - Property name.
     * @param {*} oldValue - Previous value of the property.
     * @param {*} newValue - New value of the property.
     * @private
     */
    onSetType(name, oldValue, newValue) {
        if (oldValue !== newValue) {
            this.system.changeType(this, oldValue, newValue);
        }
    }

    /**
     * @param {string} name - Property name.
     * @param {*} oldValue - Previous value of the property.
     * @param {*} newValue - New value of the property.
     * @private
     */
    onSetHalfExtents(name, oldValue, newValue) {
        const t = this.data.type;
        if (this.data.initialized && t === 'box') {
            this.system.recreatePhysicalShapes(this);
        }
    }

    /**
     * @param {string} name - Property name.
     * @param {*} oldValue - Previous value of the property.
     * @param {*} newValue - New value of the property.
     * @private
     */
    onSetOffset(name, oldValue, newValue) {
        this._hasOffset =
            !this.data.linearOffset.equals(Vec3.ZERO) ||
            !this.data.angularOffset.equals(Quat.IDENTITY);

        if (this.data.initialized) {
            this.system.recreatePhysicalShapes(this);
        }
    }

    /**
     * @param {string} name - Property name.
     * @param {*} oldValue - Previous value of the property.
     * @param {*} newValue - New value of the property.
     * @private
     */
    onSetRadius(name, oldValue, newValue) {
        const t = this.data.type;
        if (this.data.initialized && (t === 'sphere' || t === 'capsule' || t === 'cylinder' || t === 'cone')) {
            this.system.recreatePhysicalShapes(this);
        }
    }

    /**
     * @param {string} name - Property name.
     * @param {*} oldValue - Previous value of the property.
     * @param {*} newValue - New value of the property.
     * @private
     */
    onSetHeight(name, oldValue, newValue) {
        const t = this.data.type;
        if (this.data.initialized && (t === 'capsule' || t === 'cylinder' || t === 'cone')) {
            this.system.recreatePhysicalShapes(this);
        }
    }

    /**
     * @param {string} name - Property name.
     * @param {*} oldValue - Previous value of the property.
     * @param {*} newValue - New value of the property.
     * @private
     */
    onSetAxis(name, oldValue, newValue) {
        const t = this.data.type;
        if (this.data.initialized && (t === 'capsule' || t === 'cylinder' || t === 'cone')) {
            this.system.recreatePhysicalShapes(this);
        }
    }

    /**
     * @param {string} name - Property name.
     * @param {*} oldValue - Previous value of the property.
     * @param {*} newValue - New value of the property.
     * @private
     */
    onSetAsset(name, oldValue, newValue) {
        const assets = this.system.app.assets;

        if (oldValue) {
            // Remove old listeners
            const asset = assets.get(oldValue);
            if (asset) {
                asset.off('remove', this.onAssetRemoved, this);
            }
        }

        if (newValue) {
            if (newValue instanceof Asset) {
                this.data.asset = newValue.id;
            }

            const asset = assets.get(this.data.asset);
            if (asset) {
                // make sure we don't subscribe twice
                asset.off('remove', this.onAssetRemoved, this);
                asset.on('remove', this.onAssetRemoved, this);
            }
        }

        if (this.data.initialized && this.data.type === 'mesh') {
            if (!newValue) {
                // if asset is null set model to null
                // so that it's going to be removed from the simulation
                this.data.model = null;
            }
            this.system.recreatePhysicalShapes(this);
        }
    }

    /**
     * @param {string} name - Property name.
     * @param {*} oldValue - Previous value of the property.
     * @param {*} newValue - New value of the property.
     * @private
     */
    onSetRenderAsset(name, oldValue, newValue) {
        const assets = this.system.app.assets;

        if (oldValue) {
            // Remove old listeners
            const asset = assets.get(oldValue);
            if (asset) {
                asset.off('remove', this.onRenderAssetRemoved, this);
            }
        }

        if (newValue) {
            if (newValue instanceof Asset) {
                this.data.renderAsset = newValue.id;
            }

            const asset = assets.get(this.data.renderAsset);
            if (asset) {
                // make sure we don't subscribe twice
                asset.off('remove', this.onRenderAssetRemoved, this);
                asset.on('remove', this.onRenderAssetRemoved, this);
            }
        }

        if (this.data.initialized && this.data.type === 'mesh') {
            if (!newValue) {
                // if render asset is null set render to null
                // so that it's going to be removed from the simulation
                this.data.render = null;
            }
            this.system.recreatePhysicalShapes(this);
        }
    }

    /**
     * @param {string} name - Property name.
     * @param {*} oldValue - Previous value of the property.
     * @param {*} newValue - New value of the property.
     * @private
     */
    onSetModel(name, oldValue, newValue) {
        if (this.data.initialized && this.data.type === 'mesh') {
            // recreate physical shapes skipping loading the model
            // from the 'asset' as the model passed in newValue might
            // have been created procedurally
            this.system.implementations.mesh.doRecreatePhysicalShape(this);
        }
    }

    /**
     * @param {string} name - Property name.
     * @param {*} oldValue - Previous value of the property.
     * @param {*} newValue - New value of the property.
     * @private
     */
    onSetRender(name, oldValue, newValue) {
        this.onSetModel(name, oldValue, newValue);
    }

    /**
     * @param {Asset} asset - Asset that was removed.
     * @private
     */
    onAssetRemoved(asset) {
        asset.off('remove', this.onAssetRemoved, this);
        if (this.data.asset === asset.id) {
            this.asset = null;
        }
    }

    /**
     * @param {Asset} asset - Asset that was removed.
     * @private
     */
    onRenderAssetRemoved(asset) {
        asset.off('remove', this.onRenderAssetRemoved, this);
        if (this.data.renderAsset === asset.id) {
            this.renderAsset = null;
        }
    }

    /**
     * @param {*} shape - Ammo shape.
     * @returns {number|null} The shape's index in the child array of the compound shape.
     * @private
     */
    _getCompoundChildShapeIndex(shape) {
        const compound = this.data.shape;
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
     * @param {import('../../../scene/graph-node.js').GraphNode} parent - The parent node.
     * @private
     */
    _onInsert(parent) {
        // TODO
        // if is child of compound shape
        // and there is no change of compoundParent, then update child transform
        // once updateChildTransform is exposed in ammo.js

        if (typeof Ammo === 'undefined') {
            return;
        }

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
                if (parent.collision && parent.collision === this._compoundParent) {
                    break;
                }

                if (parent._dirtyLocal) {
                    dirty = true;
                }

                parent = parent.parent;
            }

            if (dirty) {
                entity.forEach(this.system.implementations.compound._updateEachDescendantTransform, entity);

                const bodyComponent = this._compoundParent.entity.rigidbody;
                if (bodyComponent) {
                    bodyComponent.activate();
                }
            }
        }
    }

    /**
     * Returns the world position for the collision shape, taking into account of any offsets.
     *
     * @returns {Vec3} The world position for the collision shape.
     */
    getShapePosition() {
        const pos = this.entity.getPosition();

        if (this._hasOffset) {
            const rot = this.entity.getRotation();
            const lo = this.data.linearOffset;

            _quat.copy(rot).transformVector(lo, _vec3);
            return _vec3.add(pos);
        }

        return pos;
    }

    /**
     * Returns the world rotation for the collision shape, taking into account of any offsets.
     *
     * @returns {Quat} The world rotation for the collision.
     */
    getShapeRotation() {
        const rot = this.entity.getRotation();

        if (this._hasOffset) {
            return _quat.copy(rot).mul(this.data.angularOffset);
        }

        return rot;
    }

    onEnable() {
        if (this.data.type === 'mesh' && (this.data.asset || this.data.renderAsset) && this.data.initialized) {
            const asset = this.system.app.assets.get(this.data.asset || this.data.renderAsset);
            // recreate the collision shape if the model asset is not loaded
            // or the shape does not exist
            if (asset && (!asset.resource || !this.data.shape)) {
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
                this._compoundParent.shape.addChildShape(transform, this.data.shape);
                Ammo.destroy(transform);

                if (this._compoundParent.entity.rigidbody) {
                    this._compoundParent.entity.rigidbody.activate();
                }
            }
        } else if (this.entity.trigger) {
            this.entity.trigger.enable();
        }
    }

    onDisable() {
        if (this.entity.rigidbody) {
            this.entity.rigidbody.disableSimulation();
        } else if (this._compoundParent && this !== this._compoundParent) {
            if (!this._compoundParent.entity._destroying) {
                this.system._removeCompoundChild(this._compoundParent, this.data.shape);

                if (this._compoundParent.entity.rigidbody) {
                    this._compoundParent.entity.rigidbody.activate();
                }
            }
        } else if (this.entity.trigger) {
            this.entity.trigger.disable();
        }
    }

    /** @private */
    onBeforeRemove() {
        if (this.asset) {
            this.asset = null;
        }
        if (this.renderAsset) {
            this.renderAsset = null;
        }

        this.entity.off('insert', this._onInsert, this);

        this.off();
    }
}

export { CollisionComponent };
