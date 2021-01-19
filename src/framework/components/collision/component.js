import { Asset } from '../../../asset/asset.js';

import { Component } from '../component.js';

/**
 * @component
 * @class
 * @name CollisionComponent
 * @augments pc.Component
 * @classdesc A collision volume. Use this in conjunction with a {@link pc.RigidBodyComponent}
 * to make a collision volume that can be simulated using the physics engine.
 *
 * If the {@link pc.Entity} does not have a {@link pc.RigidBodyComponent} then this collision
 * volume will act as a trigger volume. When an entity with a dynamic or kinematic body enters
 * or leaves an entity with a trigger volume, both entities will receive trigger events.
 *
 * The following table shows all the events that can be fired between two Entities:
 *
 * |                                       | Rigid Body (Static)                                                   | Rigid Body (Dynamic or Kinematic)                                     | Trigger Volume                                      |
 * | ------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------- |
 * | **Rigid Body (Static)**               |                                                                       | <ul><li>contact</li><li>collisionstart</li><li>collisionend</li></ul> |                                                     |
 * | **Rigid Body (Dynamic or Kinematic)** | <ul><li>contact</li><li>collisionstart</li><li>collisionend</li></ul> | <ul><li>contact</li><li>collisionstart</li><li>collisionend</li></ul> | <ul><li>triggerenter</li><li>triggerleave</li></ul> |
 * | **Trigger Volume**                    |                                                                       | <ul><li>triggerenter</li><li>triggerleave</li></ul>                   |                                                     |
 *
 * @description Create a new CollisionComponent.
 * @param {pc.CollisionComponentSystem} system - The ComponentSystem that created this Component.
 * @param {pc.Entity} entity - The Entity that this Component is attached to.
 * @property {string} type The type of the collision volume. Can be:
 *
 * * "box": A box-shaped collision volume.
 * * "capsule": A capsule-shaped collision volume.
 * * "compound": A compound shape. Any descendant entities with a collision component
 * of type box, capsule, cone, cylinder or sphere will be combined into a single, rigid
 * shape.
 * * "cone": A cone-shaped collision volume.
 * * "cylinder": A cylinder-shaped collision volume.
 * * "mesh": A collision volume that uses a model asset as its shape.
 * * "sphere": A sphere-shaped collision volume.
 *
 * Defaults to "box".
 * @property {pc.Vec3} halfExtents The half-extents of the box-shaped collision volume in the
 * x, y and z axes. Defaults to [0.5, 0.5, 0.5].
 * @property {number} radius The radius of the sphere, capsule, cylinder or cone-shaped collision
 * volumes. Defaults to 0.5.
 * @property {number} axis The local space axis with which the capsule, cylinder or cone-shaped
 * collision volume's length is aligned. 0 for X, 1 for Y and 2 for Z. Defaults to 1 (Y-axis).
 * @property {number} height The total height of the capsule, cylinder or cone-shaped collision
 * volume from tip to tip. Defaults to 2.
 * @property {pc.Asset} asset The asset for the model of the mesh collision volume - can also be
 * an asset id. Defaults to null.
 * @property {pc.Model} model The model that is added to the scene graph for the mesh collision
 * volume.
 */
class CollisionComponent extends Component {
    constructor(system, entity) {
        super(system, entity);

        this._compoundParent = null;

        this.entity.on('insert', this._onInsert, this);

        this.on('set_type', this.onSetType, this);
        this.on('set_halfExtents', this.onSetHalfExtents, this);
        this.on('set_radius', this.onSetRadius, this);
        this.on('set_height', this.onSetHeight, this);
        this.on('set_axis', this.onSetAxis, this);
        this.on("set_asset", this.onSetAsset, this);
        this.on("set_model", this.onSetModel, this);
    }

    // Events Documentation
    /**
     * @event
     * @name CollisionComponent#contact
     * @description The 'contact' event is fired when a contact occurs between two rigid bodies.
     * @param {pc.ContactResult} result - Details of the contact between the two rigid bodies.
     */

    /**
     * @event
     * @name CollisionComponent#collisionstart
     * @description The 'collisionstart' event is fired when two rigid bodies start touching.
     * @param {pc.ContactResult} result - Details of the contact between the two Entities.
     */

    /**
     * @event
     * @name CollisionComponent#collisionend
     * @description The 'collisionend' event is fired two rigid-bodies stop touching.
     * @param {pc.Entity} other - The {@link pc.Entity} that stopped touching this collision volume.
     */

    /**
     * @event
     * @name CollisionComponent#triggerenter
     * @description The 'triggerenter' event is fired when a rigid body enters a trigger volume.
     * a {@link pc.RigidBodyComponent} attached.
     * @param {pc.Entity} other - The {@link pc.Entity} that entered this collision volume.
     */

    /**
     * @event
     * @name CollisionComponent#triggerleave
     * @description The 'triggerleave' event is fired when a rigid body exits a trigger volume.
     * a {@link pc.RigidBodyComponent} attached.
     * @param {pc.Entity} other - The {@link pc.Entity} that exited this collision volume.
     */

    onSetType(name, oldValue, newValue) {
        if (oldValue !== newValue) {
            this.system.changeType(this, oldValue, newValue);
        }
    }

    onSetHalfExtents(name, oldValue, newValue) {
        var t = this.data.type;
        if (this.data.initialized && t === 'box') {
            this.system.recreatePhysicalShapes(this);
        }
    }

    onSetRadius(name, oldValue, newValue) {
        var t = this.data.type;
        if (this.data.initialized && (t === 'sphere' || t === 'capsule' || t === 'cylinder' || t === 'cone')) {
            this.system.recreatePhysicalShapes(this);
        }
    }

    onSetHeight(name, oldValue, newValue) {
        var t = this.data.type;
        if (this.data.initialized && (t === 'capsule' || t === 'cylinder' || t === 'cone')) {
            this.system.recreatePhysicalShapes(this);
        }
    }

    onSetAxis(name, oldValue, newValue) {
        var t = this.data.type;
        if (this.data.initialized && (t === 'capsule' || t === 'cylinder' || t === 'cone')) {
            this.system.recreatePhysicalShapes(this);
        }
    }

    onSetAsset(name, oldValue, newValue) {
        var asset;
        var assets = this.system.app.assets;

        if (oldValue) {
            // Remove old listeners
            asset = assets.get(oldValue);
            if (asset) {
                asset.off('remove', this.onAssetRemoved, this);
            }
        }

        if (newValue) {
            if (newValue instanceof Asset) {
                this.data.asset = newValue.id;
            }

            asset = assets.get(this.data.asset);
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

    onSetModel(name, oldValue, newValue) {
        if (this.data.initialized && this.data.type === 'mesh') {
            // recreate physical shapes skipping loading the model
            // from the 'asset' as the model passed in newValue might
            // have been created procedurally
            this.system.implementations.mesh.doRecreatePhysicalShape(this);
        }
    }

    onAssetRemoved(asset) {
        asset.off('remove', this.onAssetRemoved, this);
        if (this.data.asset === asset.id) {
            this.asset = null;
        }
    }

    _getCompoundChildShapeIndex(shape) {
        var compound = this.data.shape;
        var shapes = compound.getNumChildShapes();

        for (var i = 0; i < shapes; i++) {
            var childShape = compound.getChildShape(i);
            if (childShape.ptr === shape.ptr) {
                return i;
            }
        }

        return null;
    }

    _onInsert(parent) {
        // TODO
        // if is child of compound shape
        // and there is no change of compoundParent, then update child transform
        // once updateChildTransform is exposed in ammo.js

        if (typeof Ammo === 'undefined')
            return;

        if (this._compoundParent) {
            this.system.recreatePhysicalShapes(this);
        } else if (! this.entity.rigidbody) {
            var ancestor = this.entity.parent;
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

    _updateCompound() {
        var entity = this.entity;
        if (entity._dirtyWorld) {
            var dirty = entity._dirtyLocal;
            var parent = entity;
            while (parent && !dirty) {
                if (parent.collision && parent.collision === this._compoundParent)
                    break;

                if (parent._dirtyLocal)
                    dirty = true;

                parent = parent.parent;
            }

            if (dirty) {
                entity.forEach(this.system.implementations.compound._updateEachDescendantTransform, entity);

                var bodyComponent = this._compoundParent.entity.rigidbody;
                if (bodyComponent)
                    bodyComponent.activate();
            }
        }
    }

    onEnable() {
        if (this.data.type === 'mesh' && this.data.asset && this.data.initialized) {
            var asset = this.system.app.assets.get(this.data.asset);
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
                var transform = this.system._getNodeTransform(this.entity, this._compoundParent.entity);
                this._compoundParent.shape.addChildShape(transform, this.data.shape);
                Ammo.destroy(transform);

                if (this._compoundParent.entity.rigidbody)
                    this._compoundParent.entity.rigidbody.activate();
            }
        } else if (this.entity.trigger) {
            this.entity.trigger.enable();
        }
    }

    onDisable() {
        if (this.entity.rigidbody) {
            this.entity.rigidbody.disableSimulation();
        } else if (this._compoundParent && this !== this._compoundParent) {
            if (! this._compoundParent.entity._destroying) {
                this.system._removeCompoundChild(this._compoundParent, this.data.shape);

                if (this._compoundParent.entity.rigidbody)
                    this._compoundParent.entity.rigidbody.activate();
            }
        } else if (this.entity.trigger) {
            this.entity.trigger.disable();
        }
    }

    onBeforeRemove() {
        if (this.asset) {
            this.asset = null;
        }

        this.entity.off('insert', this._onInsert, this);

        this.off();
    }
}

export { CollisionComponent };
