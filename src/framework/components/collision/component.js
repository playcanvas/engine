import { Quat } from '../../../core/math/quat.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { Asset } from '../../asset/asset.js';
import { Component } from '../component.js';

/**
 * @import { CollisionComponentSystem } from './system.js'
 * @import { Entity } from '../../entity.js'
 * @import { GraphNode } from '../../../scene/graph-node.js'
 * @import { Model } from '../../../scene/model.js'
 */

const _vec3 = new Vec3();
const _quat = new Quat();

/**
 * The CollisionComponent enables an {@link Entity} to act as a collision volume. Use it on its own
 * to define a trigger volume. Or use it in conjunction with a {@link RigidBodyComponent} to make a
 * collision volume that can be simulated using the physics engine.
 *
 * When an entity is configured as a trigger volume, if an entity with a dynamic or kinematic body
 * enters or leaves that trigger volume, both entities will receive trigger events.
 *
 * You should never need to use the CollisionComponent constructor directly. To add a
 * CollisionComponent to an {@link Entity}, use {@link Entity#addComponent}:
 *
 * ```javascript
 * const entity = new pc.Entity();
 * entity.addComponent('collision'); // This defaults to 1x1x1 box-shaped trigger volume
 * ```
 *
 * To create a 0.5 radius dynamic rigid body sphere:
 *
 * ```javascript
 * const entity = new pc.Entity();
 * entity.addComponent('collision', {
 *     type: 'sphere'
 * });
 * entity.addComponent('rigidbody', {
 *     type: 'dynamic'
 * });
 * ```
 *
 * Once the CollisionComponent is added to the entity, you can access it via the
 * {@link Entity#collision} property:
 *
 * ```javascript
 * entity.collision.type = 'cylinder'; // Set the collision volume to a cylinder
 *
 * console.log(entity.collision.type); // Get the collision volume type and print it
 * ```
 *
 * Relevant Engine API examples:
 *
 * - [Compound Collision](https://playcanvas.github.io/#/physics/compound-collision)
 * - [Falling Shapes](https://playcanvas.github.io/#/physics/falling-shapes)
 * - [Offset Collision](https://playcanvas.github.io/#/physics/offset-collision)
 *
 * @hideconstructor
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
     * Fired when two rigid bodies stop touching. The handler is passed an {@link Entity} that
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

    /** @private */
    _type = 'box';

    /** @private */
    _halfExtents = new Vec3(0.5, 0.5, 0.5);

    /** @private */
    _linearOffset = new Vec3();

    /** @private */
    _angularOffset = new Quat();

    /** @private */
    _radius = 0.5;

    /** @private */
    _axis = 1;

    /** @private */
    _height = 2;

    /**
     * @type {number|null}
     * @private
     */
    _asset = null;

    /**
     * @type {number|null}
     * @private
     */
    _renderAsset = null;

    /** @private */
    _convexHull = false;

    /** @private */
    _shape = null;

    /**
     * @type {Model|null}
     * @private
     */
    _model = null;

    /** @private */
    _render = null;

    /** @private */
    _checkVertexDuplicates = true;

    /** @private */
    _initialized = false;

    /** @private */
    _compoundParent = null;

    /** @private */
    _hasOffset = false;

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
        if (this._type === arg) {
            return;
        }

        const previous = this._type;
        this._type = arg;
        this.system.changeType(this, previous, arg);
    }

    /**
     * Gets the type of the collision volume.
     *
     * @type {string}
     */
    get type() {
        return this._type;
    }

    /**
     * Sets the half-extents of the box-shaped collision volume in the x, y and z axes. Defaults to
     * `[0.5, 0.5, 0.5]`.
     *
     * @type {Vec3}
     */
    set halfExtents(arg) {
        if (arg instanceof Vec3) {
            this._halfExtents.copy(arg);
        } else {
            this._halfExtents.set(arg[0], arg[1], arg[2]);
        }

        if (this._initialized && this._type === 'box') {
            this.system.recreatePhysicalShapes(this);
        }
    }

    /**
     * Gets the half-extents of the box-shaped collision volume in the x, y and z axes. Use the
     * setter to update the collision shape.
     *
     * @type {Readonly<Vec3>}
     */
    get halfExtents() {
        return this._halfExtents;
    }

    /**
     * Sets the positional offset of the collision shape from the Entity position along the local
     * axes. Defaults to `[0, 0, 0]`.
     *
     * @type {Vec3}
     */
    set linearOffset(arg) {
        if (arg instanceof Vec3) {
            this._linearOffset.copy(arg);
        } else {
            this._linearOffset.set(arg[0], arg[1], arg[2]);
        }

        this._updateHasOffset();

        if (this._initialized) {
            this.system.recreatePhysicalShapes(this);
        }
    }

    /**
     * Gets the positional offset of the collision shape from the Entity position along the local
     * axes. Use the setter to update the collision shape.
     *
     * @type {Readonly<Vec3>}
     */
    get linearOffset() {
        return this._linearOffset;
    }

    /**
     * Sets the rotational offset of the collision shape from the Entity rotation in local space.
     * Defaults to identity.
     *
     * @type {Quat}
     */
    set angularOffset(arg) {
        if (arg instanceof Quat) {
            this._angularOffset.copy(arg);
        } else if (arg.length === 3) {
            // allow for euler angles to be passed as a 3 length array
            this._angularOffset.setFromEulerAngles(arg[0], arg[1], arg[2]);
        } else {
            this._angularOffset.set(arg[0], arg[1], arg[2], arg[3]);
        }

        this._updateHasOffset();

        if (this._initialized) {
            this.system.recreatePhysicalShapes(this);
        }
    }

    /**
     * Gets the rotational offset of the collision shape from the Entity rotation in local space. Use
     * the setter to update the collision shape.
     *
     * @type {Readonly<Quat>}
     */
    get angularOffset() {
        return this._angularOffset;
    }

    /**
     * Sets the radius of the sphere, capsule, cylinder or cone-shaped collision volumes.
     * Defaults to 0.5.
     *
     * @type {number}
     */
    set radius(arg) {
        this._radius = arg;

        const t = this._type;
        if (this._initialized && (t === 'sphere' || t === 'capsule' || t === 'cylinder' || t === 'cone')) {
            this.system.recreatePhysicalShapes(this);
        }
    }

    /**
     * Gets the radius of the sphere, capsule, cylinder or cone-shaped collision volumes.
     *
     * @type {number}
     */
    get radius() {
        return this._radius;
    }

    /**
     * Sets the local space axis with which the capsule, cylinder or cone-shaped collision volume's
     * length is aligned. 0 for X, 1 for Y and 2 for Z. Defaults to 1 (Y-axis).
     *
     * @type {number}
     */
    set axis(arg) {
        this._axis = arg;

        const t = this._type;
        if (this._initialized && (t === 'capsule' || t === 'cylinder' || t === 'cone')) {
            this.system.recreatePhysicalShapes(this);
        }
    }

    /**
     * Gets the local space axis with which the capsule, cylinder or cone-shaped collision volume's
     * length is aligned.
     *
     * @type {number}
     */
    get axis() {
        return this._axis;
    }

    /**
     * Sets the total height of the capsule, cylinder or cone-shaped collision volume from tip to
     * tip. Defaults to 2.
     *
     * @type {number}
     */
    set height(arg) {
        this._height = arg;

        const t = this._type;
        if (this._initialized && (t === 'capsule' || t === 'cylinder' || t === 'cone')) {
            this.system.recreatePhysicalShapes(this);
        }
    }

    /**
     * Gets the total height of the capsule, cylinder or cone-shaped collision volume from tip to
     * tip.
     *
     * @type {number}
     */
    get height() {
        return this._height;
    }

    /**
     * Sets the asset or asset id for the model of the mesh collision volume. Defaults to null.
     *
     * @type {Asset|number|null}
     */
    set asset(arg) {
        const assets = this.system.app.assets;

        if (this._asset) {
            // remove the listener registered on the previous asset
            const asset = assets.get(this._asset);
            if (asset) {
                asset.off('remove', this.onAssetRemoved, this);
            }
        }

        this._asset = arg instanceof Asset ? arg.id : arg;

        if (arg) {
            const asset = assets.get(this._asset);
            if (asset) {
                // make sure we don't subscribe twice
                asset.off('remove', this.onAssetRemoved, this);
                asset.on('remove', this.onAssetRemoved, this);
            }
        }

        if (this._initialized && this._type === 'mesh') {
            if (!arg) {
                // if asset is null set model to null so that the shape is
                // removed from the simulation - write the private field so
                // recreatePhysicalShapes below performs the single rebuild
                this._model = null;
            }
            this.system.recreatePhysicalShapes(this);
        }
    }

    /**
     * Gets the asset or asset id for the model of the mesh collision volume.
     *
     * @type {Asset|number|null}
     */
    get asset() {
        return this._asset;
    }

    /**
     * Sets the render asset or asset id of the mesh collision volume. Defaults to null.
     * If not set then the asset property will be checked instead.
     *
     * @type {Asset|number|null}
     */
    set renderAsset(arg) {
        const assets = this.system.app.assets;

        if (this._renderAsset) {
            // remove the listener registered on the previous asset
            const asset = assets.get(this._renderAsset);
            if (asset) {
                asset.off('remove', this.onRenderAssetRemoved, this);
            }
        }

        this._renderAsset = arg instanceof Asset ? arg.id : arg;

        if (arg) {
            const asset = assets.get(this._renderAsset);
            if (asset) {
                // make sure we don't subscribe twice
                asset.off('remove', this.onRenderAssetRemoved, this);
                asset.on('remove', this.onRenderAssetRemoved, this);
            }
        }

        if (this._initialized && this._type === 'mesh') {
            if (!arg) {
                // if render asset is null set render to null so that the
                // shape is removed from the simulation - write the private
                // field so recreatePhysicalShapes performs the single rebuild
                this._render = null;
            }
            this.system.recreatePhysicalShapes(this);
        }
    }

    /**
     * Gets the render asset id of the mesh collision volume.
     *
     * @type {Asset|number|null}
     */
    get renderAsset() {
        return this._renderAsset;
    }

    /**
     * Sets whether the collision mesh should be treated as a convex hull. When false, the mesh can
     * only be used with a static body. When true, the mesh can be used with a static, dynamic or
     * kinematic body. Defaults to `false`.
     *
     * @type {boolean}
     */
    set convexHull(arg) {
        this._convexHull = arg;

        if (this._initialized && this._type === 'mesh') {
            this.system.implementations.mesh.doRecreatePhysicalShape(this);
        }
    }

    /**
     * Gets whether the collision mesh should be treated as a convex hull.
     *
     * @type {boolean}
     */
    get convexHull() {
        return this._convexHull;
    }

    set shape(arg) {
        this._shape = arg;
    }

    get shape() {
        return this._shape;
    }

    /**
     * Sets the model that is added to the scene graph for the mesh collision volume.
     *
     * @type {Model | null}
     */
    set model(arg) {
        this._model = arg;

        if (this._initialized && this._type === 'mesh') {
            // recreate physical shapes skipping loading the model
            // from the 'asset' as the model passed in might
            // have been created procedurally
            this.system.implementations.mesh.doRecreatePhysicalShape(this);
        }
    }

    /**
     * Gets the model that is added to the scene graph for the mesh collision volume.
     *
     * @type {Model | null}
     */
    get model() {
        return this._model;
    }

    set render(arg) {
        this._render = arg;

        if (this._initialized && this._type === 'mesh') {
            // recreate physical shapes skipping loading the render asset
            // as the render passed in might have been created procedurally
            this.system.implementations.mesh.doRecreatePhysicalShape(this);
        }
    }

    get render() {
        return this._render;
    }

    /**
     * Sets whether checking for duplicate vertices should be enabled when creating collision meshes.
     *
     * @type {boolean}
     */
    set checkVertexDuplicates(arg) {
        this._checkVertexDuplicates = arg;
    }

    /**
     * Gets whether checking for duplicate vertices should be enabled when creating collision meshes.
     *
     * @type {boolean}
     */
    get checkVertexDuplicates() {
        return this._checkVertexDuplicates;
    }

    /** @private */
    _updateHasOffset() {
        this._hasOffset =
            !this._linearOffset.equals(Vec3.ZERO) ||
            !this._angularOffset.equals(Quat.IDENTITY);
    }

    /**
     * @param {Asset} asset - Asset that was removed.
     * @private
     */
    onAssetRemoved(asset) {
        asset.off('remove', this.onAssetRemoved, this);
        if (this._asset === asset.id) {
            this.asset = null;
        }
    }

    /**
     * @param {Asset} asset - Asset that was removed.
     * @private
     */
    onRenderAssetRemoved(asset) {
        asset.off('remove', this.onRenderAssetRemoved, this);
        if (this._renderAsset === asset.id) {
            this.renderAsset = null;
        }
    }

    /**
     * @param {object} shape - The Ammo collision shape to find.
     * @returns {number|null} The shape's index in the child array of the compound shape.
     * @ignore
     */
    getCompoundChildShapeIndex(shape) {
        const compound = this._shape;
        const shapes = compound.getNumChildShapes();

        for (let i = 0; i < shapes; i++) {
            const childShape = compound.getChildShape(i);
            if (Ammo.getPointer(childShape) === Ammo.getPointer(shape)) {
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
            const lo = this._linearOffset;

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
            return _quat.copy(rot).mul(this._angularOffset);
        }

        return rot;
    }

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
                this.system._removeCompoundChild(this._compoundParent, this._shape);

                if (this._compoundParent.entity.rigidbody) {
                    this._compoundParent.entity.rigidbody.activate();
                }
            }
        } else if (this.entity.trigger) {
            this.entity.trigger.disable();
        }
    }

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
