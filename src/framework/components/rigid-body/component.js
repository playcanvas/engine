import { Quat } from '../../../math/quat.js';
import { Vec3 } from '../../../math/vec3.js';

import {
    BODYFLAG_KINEMATIC_OBJECT, BODYTYPE_STATIC,
    BODYGROUP_DYNAMIC, BODYGROUP_KINEMATIC, BODYGROUP_STATIC,
    BODYMASK_ALL, BODYMASK_NOT_STATIC,
    BODYSTATE_ACTIVE_TAG, BODYSTATE_DISABLE_DEACTIVATION, BODYSTATE_DISABLE_SIMULATION,
    BODYTYPE_DYNAMIC, BODYTYPE_KINEMATIC
} from './constants.js';
import { Component } from '../component.js';

// Shared math variable to avoid excessive allocation
var ammoTransform;
var ammoVec1, ammoVec2, ammoQuat, ammoOrigin;

/**
 * @component
 * @class
 * @name RigidBodyComponent
 * @augments Component
 * @classdesc The rigidbody component, when combined with a {@link CollisionComponent}, allows your
 * entities to be simulated using realistic physics. A rigidbody component will fall under gravity and
 * collide with other rigid bodies. Using scripts, you can apply forces and impulses to rigid bodies.
 *
 * You should never need to use the RigidBodyComponent constructor. To add an RigidBodyComponent to a
 * {@link Entity}, use {@link Entity#addComponent}:
 *
 * ~~~javascript
 * // Create a static 1x1x1 box-shaped rigid body
 * const entity = pc.Entity();
 * entity.addComponent("rigidbody"); // With no options specified, this defaults to a 'static' body
 * entity.addComponent("collision"); // With no options specified, this defaults to a 1x1x1 box shape
 * ~~~
 *
 * To create a dynamic sphere with mass of 10, do:
 *
 * ~~~javascript
 * const entity = pc.Entity();
 * entity.addComponent("rigidbody", {
 *     type: pc.BODYTYPE_DYNAMIC,
 *     mass: 10
 * });
 * entity.addComponent("collision", {
 *     type: "sphere"
 * });
 * ~~~
 *
 * Relevant 'Engine-only' examples:
 * * [Falling shapes](http://playcanvas.github.io/#physics/falling-shapes.html)
 * * [Vehicle physics](http://playcanvas.github.io/#physics/vehicle.html)
 *
 * @description Create a new RigidBodyComponent.
 * @param {RigidBodyComponentSystem} system - The ComponentSystem that created this component.
 * @param {Entity} entity - The entity this component is attached to.
 * @property {number} mass The mass of the body. This is only relevant for {@link BODYTYPE_DYNAMIC}
 * bodies, other types have infinite mass. Defaults to 1.
 * @property {Vec3} linearVelocity Defines the speed of the body in a given direction.
 * @property {Vec3} angularVelocity Defines the rotational speed of the body around each world axis.
 * @property {number} linearDamping Controls the rate at which a body loses linear velocity over time.
 * Defaults to 0.
 * @property {number} angularDamping Controls the rate at which a body loses angular velocity over time.
 * Defaults to 0.
 * @property {Vec3} linearFactor Scaling factor for linear movement of the body in each axis. Only
 * valid for rigid bodies of type {@link BODYTYPE_DYNAMIC}. Defaults to 1 in all axes (body can freely
 * move).
 * @property {Vec3} angularFactor Scaling factor for angular movement of the body in each axis. Only
 * valid for rigid bodies of type {@link BODYTYPE_DYNAMIC}. Defaults to 1 in all axes (body can freely
 * rotate).
 * @property {number} friction The friction value used when contacts occur between two bodies. A higher
 * value indicates more friction. Should be set in the range 0 to 1. Defaults to 0.5.
 * @property {number} rollingFriction Sets a torsional friction orthogonal to the contact point. Defaults
 * to 0.
 * @property {number} restitution Influences the amount of energy lost when two rigid bodies collide. The
 * calculation multiplies the restitution values for both colliding bodies. A multiplied value of 0 means
 * that all energy is lost in the collision while a value of 1 means that no energy is lost. Should be
 * set in the range 0 to 1. Defaults to 0.
 * @property {number} group The collision group this body belongs to. Combine the group and the mask to
 * prevent bodies colliding with each other. Defaults to 1.
 * @property {number} mask The collision mask sets which groups this body collides with. It is a bitfield
 * of 16 bits, the first 8 bits are reserved for engine use. Defaults to 65535.
 * @property {string} type The rigid body type determines how the body is simulated. Can be:
 *
 * * {@link BODYTYPE_STATIC}: infinite mass and cannot move.
 * * {@link BODYTYPE_DYNAMIC}: simulated according to applied forces.
 * * {@link BODYTYPE_KINEMATIC}: infinite mass and does not respond to forces (can only be moved
 * by setting the position and rotation of component's {@link Entity}).
 *
 * Defaults to {@link BODYTYPE_STATIC}.
 */
class RigidBodyComponent extends Component {
    constructor(system, entity) {
        super(system, entity);

        // Lazily create shared variable
        if (typeof Ammo !== 'undefined' && !ammoTransform) {
            ammoTransform = new Ammo.btTransform();
            ammoVec1 = new Ammo.btVector3();
            ammoVec2 = new Ammo.btVector3();
            ammoQuat = new Ammo.btQuaternion();
            ammoOrigin = new Ammo.btVector3(0, 0, 0);
        }

        this._angularDamping = 0;
        this._angularFactor = new Vec3(1, 1, 1);
        this._angularVelocity = new Vec3();
        this._body = null;
        this._friction = 0.5;
        this._group = BODYGROUP_STATIC;
        this._linearDamping = 0;
        this._linearFactor = new Vec3(1, 1, 1);
        this._linearVelocity = new Vec3();
        this._mask = BODYMASK_NOT_STATIC;
        this._mass = 1;
        this._restitution = 0;
        this._rollingFriction = 0;
        this._simulationEnabled = false;
        this._type = BODYTYPE_STATIC;
    }

    get angularDamping() {
        return this._angularDamping;
    }

    set angularDamping(damping) {
        if (this._angularDamping !== damping) {
            this._angularDamping = damping;

            if (this._body) {
                this._body.setDamping(this._linearDamping, damping);
            }
        }
    }

    get angularFactor() {
        return this._angularFactor;
    }

    set angularFactor(factor) {
        if (!this._angularFactor.equals(factor)) {
            this._angularFactor.copy(factor);

            if (this._body && this._type === BODYTYPE_DYNAMIC) {
                ammoVec1.setValue(factor.x, factor.y, factor.z);
                this._body.setAngularFactor(ammoVec1);
            }
        }
    }

    get angularVelocity() {
        if (this._body && this._type === BODYTYPE_DYNAMIC) {
            const velocity = this._body.getAngularVelocity();
            this._angularVelocity.set(velocity.x(), velocity.y(), velocity.z());
        }
        return this._angularVelocity;
    }

    set angularVelocity(velocity) {
        if (this._body && this._type === BODYTYPE_DYNAMIC) {
            this._body.activate();

            ammoVec1.setValue(velocity.x, velocity.y, velocity.z);
            this._body.setAngularVelocity(ammoVec1);

            this._angularVelocity.copy(velocity);
        }
    }

    get body() {
        return this._body;
    }

    set body(body) {
        if (this._body !== body) {
            this._body = body;

            if (body && this._simulationEnabled) {
                body.activate();
            }
        }
    }

    get friction() {
        return this._friction;
    }

    set friction(friction) {
        if (this._friction !== friction) {
            this._friction = friction;

            if (this._body) {
                this._body.setFriction(friction);
            }
        }
    }

    get group() {
        return this._group;
    }

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

    get linearDamping() {
        return this._linearDamping;
    }

    set linearDamping(damping) {
        if (this._linearDamping !== damping) {
            this._linearDamping = damping;

            if (this._body) {
                this._body.setDamping(damping, this._angularDamping);
            }
        }
    }

    get linearFactor() {
        return this._linearFactor;
    }

    set linearFactor(factor) {
        if (!this._linearFactor.equals(factor)) {
            this._linearFactor.copy(factor);

            if (this._body && this._type === BODYTYPE_DYNAMIC) {
                ammoVec1.setValue(factor.x, factor.y, factor.z);
                this._body.setLinearFactor(ammoVec1);
            }
        }
    }

    get linearVelocity() {
        if (this._body && this._type === BODYTYPE_DYNAMIC) {
            const velocity = this._body.getLinearVelocity();
            this._linearVelocity.set(velocity.x(), velocity.y(), velocity.z());
        }
        return this._linearVelocity;
    }

    set linearVelocity(velocity) {
        if (this._body && this._type === BODYTYPE_DYNAMIC) {
            this._body.activate();

            ammoVec1.setValue(velocity.x, velocity.y, velocity.z);
            this._body.setLinearVelocity(ammoVec1);

            this._linearVelocity.copy(velocity);
        }
    }

    get mask() {
        return this._mask;
    }

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

    get mass() {
        return this._mass;
    }

    set mass(mass) {
        if (this._mass !== mass) {
            this._mass = mass;

            if (this._body && this._type === BODYTYPE_DYNAMIC) {
                const enabled = this.enabled && this.entity.enabled;
                if (enabled) {
                    this.disableSimulation();
                }

                // calculateLocalInertia writes local inertia to ammoVec1 here...
                this._body.getCollisionShape().calculateLocalInertia(mass, ammoVec1);
                // ...and then writes the calculated local inertia to the body
                this._body.setMassProps(mass, ammoVec1);
                this._body.updateInertiaTensor();

                if (enabled) {
                    this.enableSimulation();
                }
            }
        }
    }

    get restitution() {
        return this._restitution;
    }

    set restitution(restitution) {
        if (this._restitution !== restitution) {
            this._restitution = restitution;

            if (this._body) {
                this._body.setRestitution(restitution);
            }
        }
    }

    get rollingFriction() {
        return this._rollingFriction;
    }

    set rollingFriction(friction) {
        if (this._rollingFriction !== friction) {
            this._rollingFriction = friction;

            if (this._body) {
                this._body.setRollingFriction(friction);
            }
        }
    }

    get type() {
        return this._type;
    }

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
     * @private
     * @function
     * @name RigidBodyComponent#createBody
     * @description If the Entity has a Collision shape attached then create a rigid body using this shape. This method destroys the existing body.
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

        if (shape) {
            if (this._body)
                this.system.onRemove(entity, this);

            const mass = this._type === BODYTYPE_DYNAMIC ? this._mass : 0;

            this._getEntityTransform(ammoTransform);

            const body = this.system.createBody(mass, shape, ammoTransform);

            body.setRestitution(this._restitution);
            body.setFriction(this._friction);
            body.setRollingFriction(this._rollingFriction);
            body.setDamping(this._linearDamping, this._angularDamping);

            if (this._type === BODYTYPE_DYNAMIC) {
                const linearFactor = this._linearFactor;
                ammoVec1.setValue(linearFactor.x, linearFactor.y, linearFactor.z);
                body.setLinearFactor(ammoVec1);

                const angularFactor = this._angularFactor;
                ammoVec1.setValue(angularFactor.x, angularFactor.y, angularFactor.z);
                body.setAngularFactor(ammoVec1);
            } else if (this._type === BODYTYPE_KINEMATIC) {
                body.setCollisionFlags(body.getCollisionFlags() | BODYFLAG_KINEMATIC_OBJECT);
                body.setActivationState(BODYSTATE_DISABLE_DEACTIVATION);
            }

            body.entity = entity;

            this.body = body;

            if (this.enabled && entity.enabled) {
                this.enableSimulation();
            }
        }
    }

    /**
     * @function
     * @name RigidBodyComponent#isActive
     * @description Returns true if the rigid body is currently actively being simulated. I.e. Not 'sleeping'.
     * @returns {boolean} True if the body is active.
     */
    isActive() {
        return this._body ? this._body.isActive() : false;
    }

    /**
     * @function
     * @name RigidBodyComponent#activate
     * @description Forcibly activate the rigid body simulation. Only affects rigid bodies of
     * type {@link BODYTYPE_DYNAMIC}.
     */
    activate() {
        if (this._body) {
            this._body.activate();
        }
    }

    enableSimulation() {
        const entity = this.entity;
        if (entity.collision && entity.collision.enabled && !this._simulationEnabled) {
            const body = this._body;
            if (body) {
                this.system.addBody(body, this._group, this._mask);

                switch (this._type) {
                    case BODYTYPE_DYNAMIC:
                        this.system._dynamic.push(this);
                        body.forceActivationState(BODYSTATE_ACTIVE_TAG);
                        this.syncEntityToBody();
                        break;
                    case BODYTYPE_KINEMATIC:
                        this.system._kinematic.push(this);
                        body.forceActivationState(BODYSTATE_DISABLE_DEACTIVATION);
                        break;
                    case BODYTYPE_STATIC:
                        body.forceActivationState(BODYSTATE_ACTIVE_TAG);
                        this.syncEntityToBody();
                        break;
                }

                if (entity.collision.type === 'compound') {
                    this.system._compounds.push(entity.collision);
                }

                body.activate();

                this._simulationEnabled = true;
            }
        }
    }

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

            system.removeBody(body);

            // set activation state to disable simulation to avoid body.isActive() to return
            // true even if it's not in the dynamics world
            body.forceActivationState(BODYSTATE_DISABLE_SIMULATION);

            this._simulationEnabled = false;
        }
    }

    /**
     * @function
     * @name RigidBodyComponent#applyForce
     * @description Apply an force to the body at a point. By default, the force is applied at the origin of the
     * body. However, the force can be applied at an offset this point by specifying a world space vector from
     * the body's origin to the point of application. This function has two valid signatures. You can either
     * specify the force (and optional relative point) via 3D-vector or numbers.
     * @param {Vec3|number} x - A 3-dimensional vector representing the force in world-space or
     * the x-component of the force in world-space.
     * @param {Vec3|number} [y] - An optional 3-dimensional vector representing the relative point at
     * which to apply the impulse in world-space or the y-component of the force in world-space.
     * @param {number} [z] - The z-component of the force in world-space.
     * @param {number} [px] - The x-component of a world-space offset from the body's position where the force is applied.
     * @param {number} [py] - The y-component of a world-space offset from the body's position where the force is applied.
     * @param {number} [pz] - The z-component of a world-space offset from the body's position where the force is applied.
     * @example
     * // Apply an approximation of gravity at the body's center
     * this.entity.rigidbody.applyForce(0, -10, 0);
     * @example
     * // Apply an approximation of gravity at 1 unit down the world Z from the center of the body
     * this.entity.rigidbody.applyForce(0, -10, 0, 0, 0, 1);
     * @example
     * // Apply a force at the body's center
     * // Calculate a force vector pointing in the world space direction of the entity
     * var force = this.entity.forward.clone().mulScalar(100);
     *
     * // Apply the force
     * this.entity.rigidbody.applyForce(force);
     * @example
     * // Apply a force at some relative offset from the body's center
     * // Calculate a force vector pointing in the world space direction of the entity
     * var force = this.entity.forward.clone().mulScalar(100);
     *
     * // Calculate the world space relative offset
     * var relativePos = new pc.Vec3();
     * var childEntity = this.entity.findByName('Engine');
     * relativePos.sub2(childEntity.getPosition(), this.entity.getPosition());
     *
     * // Apply the force
     * this.entity.rigidbody.applyForce(force, relativePos);
     */
    applyForce() {
        let x, y, z;
        let px, py, pz;
        switch (arguments.length) {
            case 1:
                x = arguments[0].x;
                y = arguments[0].y;
                z = arguments[0].z;
                break;
            case 2:
                x = arguments[0].x;
                y = arguments[0].y;
                z = arguments[0].z;
                px = arguments[1].x;
                py = arguments[1].y;
                pz = arguments[1].z;
                break;
            case 3:
                x = arguments[0];
                y = arguments[1];
                z = arguments[2];
                break;
            case 6:
                x = arguments[0];
                y = arguments[1];
                z = arguments[2];
                px = arguments[3];
                py = arguments[4];
                pz = arguments[5];
                break;
        }
        const body = this._body;
        if (body) {
            body.activate();
            ammoVec1.setValue(x, y, z);
            if (px !== undefined) {
                ammoVec2.setValue(px, py, pz);
                body.applyForce(ammoVec1, ammoVec2);
            } else {
                body.applyForce(ammoVec1, ammoOrigin);
            }
        }
    }

    /**
     * @function
     * @name RigidBodyComponent#applyTorque
     * @description Apply torque (rotational force) to the body. This function has two valid signatures.
     * You can either specify the torque force with a 3D-vector or with 3 numbers.
     * @param {Vec3|number} x - A 3-dimensional vector representing the torque force in world-space or
     * the x-component of the torque force in world-space.
     * @param {number} [y] - The y-component of the torque force in world-space.
     * @param {number} [z] - The z-component of the torque force in world-space.
     * @example
     * // Apply via vector
     * var torque = new pc.Vec3(0, 10, 0);
     * entity.rigidbody.applyTorque(torque);
     * @example
     * // Apply via numbers
     * entity.rigidbody.applyTorque(0, 10, 0);
     */
    applyTorque() {
        let x, y, z;
        switch (arguments.length) {
            case 1:
                x = arguments[0].x;
                y = arguments[0].y;
                z = arguments[0].z;
                break;
            case 3:
                x = arguments[0];
                y = arguments[1];
                z = arguments[2];
                break;
            default:
                // #if _DEBUG
                console.error('ERROR: applyTorque: function takes 1 or 3 arguments');
                // #endif
                return;
        }
        const body = this._body;
        if (body) {
            body.activate();
            ammoVec1.setValue(x, y, z);
            body.applyTorque(ammoVec1);
        }
    }

    /**
     * @function
     * @name RigidBodyComponent#applyImpulse
     * @description Apply an impulse (instantaneous change of velocity) to the body at a point.
     * This function has two valid signatures. You can either specify the impulse (and optional relative
     * point) via 3D-vector or numbers.
     * @param {Vec3|number} x - A 3-dimensional vector representing the impulse in world-space or
     * the x-component of the impulse in world-space.
     * @param {Vec3|number} [y] - An optional 3-dimensional vector representing the relative point at
     * which to apply the impulse in the local-space of the entity or the y-component of the impulse to
     * apply in world-space.
     * @param {number} [z] - The z-component of the impulse to apply in world-space.
     * @param {number} [px=0] - The x-component of the point at which to apply the impulse in the local-space of the entity.
     * @param {number} [py=0] - The y-component of the point at which to apply the impulse in the local-space of the entity.
     * @param {number} [pz=0] - The z-component of the point at which to apply the impulse in the local-space of the entity.
     * @example
     * // Apply an impulse along the world-space positive y-axis at the entity's position.
     * var impulse = new pc.Vec3(0, 10, 0);
     * entity.rigidbody.applyImpulse(impulse);
     * @example
     * // Apply an impulse along the world-space positive y-axis at 1 unit down the positive
     * // z-axis of the entity's local-space.
     * var impulse = new pc.Vec3(0, 10, 0);
     * var relativePoint = new pc.Vec3(0, 0, 1);
     * entity.rigidbody.applyImpulse(impulse, relativePoint);
     * @example
     * // Apply an impulse along the world-space positive y-axis at the entity's position.
     * entity.rigidbody.applyImpulse(0, 10, 0);
     * @example
     * // Apply an impulse along the world-space positive y-axis at 1 unit down the positive
     * // z-axis of the entity's local-space.
     * entity.rigidbody.applyImpulse(0, 10, 0, 0, 0, 1);
     */
    applyImpulse() {
        let x, y, z;
        let px, py, pz;
        switch (arguments.length) {
            case 1:
                x = arguments[0].x;
                y = arguments[0].y;
                z = arguments[0].z;
                break;
            case 2:
                x = arguments[0].x;
                y = arguments[0].y;
                z = arguments[0].z;
                px = arguments[1].x;
                py = arguments[1].y;
                pz = arguments[1].z;
                break;
            case 3:
                x = arguments[0];
                y = arguments[1];
                z = arguments[2];
                break;
            case 6:
                x = arguments[0];
                y = arguments[1];
                z = arguments[2];
                px = arguments[3];
                py = arguments[4];
                pz = arguments[5];
                break;
            default:
                // #if _DEBUG
                console.error('ERROR: applyImpulse: function takes 1, 2, 3 or 6 arguments');
                // #endif
                return;
        }
        const body = this._body;
        if (body) {
            body.activate();
            ammoVec1.setValue(x, y, z);
            if (px !== undefined) {
                ammoVec2.setValue(px, py, pz);
                body.applyImpulse(ammoVec1, ammoVec2);
            } else {
                body.applyImpulse(ammoVec1, ammoOrigin);
            }
        }
    }

    /**
     * @function
     * @name RigidBodyComponent#applyTorqueImpulse
     * @description Apply a torque impulse (rotational force applied instantaneously) to the body.
     * This function has two valid signatures. You can either specify the torque force with a 3D-vector
     * or with 3 numbers.
     * @param {Vec3|number} x - A 3-dimensional vector representing the torque impulse in world-space or
     * the x-component of the torque impulse in world-space.
     * @param {number} [y] - The y-component of the torque impulse in world-space.
     * @param {number} [z] - The z-component of the torque impulse in world-space.
     * @example
     * // Apply via vector
     * var torque = new pc.Vec3(0, 10, 0);
     * entity.rigidbody.applyTorqueImpulse(torque);
     * @example
     * // Apply via numbers
     * entity.rigidbody.applyTorqueImpulse(0, 10, 0);
     */
    applyTorqueImpulse() {
        let x, y, z;
        switch (arguments.length) {
            case 1:
                x = arguments[0].x;
                y = arguments[0].y;
                z = arguments[0].z;
                break;
            case 3:
                x = arguments[0];
                y = arguments[1];
                z = arguments[2];
                break;
            default:
                // #if _DEBUG
                console.error('ERROR: applyTorqueImpulse: function takes 1 or 3 arguments');
                // #endif
                return;
        }
        const body = this._body;
        if (body) {
            body.activate();
            ammoVec1.setValue(x, y, z);
            body.applyTorqueImpulse(ammoVec1);
        }
    }

    /**
     * @function
     * @name RigidBodyComponent#isStatic
     * @description Returns true if the rigid body is of type {@link BODYTYPE_STATIC}.
     * @returns {boolean} True if static.
     */
    isStatic() {
        return (this._type === BODYTYPE_STATIC);
    }

    /**
     * @function
     * @name RigidBodyComponent#isStaticOrKinematic
     * @description Returns true if the rigid body is of type {@link BODYTYPE_STATIC} or {@link BODYTYPE_KINEMATIC}.
     * @returns {boolean} True if static or kinematic.
     */
    isStaticOrKinematic() {
        return (this._type === BODYTYPE_STATIC || this._type === BODYTYPE_KINEMATIC);
    }

    /**
     * @function
     * @name RigidBodyComponent#isKinematic
     * @description Returns true if the rigid body is of type {@link BODYTYPE_KINEMATIC}.
     * @returns {boolean} True if kinematic.
     */
    isKinematic() {
        return (this._type === BODYTYPE_KINEMATIC);
    }

    /**
     * @private
     * @function
     * @name RigidBodyComponent#_getEntityTransform
     * @description Writes an entity transform into an Ammo.btTransform but ignoring scale.
     * @param {object} transform - The ammo transform to write the entity transform to.
     */
    _getEntityTransform(transform) {
        const entity = this.entity;
        const pos = entity.getPosition();
        const rot = entity.getRotation();

        ammoVec1.setValue(pos.x, pos.y, pos.z);
        ammoQuat.setValue(rot.x, rot.y, rot.z, rot.w);

        transform.setOrigin(ammoVec1);
        transform.setRotation(ammoQuat);
    }

    /**
     * @private
     * @function
     * @name RigidBodyComponent#syncEntityToBody
     * @description Set the rigid body transform to be the same as the Entity transform.
     * This must be called after any Entity transformation functions (e.g. {@link Entity#setPosition}) are called
     * in order to update the rigid body to match the Entity.
     */
    syncEntityToBody() {
        const body = this._body;
        if (body) {
            this._getEntityTransform(ammoTransform);

            body.setWorldTransform(ammoTransform);

            if (this._type === BODYTYPE_KINEMATIC) {
                const motionState = body.getMotionState();
                if (motionState) {
                    motionState.setWorldTransform(ammoTransform);
                }
            }
            body.activate();
        }
    }

    /**
     * @private
     * @function
     * @name RigidBodyComponent#_updateDynamic
     * @description Sets an entity's transform to match that of the world transformation
     * matrix of a dynamic rigid body's motion state.
     */
    _updateDynamic() {
        const body = this._body;

        // If a dynamic body is frozen, we can assume its motion state transform is
        // the same is the entity world transform
        if (body.isActive()) {
            // Update the motion state. Note that the test for the presence of the motion
            // state is technically redundant since the engine creates one for all bodies.
            const motionState = body.getMotionState();
            if (motionState) {
                motionState.getWorldTransform(ammoTransform);

                const p = ammoTransform.getOrigin();
                const q = ammoTransform.getRotation();
                this.entity.setPosition(p.x(), p.y(), p.z());
                this.entity.setRotation(q.x(), q.y(), q.z(), q.w());
            }
        }
    }

    /**
     * @private
     * @function
     * @name RigidBodyComponent#_updateKinematic
     * @description Writes the entity's world transformation matrix into the motion state
     * of a kinematic body.
     */
    _updateKinematic() {
        const motionState = this._body.getMotionState();
        if (motionState) {
            this._getEntityTransform(ammoTransform);
            motionState.setWorldTransform(ammoTransform);
        }
    }

    /**
     * @function
     * @name RigidBodyComponent#teleport
     * @description Teleport an entity to a new world-space position, optionally setting orientation. This function
     * should only be called for rigid bodies that are dynamic. This function has three valid signatures.
     * The first takes a 3-dimensional vector for the position and an optional 3-dimensional vector for Euler rotation.
     * The second takes a 3-dimensional vector for the position and an optional quaternion for rotation.
     * The third takes 3 numbers for the position and an optional 3 numbers for Euler rotation.
     * @param {Vec3|number} x - A 3-dimensional vector holding the new position or the new position x-coordinate.
     * @param {Vec3|Quat|number} y - A 3-dimensional vector or quaternion holding the new rotation or the new
     * position y-coordinate.
     * @param {number} [z] - The new position z-coordinate.
     * @param {number} [rx] - The new Euler x-angle value.
     * @param {number} [ry] - The new Euler y-angle value.
     * @param {number} [rz] - The new Euler z-angle value.
     * @example
     * // Teleport the entity to the origin
     * entity.rigidbody.teleport(pc.Vec3.ZERO);
     * @example
     * // Teleport the entity to the origin
     * entity.rigidbody.teleport(0, 0, 0);
     * @example
     * // Teleport the entity to world-space coordinate [1, 2, 3] and reset orientation
     * var position = new pc.Vec3(1, 2, 3);
     * entity.rigidbody.teleport(position, pc.Vec3.ZERO);
     * @example
     * // Teleport the entity to world-space coordinate [1, 2, 3] and reset orientation
     * entity.rigidbody.teleport(1, 2, 3, 0, 0, 0);
     */
    teleport() {
        if (arguments.length < 3) {
            if (arguments[0]) {
                this.entity.setPosition(arguments[0]);
            }
            if (arguments[1]) {
                if (arguments[1] instanceof Quat) {
                    this.entity.setRotation(arguments[1]);
                } else {
                    this.entity.setEulerAngles(arguments[1]);
                }

            }
        } else {
            if (arguments.length === 6) {
                this.entity.setEulerAngles(arguments[3], arguments[4], arguments[5]);
            }
            this.entity.setPosition(arguments[0], arguments[1], arguments[2]);
        }
        this.syncEntityToBody();
    }

    onEnable() {
        if (!this._body) {
            this.createBody();
        }

        this.enableSimulation();
    }

    onDisable() {
        this.disableSimulation();
    }
}

// Events Documentation
/**
 * @event
 * @name RigidBodyComponent#contact
 * @description The 'contact' event is fired when a contact occurs between two rigid bodies.
 * @param {ContactResult} result - Details of the contact between the two rigid bodies.
 */

/**
 * @event
 * @name RigidBodyComponent#collisionstart
 * @description The 'collisionstart' event is fired when two rigid bodies start touching.
 * @param {ContactResult} result - Details of the contact between the two rigid bodies.
 */

/**
 * @event
 * @name RigidBodyComponent#collisionend
 * @description The 'collisionend' event is fired two rigid-bodies stop touching.
 * @param {Entity} other - The {@link Entity} that stopped touching this rigid body.
 */

/**
 * @event
 * @name RigidBodyComponent#triggerenter
 * @description The 'triggerenter' event is fired when a rigid body enters a trigger volume.
 * @param {Entity} other - The {@link Entity} with trigger volume that this rigidbody entered.
 */

/**
 * @event
 * @name RigidBodyComponent#triggerleave
 * @description The 'triggerleave' event is fired when a rigid body exits a trigger volume.
 * @param {Entity} other - The {@link Entity} with trigger volume that this rigidbody exited.
 */

export { RigidBodyComponent };
