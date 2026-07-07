import { Quat } from '../../../core/math/quat.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { Component } from '../component.js';
import {
    BODYTYPE_STATIC,
    BODYGROUP_DYNAMIC, BODYGROUP_KINEMATIC, BODYGROUP_STATIC,
    BODYMASK_ALL, BODYMASK_NOT_STATIC,
    BODYTYPE_DYNAMIC, BODYTYPE_KINEMATIC
} from './constants.js';

/**
 * @import { PhysicsBody } from '../../physics/physics-body.js'
 */

// Shared math variables to avoid excessive allocation
const _quat1 = new Quat();
const _quat2 = new Quat();
const _vec3 = new Vec3();
const _position = new Vec3();
const _rotation = new Quat();
const _vecA = new Vec3();
const _vecB = new Vec3();

/**
 * The RigidBodyComponent, when combined with a {@link CollisionComponent}, allows your entities
 * to be simulated using realistic physics. A RigidBodyComponent will fall under gravity and
 * collide with other rigid bodies. Using scripts, you can apply forces and impulses to rigid
 * bodies.
 *
 * You should never need to use the RigidBodyComponent constructor directly. To add a
 * RigidBodyComponent to an {@link Entity}, use {@link Entity#addComponent}:
 *
 * ```javascript
 * // Create a static 1x1x1 box-shaped rigid body
 * const entity = new pc.Entity();
 * entity.addComponent('collision'); // Without options, this defaults to a 1x1x1 box shape
 * entity.addComponent('rigidbody'); // Without options, this defaults to a 'static' body
 * ```
 *
 * To create a dynamic sphere with mass of 10, do:
 *
 * ```javascript
 * const entity = new pc.Entity();
 * entity.addComponent('collision', {
 *     type: 'sphere'
 * });
 * entity.addComponent('rigidbody', {
 *     type: 'dynamic',
 *     mass: 10
 * });
 * ```
 *
 * Once the RigidBodyComponent is added to the entity, you can access it via the
 * {@link Entity#rigidbody} property:
 *
 * ```javascript
 * entity.rigidbody.mass = 10;
 * console.log(entity.rigidbody.mass);
 * ```
 *
 * Relevant Engine API examples:
 *
 * - [Falling shapes](https://playcanvas.github.io/#/physics/falling-shapes)
 * - [Vehicle physics](https://playcanvas.github.io/#/physics/vehicle)
 *
 * @hideconstructor
 * @category Physics
 */
class RigidBodyComponent extends Component {
    /**
     * Fired when a contact occurs between two rigid bodies. The handler is passed a
     * {@link ContactResult} object containing details of the contact between the two rigid bodies.
     *
     * @event
     * @example
     * entity.rigidbody.on('contact', (result) => {
     *    console.log(`Contact between ${entity.name} and ${result.other.name}`);
     * });
     */
    static EVENT_CONTACT = 'contact';

    /**
     * Fired when two rigid bodies start touching. The handler is passed a {@link ContactResult}
     * object containing details of the contact between the two rigid bodies.
     *
     * @event
     * @example
     * entity.rigidbody.on('collisionstart', (result) => {
     *     console.log(`Collision started between ${entity.name} and ${result.other.name}`);
     * });
     */
    static EVENT_COLLISIONSTART = 'collisionstart';

    /**
     * Fired when two rigid bodies stop touching. The handler is passed an {@link Entity} that
     * represents the other rigid body involved in the collision.
     *
     * @event
     * @example
     * entity.rigidbody.on('collisionend', (other) => {
     *     console.log(`${entity.name} stopped touching ${other.name}`);
     * });
     */
    static EVENT_COLLISIONEND = 'collisionend';

    /**
     * Fired when a rigid body enters a trigger volume. The handler is passed an {@link Entity}
     * representing the trigger volume that this rigid body entered.
     *
     * @event
     * @example
     * entity.rigidbody.on('triggerenter', (trigger) => {
     *     console.log(`Entity ${entity.name} entered trigger volume ${trigger.name}`);
     * });
     */
    static EVENT_TRIGGERENTER = 'triggerenter';

    /**
     * Fired when a rigid body exits a trigger volume. The handler is passed an {@link Entity}
     * representing the trigger volume that this rigid body exited.
     *
     * @event
     * @example
     * entity.rigidbody.on('triggerleave', (trigger) => {
     *     console.log(`Entity ${entity.name} exited trigger volume ${trigger.name}`);
     * });
     */
    static EVENT_TRIGGERLEAVE = 'triggerleave';

    static order = -1;

    /** @private */
    _angularDamping = 0;

    /** @private */
    _angularFactor = new Vec3(1, 1, 1);

    /** @private */
    _angularVelocity = new Vec3();

    /**
     * The physics backend body, when created.
     *
     * @type {PhysicsBody|null}
     * @private
     */
    _body = null;

    /** @private */
    _friction = 0.5;

    /** @private */
    _group = BODYGROUP_STATIC;

    /** @private */
    _linearDamping = 0;

    /** @private */
    _linearFactor = new Vec3(1, 1, 1);

    /** @private */
    _linearVelocity = new Vec3();

    /** @private */
    _mask = BODYMASK_NOT_STATIC;

    /** @private */
    _mass = 1;

    /** @private */
    _restitution = 0;

    /** @private */
    _rollingFriction = 0;

    /** @private */
    _simulationEnabled = false;

    /**
     * @type {BODYTYPE_DYNAMIC|BODYTYPE_KINEMATIC|BODYTYPE_STATIC}
     * @private
     */
    _type = BODYTYPE_STATIC;

    /**
     * Sets the rate at which a body loses angular velocity over time.
     *
     * @type {number}
     */
    set angularDamping(damping) {
        if (this._angularDamping !== damping) {
            this._angularDamping = damping;

            if (this._body) {
                this._body.setDamping(this._linearDamping, damping);
            }
        }
    }

    /**
     * Gets the rate at which a body loses angular velocity over time.
     *
     * @type {number}
     */
    get angularDamping() {
        return this._angularDamping;
    }

    /**
     * Sets the scaling factor for angular movement of the body in each axis. Only valid for rigid
     * bodies of type {@link BODYTYPE_DYNAMIC}. Defaults to 1 in all axes (body can freely rotate).
     *
     * @type {Vec3}
     */
    set angularFactor(factor) {
        if (!this._angularFactor.equals(factor)) {
            this._angularFactor.copy(factor);

            if (this._body && this._type === BODYTYPE_DYNAMIC) {
                this._body.setAngularFactor(factor);
            }
        }
    }

    /**
     * Gets the scaling factor for angular movement of the body in each axis. Use the setter to
     * update the physics body.
     *
     * @type {Readonly<Vec3>}
     */
    get angularFactor() {
        return this._angularFactor;
    }

    /**
     * Sets the rotational speed of the body around each world axis.
     *
     * @type {Vec3}
     */
    set angularVelocity(velocity) {
        if (this._body && this._type === BODYTYPE_DYNAMIC) {
            this._body.activate();
            this._body.setAngularVelocity(velocity);

            this._angularVelocity.copy(velocity);
        }
    }

    /**
     * Gets the rotational speed of the body around each world axis. Use the setter to update the
     * physics body.
     *
     * @type {Readonly<Vec3>}
     */
    get angularVelocity() {
        if (this._body && this._type === BODYTYPE_DYNAMIC) {
            this._body.getAngularVelocity(this._angularVelocity);
        }
        return this._angularVelocity;
    }

    /**
     * @type {*}
     * @ignore
     */
    set body(body) {
        if (this._body !== body) {
            this._body = body;

            if (body && this._simulationEnabled) {
                body.activate();
            }
        }
    }

    /**
     * The native physics body - btRigidBody when the Ammo backend is active, null otherwise.
     * The setter takes the backend {@link PhysicsBody} and is internal.
     *
     * @type {*}
     * @ignore
     */
    get body() {
        return this._body ? this._body.nativeBody : null;
    }

    /**
     * Sets the friction value used when contacts occur between two bodies. A higher value indicates
     * more friction. Should be set in the range 0 to 1. Defaults to 0.5.
     *
     * @type {number}
     */
    set friction(friction) {
        if (this._friction !== friction) {
            this._friction = friction;

            if (this._body) {
                this._body.setFriction(friction);
            }
        }
    }

    /**
     * Gets the friction value used when contacts occur between two bodies.
     *
     * @type {number}
     */
    get friction() {
        return this._friction;
    }

    /**
     * Sets the collision group this body belongs to. Combine the group and the mask to prevent bodies
     * colliding with each other. Defaults to 1.
     *
     * @type {number}
     */
    set group(group) {
        if (this._group !== group) {
            this._group = group;

            // re-enabling simulation adds rigidbody back into world with new masks
            if (this.enabled && this.entity.enabled) {
                this.disableSimulation();
                this.enableSimulation();
            }
        }
    }

    /**
     * Gets the collision group this body belongs to.
     *
     * @type {number}
     */
    get group() {
        return this._group;
    }

    /**
     * Sets the rate at which a body loses linear velocity over time. Defaults to 0.
     *
     * @type {number}
     */
    set linearDamping(damping) {
        if (this._linearDamping !== damping) {
            this._linearDamping = damping;

            if (this._body) {
                this._body.setDamping(damping, this._angularDamping);
            }
        }
    }

    /**
     * Gets the rate at which a body loses linear velocity over time.
     *
     * @type {number}
     */
    get linearDamping() {
        return this._linearDamping;
    }

    /**
     * Sets the scaling factor for linear movement of the body in each axis. Only valid for rigid
     * bodies of type {@link BODYTYPE_DYNAMIC}. Defaults to 1 in all axes (body can freely move).
     *
     * @type {Vec3}
     */
    set linearFactor(factor) {
        if (!this._linearFactor.equals(factor)) {
            this._linearFactor.copy(factor);

            if (this._body && this._type === BODYTYPE_DYNAMIC) {
                this._body.setLinearFactor(factor);
            }
        }
    }

    /**
     * Gets the scaling factor for linear movement of the body in each axis. Use the setter to
     * update the physics body.
     *
     * @type {Readonly<Vec3>}
     */
    get linearFactor() {
        return this._linearFactor;
    }

    /**
     * Sets the speed of the body in a given direction.
     *
     * @type {Vec3}
     */
    set linearVelocity(velocity) {
        if (this._body && this._type === BODYTYPE_DYNAMIC) {
            this._body.activate();
            this._body.setLinearVelocity(velocity);

            this._linearVelocity.copy(velocity);
        }
    }

    /**
     * Gets the speed of the body in a given direction. Use the setter to update the physics body.
     *
     * @type {Readonly<Vec3>}
     */
    get linearVelocity() {
        if (this._body && this._type === BODYTYPE_DYNAMIC) {
            this._body.getLinearVelocity(this._linearVelocity);
        }
        return this._linearVelocity;
    }

    /**
     * Sets the collision mask sets which groups this body collides with. It is a bit field of 16
     * bits, the first 8 bits are reserved for engine use. Defaults to 65535.
     *
     * @type {number}
     */
    set mask(mask) {
        if (this._mask !== mask) {
            this._mask = mask;

            // re-enabling simulation adds rigidbody back into world with new masks
            if (this.enabled && this.entity.enabled) {
                this.disableSimulation();
                this.enableSimulation();
            }
        }
    }

    /**
     * Gets the collision mask sets which groups this body collides with.
     *
     * @type {number}
     */
    get mask() {
        return this._mask;
    }

    /**
     * Sets the mass of the body. This is only relevant for {@link BODYTYPE_DYNAMIC} bodies, other
     * types have infinite mass. Defaults to 1.
     *
     * @type {number}
     */
    set mass(mass) {
        if (this._mass !== mass) {
            this._mass = mass;

            if (this._body && this._type === BODYTYPE_DYNAMIC) {
                const enabled = this.enabled && this.entity.enabled;
                if (enabled) {
                    this.disableSimulation();
                }

                this._body.setMass(mass);

                if (enabled) {
                    this.enableSimulation();
                }
            }
        }
    }

    /**
     * Gets the mass of the body.
     *
     * @type {number}
     */
    get mass() {
        return this._mass;
    }

    /**
     * Sets the value that controls the amount of energy lost when two rigid bodies collide. The
     * calculation multiplies the restitution values for both colliding bodies. A multiplied value
     * of 0 means that all energy is lost in the collision while a value of 1 means that no energy
     * is lost. Should be set in the range 0 to 1. Defaults to 0.
     *
     * @type {number}
     */
    set restitution(restitution) {
        if (this._restitution !== restitution) {
            this._restitution = restitution;

            if (this._body) {
                this._body.setRestitution(restitution);
            }
        }
    }

    /**
     * Gets the value that controls the amount of energy lost when two rigid bodies collide.
     *
     * @type {number}
     */
    get restitution() {
        return this._restitution;
    }

    /**
     * Sets the torsional friction orthogonal to the contact point. Defaults to 0.
     *
     * @type {number}
     */
    set rollingFriction(friction) {
        if (this._rollingFriction !== friction) {
            this._rollingFriction = friction;

            if (this._body) {
                this._body.setRollingFriction(friction);
            }
        }
    }

    /**
     * Gets the torsional friction orthogonal to the contact point.
     *
     * @type {number}
     */
    get rollingFriction() {
        return this._rollingFriction;
    }

    /**
     * Sets the rigid body type determines how the body is simulated. Can be:
     *
     * - {@link BODYTYPE_STATIC}: infinite mass and cannot move.
     * - {@link BODYTYPE_DYNAMIC}: simulated according to applied forces.
     * - {@link BODYTYPE_KINEMATIC}: infinite mass and does not respond to forces (can only be
     * moved by setting the position and rotation of component's {@link Entity}).
     *
     * Defaults to {@link BODYTYPE_STATIC}.
     *
     * @type {BODYTYPE_DYNAMIC|BODYTYPE_KINEMATIC|BODYTYPE_STATIC}
     */
    set type(type) {
        if (this._type !== type) {
            this._type = type;

            this.disableSimulation();

            // set group and mask to defaults for type
            switch (type) {
                case BODYTYPE_DYNAMIC:
                    this._group = BODYGROUP_DYNAMIC;
                    this._mask = BODYMASK_ALL;
                    break;
                case BODYTYPE_KINEMATIC:
                    this._group = BODYGROUP_KINEMATIC;
                    this._mask = BODYMASK_ALL;
                    break;
                case BODYTYPE_STATIC:
                default:
                    this._group = BODYGROUP_STATIC;
                    this._mask = BODYMASK_NOT_STATIC;
                    break;
            }

            // Create a new body
            this.createBody();
        }
    }

    /**
     * Gets the rigid body type determines how the body is simulated.
     *
     * @type {BODYTYPE_DYNAMIC|BODYTYPE_KINEMATIC|BODYTYPE_STATIC}
     */
    get type() {
        return this._type;
    }

    /**
     * If the Entity has a Collision shape attached then create a rigid body using this shape. This
     * method destroys the existing body.
     *
     * @private
     */
    createBody() {
        const entity = this.entity;
        let shape;

        if (entity.collision) {
            shape = entity.collision.shape;

            // if a trigger was already created from the collision system
            // destroy it
            if (entity.trigger) {
                entity.trigger.destroy();
                delete entity.trigger;
            }
        }

        const world = this.system.physicsWorld;
        if (shape && world) {
            if (this._body) {
                world.removeBody(this._body);
                world.destroyBody(this._body);

                this._body = null;
            }

            const mass = this._type === BODYTYPE_DYNAMIC ? this._mass : 0;

            this._getEntityTransform(_position, _rotation);

            const body = world.createBody({
                type: this._type,
                mass: mass,
                shape: shape,
                position: _position,
                rotation: _rotation,
                entity: entity
            });

            body.setRestitution(this._restitution);
            body.setFriction(this._friction);
            body.setRollingFriction(this._rollingFriction);
            body.setDamping(this._linearDamping, this._angularDamping);

            if (this._type === BODYTYPE_DYNAMIC) {
                body.setLinearFactor(this._linearFactor);
                body.setAngularFactor(this._angularFactor);
            }

            this.body = body;

            if (this.enabled && entity.enabled) {
                this.enableSimulation();
            }
        }
    }

    /**
     * Returns true if the rigid body is currently actively being simulated. I.e. Not 'sleeping'.
     *
     * @returns {boolean} True if the body is active.
     */
    isActive() {
        return this._body ? this._body.isActive() : false;
    }

    /**
     * Forcibly activate the rigid body simulation. Only affects rigid bodies of type
     * {@link BODYTYPE_DYNAMIC}.
     */
    activate() {
        if (this._body) {
            this._body.activate();
        }
    }

    /**
     * Add a body to the simulation.
     *
     * @ignore
     */
    enableSimulation() {
        const entity = this.entity;
        if (entity.collision && entity.collision.enabled && !this._simulationEnabled) {
            const body = this._body;
            if (body) {
                // addBody also applies the backend's per-type activation policy
                this.system.addBody(body, this._group, this._mask);

                switch (this._type) {
                    case BODYTYPE_DYNAMIC:
                        this.system._dynamic.push(this);
                        this.syncEntityToBody();
                        break;
                    case BODYTYPE_KINEMATIC:
                        this.system._kinematic.push(this);
                        break;
                    case BODYTYPE_STATIC:
                        this.syncEntityToBody();
                        break;
                }

                if (entity.collision.type === 'compound') {
                    this.system._compounds.push(entity.collision);
                }

                body.activate();

                this._simulationEnabled = true;

                // internal event consumed by the joint system to (re)create constraints
                // against bodies that are present in the dynamics world
                this.fire('simulationenabled');
            }
        }
    }

    /**
     * Remove a body from the simulation.
     *
     * @ignore
     */
    disableSimulation() {
        const body = this._body;
        if (body && this._simulationEnabled) {
            const system = this.system;

            let idx = system._compounds.indexOf(this.entity.collision);
            if (idx > -1) {
                system._compounds.splice(idx, 1);
            }

            idx = system._dynamic.indexOf(this);
            if (idx > -1) {
                system._dynamic.splice(idx, 1);
            }

            idx = system._kinematic.indexOf(this);
            if (idx > -1) {
                system._kinematic.splice(idx, 1);
            }

            // removeBody also drops the body out of the active state so isActive() does not
            // return true even though it is no longer in the dynamics world
            system.removeBody(body);

            this._simulationEnabled = false;

            // internal event consumed by the joint system to destroy constraints that reference
            // this body. The body has just been removed from the dynamics world above and is now
            // inert, but is still a valid object - tearing the constraints down here keeps them
            // from referencing the body once it is later destroyed or rebuilt.
            this.fire('simulationdisabled');
        }
    }

    /**
     * Apply a force to the body at a point. By default, the force is applied at the origin of the
     * body. However, the force can be applied at an offset from this point by specifying a world
     * space vector from the body's origin to the point of application.
     *
     * @overload
     * @param {number} x - X-component of the force in world space.
     * @param {number} y - Y-component of the force in world space.
     * @param {number} z - Z-component of the force in world space.
     * @param {number} [px] - X-component of the relative point at which to apply the force in
     * world space.
     * @param {number} [py] - Y-component of the relative point at which to apply the force in
     * world space.
     * @param {number} [pz] - Z-component of the relative point at which to apply the force in
     * world space.
     * @returns {void}
     * @example
     * // Apply an approximation of gravity at the body's center
     * this.entity.rigidbody.applyForce(0, -10, 0);
     * @example
     * // Apply an approximation of gravity at 1 unit down the world Z from the center of the body
     * this.entity.rigidbody.applyForce(0, -10, 0, 0, 0, 1);
     */
    /**
     * Apply a force to the body at a point. By default, the force is applied at the origin of the
     * body. However, the force can be applied at an offset from this point by specifying a world
     * space vector from the body's origin to the point of application.
     *
     * @overload
     * @param {Vec3} force - Vector representing the force in world space.
     * @param {Vec3} [relativePoint] - Optional vector representing the relative point at which to
     * apply the force in world space.
     * @returns {void}
     * @example
     * // Calculate a force vector pointing in the world space direction of the entity
     * const force = this.entity.forward.clone().mulScalar(100);
     *
     * // Apply the force at the body's center
     * this.entity.rigidbody.applyForce(force);
     * @example
     * // Apply a force at some relative offset from the body's center
     * // Calculate a force vector pointing in the world space direction of the entity
     * const force = this.entity.forward.clone().mulScalar(100);
     *
     * // Calculate the world space relative offset
     * const relativePoint = new pc.Vec3();
     * const childEntity = this.entity.findByName('Engine');
     * relativePoint.sub2(childEntity.getPosition(), this.entity.getPosition());
     *
     * // Apply the force
     * this.entity.rigidbody.applyForce(force, relativePoint);
     */
    /**
     * @param {number|Vec3} x - X-component of the force in world space or a vector representing
     * the force in world space.
     * @param {number|Vec3} [y] - Y-component of the force in world space or a vector representing
     * the force in world space.
     * @param {number} [z] - Z-component of the force in world space.
     * @param {number} [px] - X-component of the relative point at which to apply the force in
     * world space.
     * @param {number} [py] - Y-component of the relative point at which to apply the force in
     * world space.
     * @param {number} [pz] - Z-component of the relative point at which to apply the force in
     * world space.
     */
    applyForce(x, y, z, px, py, pz) {
        const body = this._body;
        if (body) {
            body.activate();

            if (x instanceof Vec3) {
                _vecA.copy(x);
            } else {
                _vecA.set(x, y, z);
            }

            if (y instanceof Vec3) {
                _vecB.copy(y);
            } else if (px !== undefined) {
                _vecB.set(px, py, pz);
            } else {
                _vecB.set(0, 0, 0);
            }

            body.applyForce(_vecA, _vecB);
        }
    }

    /**
     * Apply torque (rotational force) to the body.
     *
     * @overload
     * @param {number} x - The x-component of the torque force in world space.
     * @param {number} y - The y-component of the torque force in world space.
     * @param {number} z - The z-component of the torque force in world space.
     * @returns {void}
     * @example
     * entity.rigidbody.applyTorque(0, 10, 0);
     */
    /**
     * Apply torque (rotational force) to the body.
     *
     * @overload
     * @param {Vec3} torque - Vector representing the torque force in world space.
     * @returns {void}
     * @example
     * const torque = new pc.Vec3(0, 10, 0);
     * entity.rigidbody.applyTorque(torque);
     */
    /**
     * @param {number|Vec3} x - X-component of the torque force in world space or a vector
     * representing the torque force in world space.
     * @param {number} [y] - Y-component of the torque force in world space.
     * @param {number} [z] - Z-component of the torque force in world space.
     */
    applyTorque(x, y, z) {
        const body = this._body;
        if (body) {
            body.activate();

            if (x instanceof Vec3) {
                _vecA.copy(x);
            } else {
                _vecA.set(x, y, z);
            }
            body.applyTorque(_vecA);
        }
    }

    /**
     * Apply an impulse (instantaneous change of velocity) to the body at a point.
     *
     * @overload
     * @param {number} x - X-component of the impulse in world space.
     * @param {number} y - Y-component of the impulse in world space.
     * @param {number} z - Z-component of the impulse in world space.
     * @param {number} [px] - X-component of the point at which to apply the impulse in the local
     * space of the entity.
     * @param {number} [py] - Y-component of the point at which to apply the impulse in the local
     * space of the entity.
     * @param {number} [pz] - Z-component of the point at which to apply the impulse in the local
     * space of the entity.
     * @returns {void}
     * @example
     * // Apply an impulse along the world space positive y-axis at the entity's position.
     * entity.rigidbody.applyImpulse(0, 10, 0);
     * @example
     * // Apply an impulse along the world space positive y-axis at 1 unit down the positive
     * // z-axis of the entity's local space.
     * entity.rigidbody.applyImpulse(0, 10, 0, 0, 0, 1);
     */
    /**
     * Apply an impulse (instantaneous change of velocity) to the body at a point.
     *
     * @overload
     * @param {Vec3} impulse - Vector representing the impulse in world space.
     * @param {Vec3} [relativePoint] - Optional vector representing the relative point at which to
     * apply the impulse in the local space of the entity.
     * @returns {void}
     * @example
     * // Apply an impulse along the world space positive y-axis at the entity's position.
     * const impulse = new pc.Vec3(0, 10, 0);
     * entity.rigidbody.applyImpulse(impulse);
     * @example
     * // Apply an impulse along the world space positive y-axis at 1 unit down the positive
     * // z-axis of the entity's local space.
     * const impulse = new pc.Vec3(0, 10, 0);
     * const relativePoint = new pc.Vec3(0, 0, 1);
     * entity.rigidbody.applyImpulse(impulse, relativePoint);
     */
    /**
     * @param {number|Vec3} x - X-component of the impulse in world space or a vector representing
     * the impulse in world space.
     * @param {number|Vec3} [y] - Y-component of the impulse in world space or a vector representing
     * the relative point at which to apply the impulse in the local space of the entity.
     * @param {number} [z] - Z-component of the impulse in world space.
     * @param {number} [px] - X-component of the point at which to apply the impulse in the local
     * space of the entity.
     * @param {number} [py] - Y-component of the point at which to apply the impulse in the local
     * space of the entity.
     * @param {number} [pz] - Z-component of the point at which to apply the impulse in the local
     * space of the entity.
     */
    applyImpulse(x, y, z, px, py, pz) {
        const body = this._body;
        if (body) {
            body.activate();

            if (x instanceof Vec3) {
                _vecA.copy(x);
            } else {
                _vecA.set(x, y, z);
            }

            if (y instanceof Vec3) {
                _vecB.copy(y);
            } else if (px !== undefined) {
                _vecB.set(px, py, pz);
            } else {
                _vecB.set(0, 0, 0);
            }

            body.applyImpulse(_vecA, _vecB);
        }
    }

    /**
     * Apply a torque impulse (rotational force applied instantaneously) to the body.
     *
     * @overload
     * @param {number} x - X-component of the torque impulse in world space.
     * @param {number} y - Y-component of the torque impulse in world space.
     * @param {number} z - Z-component of the torque impulse in world space.
     * @returns {void}
     * @example
     * entity.rigidbody.applyTorqueImpulse(0, 10, 0);
     */
    /**
     * Apply a torque impulse (rotational force applied instantaneously) to the body.
     *
     * @overload
     * @param {Vec3} torque - Vector representing the torque impulse in world space.
     * @returns {void}
     * @example
     * const torque = new pc.Vec3(0, 10, 0);
     * entity.rigidbody.applyTorqueImpulse(torque);
     */
    /**
     * @param {number|Vec3} x - X-component of the torque impulse in world space or a vector
     * representing the torque impulse in world space.
     * @param {number} [y] - Y-component of the torque impulse in world space.
     * @param {number} [z] - Z-component of the torque impulse in world space.
     */
    applyTorqueImpulse(x, y, z) {
        const body = this._body;
        if (body) {
            body.activate();

            if (x instanceof Vec3) {
                _vecA.copy(x);
            } else {
                _vecA.set(x, y, z);
            }

            body.applyTorqueImpulse(_vecA);
        }
    }

    /**
     * Returns true if the rigid body is of type {@link BODYTYPE_STATIC}.
     *
     * @returns {boolean} True if static.
     */
    isStatic() {
        return (this._type === BODYTYPE_STATIC);
    }

    /**
     * Returns true if the rigid body is of type {@link BODYTYPE_STATIC} or {@link BODYTYPE_KINEMATIC}.
     *
     * @returns {boolean} True if static or kinematic.
     */
    isStaticOrKinematic() {
        return (this._type === BODYTYPE_STATIC || this._type === BODYTYPE_KINEMATIC);
    }

    /**
     * Returns true if the rigid body is of type {@link BODYTYPE_KINEMATIC}.
     *
     * @returns {boolean} True if kinematic.
     */
    isKinematic() {
        return (this._type === BODYTYPE_KINEMATIC);
    }

    /**
     * Reads the entity transform (with any collision component offsets applied) but ignoring
     * scale.
     *
     * @param {Vec3} position - The vector to write the world space position to.
     * @param {Quat} rotation - The quaternion to write the world space rotation to.
     * @private
     */
    _getEntityTransform(position, rotation) {
        const entity = this.entity;

        const component = entity.collision;
        if (component) {
            position.copy(component.getShapePosition());
            rotation.copy(component.getShapeRotation());
        } else {
            position.copy(entity.getPosition());
            rotation.copy(entity.getRotation());
        }
    }

    /**
     * Set the rigid body transform to be the same as the Entity transform. This must be called
     * after any Entity transformation functions (e.g. {@link Entity#setPosition}) are called in
     * order to update the rigid body to match the Entity.
     *
     * @private
     */
    syncEntityToBody() {
        const body = this._body;
        if (body) {
            this._getEntityTransform(_position, _rotation);
            body.setTransform(_position, _rotation);
        }
    }

    /**
     * Sets an entity's transform to match that of the world transformation matrix of a dynamic
     * rigid body's motion state.
     *
     * @private
     */
    _updateDynamic() {
        const body = this._body;

        // If a dynamic body is frozen, we can assume its simulated transform is the same as
        // the entity world transform
        if (body.isActive()) {
            const entity = this.entity;

            body.getTransform(_position, _rotation);

            const component = entity.collision;
            if (component && component._hasOffset) {
                const lo = component.linearOffset;
                const ao = component.angularOffset;

                // Un-rotate the angular offset and then use the new rotation to
                // un-translate the linear offset in local space
                // Order of operations matter here
                const invertedAo = _quat2.copy(ao).invert();
                const entityRot = _quat1.copy(_rotation).mul(invertedAo);

                entityRot.transformVector(lo, _vec3);
                entity.setPositionAndRotation(_position.sub(_vec3), entityRot);
            } else {
                entity.setPositionAndRotation(_position, _rotation);
            }
        }
    }

    /**
     * Writes the entity's world transform into the kinematic target of a kinematic body.
     *
     * @private
     */
    _updateKinematic() {
        this._getEntityTransform(_position, _rotation);
        this._body.setKinematicTarget(_position, _rotation);
    }

    /**
     * Teleport an entity to a new world space position, optionally setting orientation. This
     * function should only be called for rigid bodies that are dynamic.
     *
     * @overload
     * @param {number} x - X-coordinate of the new world space position.
     * @param {number} y - Y-coordinate of the new world space position.
     * @param {number} z - Z-coordinate of the new world space position.
     * @param {number} [rx] - X-rotation of the world space Euler angles in degrees.
     * @param {number} [ry] - Y-rotation of the world space Euler angles in degrees.
     * @param {number} [rz] - Z-rotation of the world space Euler angles in degrees.
     * @returns {void}
     * @example
     * // Teleport the entity to the origin
     * entity.rigidbody.teleport(0, 0, 0);
     * @example
     * // Teleport the entity to world space coordinate [1, 2, 3] and reset orientation
     * entity.rigidbody.teleport(1, 2, 3, 0, 0, 0);
     */
    /**
     * Teleport an entity to a new world space position, optionally setting orientation. This
     * function should only be called for rigid bodies that are dynamic.
     *
     * @overload
     * @param {Vec3} position - Vector holding the new world space position.
     * @param {Vec3} [angles] - Vector holding the new world space Euler angles in degrees.
     * @returns {void}
     * @example
     * // Teleport the entity to the origin
     * entity.rigidbody.teleport(pc.Vec3.ZERO);
     * @example
     * // Teleport the entity to world space coordinate [1, 2, 3] and reset orientation
     * const position = new pc.Vec3(1, 2, 3);
     * entity.rigidbody.teleport(position, pc.Vec3.ZERO);
     */
    /**
     * Teleport an entity to a new world space position, optionally setting orientation. This
     * function should only be called for rigid bodies that are dynamic.
     *
     * @overload
     * @param {Vec3} position - Vector holding the new world space position.
     * @param {Quat} [rotation] - Quaternion holding the new world space rotation.
     * @returns {void}
     * @example
     * // Teleport the entity to the origin
     * entity.rigidbody.teleport(pc.Vec3.ZERO);
     * @example
     * // Teleport the entity to world space coordinate [1, 2, 3] and reset orientation
     * const position = new pc.Vec3(1, 2, 3);
     * entity.rigidbody.teleport(position, pc.Quat.IDENTITY);
     */
    /**
     * @param {number|Vec3} x - X-coordinate of the new world space position or a vector holding
     * the new world space position.
     * @param {number|Quat|Vec3} [y] - Y-coordinate of the new world space position or a
     * quaternion holding the new world space rotation or a vector holding the new world space
     * Euler angles in degrees.
     * @param {number} [z] - Z-coordinate of the new world space position.
     * @param {number} [rx] - X-rotation of the new world space Euler angles in degrees.
     * @param {number} [ry] - Y-rotation of the new world space Euler angles in degrees.
     * @param {number} [rz] - Z-rotation of the new world space Euler angles in degrees.
     */
    teleport(x, y, z, rx, ry, rz) {
        if (x instanceof Vec3) {
            this.entity.setPosition(x);
        } else {
            this.entity.setPosition(x, y, z);
        }

        if (y instanceof Quat) {
            this.entity.setRotation(y);
        } else if (y instanceof Vec3) {
            this.entity.setEulerAngles(y);
        } else if (rx !== undefined) {
            this.entity.setEulerAngles(rx, ry, rz);
        }

        this.syncEntityToBody();
    }

    /** @ignore */
    onEnable() {
        if (!this._body) {
            this.createBody();
        }

        this.enableSimulation();
    }

    /** @ignore */
    onDisable() {
        this.disableSimulation();
    }
}

export { RigidBodyComponent };
