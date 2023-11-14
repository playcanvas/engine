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
 * @property {string} type The type of the collision volume. Can be:
 *
 * - "box": A box-shaped collision volume.
 * - "capsule": A capsule-shaped collision volume.
 * - "compound": A compound shape. Any descendant entities with a collision component
 * of type box, capsule, cone, cylinder or sphere will be combined into a single, rigid
 * shape.
 * - "cone": A cone-shaped collision volume.
 * - "cylinder": A cylinder-shaped collision volume.
 * - "mesh": A collision volume that uses a model asset as its shape.
 * - "sphere": A sphere-shaped collision volume.
 *
 * Defaults to "box".
 * @property {Vec3} halfExtents The half-extents of the
 * box-shaped collision volume in the x, y and z axes. Defaults to [0.5, 0.5, 0.5].
 * @property {Vec3} linearOffset The positional offset of the collision shape from the Entity position along the local axes.
 * Defaults to [0, 0, 0].
 * @property {Quat} angularOffset The rotational offset of the collision shape from the Entity rotation in local space.
 * Defaults to identity.
 * @property {number} radius The radius of the sphere, capsule, cylinder or cone-shaped collision
 * volumes. Defaults to 0.5.
 * @property {number} axis The local space axis with which the capsule, cylinder or cone-shaped
 * collision volume's length is aligned. 0 for X, 1 for Y and 2 for Z. Defaults to 1 (Y-axis).
 * @property {number} height The total height of the capsule, cylinder or cone-shaped collision
 * volume from tip to tip. Defaults to 2.
 * @property {Asset|number} asset The asset for the model of the mesh collision volume - can also
 * be an asset id. Defaults to null.
 * @property {Asset|number} renderAsset The render asset of the mesh collision volume - can also be
 * an asset id. Defaults to null. If not set then the asset property will be checked instead.
 * @property {import('../../../scene/model.js').Model} model The model that is added to the scene
 * graph for the mesh collision volume.
 * @augments Component
 * @category Physics
 */
class CollisionComponent extends Component {
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

    /**
     * The 'contact' event is fired when a contact occurs between two rigid bodies.
     *
     * @event CollisionComponent#contact
     * @param {ContactResult} result - Details of the contact between the two rigid bodies.
     */

    /**
     * Fired when two rigid bodies start touching.
     *
     * @event CollisionComponent#collisionstart
     * @param {ContactResult} result - Details of the contact between the two Entities.
     */

    /**
     * Fired two rigid-bodies stop touching.
     *
     * @event CollisionComponent#collisionend
     * @param {import('../../entity.js').Entity} other - The {@link Entity} that stopped touching this collision volume.
     */

    /**
     * Fired when a rigid body enters a trigger volume.
     *
     * @event CollisionComponent#triggerenter
     * @param {import('../../entity.js').Entity} other - The {@link Entity} that entered this collision volume.
     */

    /**
     * Fired when a rigid body exits a trigger volume.
     *
     * @event CollisionComponent#triggerleave
     * @param {import('../../entity.js').Entity} other - The {@link Entity} that exited this collision volume.
     */

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
        this._hasOffset = !this.data.linearOffset.equals(Vec3.ZERO) || !this.data.angularOffset.equals(Quat.IDENTITY);

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


    /**
     * @description Returns the world position for the collision shape taking into account of any offsets.
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
     * @description Returns the world rotation for the collision shape taking into account of any offsets.
     * @returns {Quat} The world rotation for the collision.
     */
    getShapeRotation() {
        const rot = this.entity.getRotation();

        if (this._hasOffset) {
            return _quat.copy(rot).mul(this.data.angularOffset);
        }

        return rot;
    }

    /** @private */
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
                this.system._removeCompoundChild(this._compoundParent, this.data.shape);

                if (this._compoundParent.entity.rigidbody)
                    this._compoundParent.entity.rigidbody.activate();
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
