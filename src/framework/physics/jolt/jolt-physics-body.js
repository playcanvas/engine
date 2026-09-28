import { Debug } from '../../../core/debug.js';
import { Quat } from '../../../core/math/quat.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { PhysicsBody } from '../physics-body.js';
import { computeMassProperties } from './jolt-physics-shape.js';

/**
 * @import { JoltPhysicsWorld } from './jolt-physics-world.js'
 */

// The engine follows Bullet's damping, which scales a velocity by (1 - damping) every second.
// Jolt scales it by (1 - coefficient * dt) every step, so -ln(1 - damping) decays at the same
// rate. A damping of 1 stops the body within one step, which any coefficient above the step rate
// does
const MAX_DAMPING = 1e6;

const _vec3 = new Vec3();

/**
 * Converts an engine damping value to the Jolt damping coefficient that decays velocity at the
 * same rate.
 *
 * @param {number} damping - The engine damping, clamped to [0, 1] as Bullet does.
 * @returns {number} The Jolt damping coefficient.
 */
function toJoltDamping(damping) {
    const d = Math.min(Math.max(damping, 0), 1);
    return d < 1 ? -Math.log(1 - d) : MAX_DAMPING;
}

/**
 * Returns the allowed degree of freedom bits for three axes from a factor vector. Jolt can only
 * lock an axis, so a factor of 0 locks it and any other value leaves it free.
 *
 * @param {Vec3} factor - The factor per axis.
 * @param {number} x - The bit of the X axis.
 * @param {number} y - The bit of the Y axis.
 * @param {number} z - The bit of the Z axis.
 * @returns {number} The allowed degree of freedom bits.
 */
function factorToDofs(factor, x, y, z) {
    Debug.call(() => {
        const fractional = f => f !== 0 && f !== 1;
        if (fractional(factor.x) || fractional(factor.y) || fractional(factor.z)) {
            Debug.warnOnce('JoltPhysicsBody: Jolt can only lock axes, so linear and angular ' +
                'factors other than 0 and 1 are treated as 1.');
        }
    });
    return (factor.x !== 0 ? x : 0) | (factor.y !== 0 ? y : 0) | (factor.z !== 0 ? z : 0);
}

/**
 * A Jolt rigid body. Poses and velocities are read straight from the module heap when the world
 * has located the Jolt data layout, otherwise through the bindings; neither allocates.
 *
 * Every shape the backend creates has its center of mass at its origin, which is also where the
 * engine places the body, so the body position is the Jolt center of mass position.
 *
 * @ignore
 */
class JoltPhysicsBody extends PhysicsBody {
    /**
     * @type {JoltPhysicsWorld}
     * @private
     */
    _world;

    /**
     * The native BodyID, pointing into the body.
     *
     * @type {object}
     * @ignore
     */
    _id;

    /**
     * The index and sequence number of the body ID, as reported by removed contacts.
     *
     * @type {number}
     * @ignore
     */
    _idValue;

    /**
     * The index of the body, unique among the bodies alive in the world.
     *
     * @type {number}
     * @ignore
     */
    _index;

    /**
     * The engine body type the body was created with.
     *
     * @type {string}
     * @ignore
     */
    _type;

    /**
     * The Jolt motion type: static, kinematic or dynamic. Triggers are kinematic sensors.
     *
     * @type {number}
     * @ignore
     */
    _motionType;

    /**
     * Whether the body was created without contact response (trigger).
     *
     * @type {boolean}
     * @ignore
     */
    _sensor;

    /**
     * The shape handle the body was created with.
     *
     * @type {object}
     * @ignore
     */
    _shape;

    /** @ignore */
    _mass;

    /**
     * Whether the body is in the physics system.
     *
     * @ignore
     */
    _inWorld = false;

    /**
     * The friction and restitution in engine terms, combined per contact by the world.
     *
     * @ignore
     */
    _friction = 0.5;

    /** @ignore */
    _restitution = 0;

    /**
     * The inverse mass used to estimate contact impulses: 0 for bodies that do not move in
     * response to contacts.
     *
     * @ignore
     */
    _invMass = 0;

    /**
     * The allowed translation and rotation degrees of freedom of a dynamic body.
     *
     * @private
     */
    _linearDofs;

    /** @private */
    _angularDofs;

    /**
     * The per axis factors applied to forces and impulses before their torque is taken, matching
     * Bullet: 1 for a free translation axis, 0 for a locked one.
     *
     * @private
     */
    _linearMask = new Vec3(1, 1, 1);

    /**
     * The word addresses of the body and of its motion properties in the module heap, or -1
     * when the world reads through the bindings.
     *
     * @ignore
     */
    _heapBody = -1;

    /** @ignore */
    _heapMotion = -1;

    /**
     * The pose before the last fixed substep of a dynamic body, interpolated towards the current
     * pose by getTransform.
     *
     * @ignore
     */
    _prevPosition = new Vec3();

    /** @ignore */
    _prevRotation = new Quat();

    /**
     * The kinematic target applied at the next step that runs a substep.
     *
     * @ignore
     */
    _targetPosition = new Vec3();

    /** @ignore */
    _targetRotation = new Quat();

    /** @ignore */
    _hasTarget = false;

    /**
     * The force and torque accumulated since the last step. Jolt clears forces after every
     * substep while Bullet keeps them for all substeps of a step, so the world re-applies them
     * before each substep.
     *
     * @ignore
     */
    _force = new Vec3();

    /** @ignore */
    _torque = new Vec3();

    /** @ignore */
    _hasForce = false;

    /**
     * The index of the body in the world's list for its motion type, or -1.
     *
     * @ignore
     */
    _listIndex = -1;

    /**
     * @param {JoltPhysicsWorld} world - The owning world.
     * @param {object} nativeBody - The Jolt Body.
     * @param {string} type - The engine body type.
     * @param {number} motionType - The Jolt motion type.
     * @param {boolean} sensor - Whether the body has no contact response.
     * @param {object} shape - The shape handle.
     * @param {number} mass - The mass of a dynamic body.
     */
    constructor(world, nativeBody, type, motionType, sensor, shape, mass) {
        super();

        const Jolt = world._jolt;

        this._world = world;
        this.nativeBody = nativeBody;
        this._id = nativeBody.GetID();
        this._idValue = this._id.GetIndexAndSequenceNumber() >>> 0;
        this._index = this._id.GetIndex();
        this._type = type;
        this._motionType = motionType;
        this._sensor = sensor;
        this._shape = shape;
        this._mass = mass;
        this._linearDofs = Jolt.EAllowedDOFs_TranslationX | Jolt.EAllowedDOFs_TranslationY |
            Jolt.EAllowedDOFs_TranslationZ;
        this._angularDofs = Jolt.EAllowedDOFs_RotationX | Jolt.EAllowedDOFs_RotationY |
            Jolt.EAllowedDOFs_RotationZ;

        if (world._layout) {
            this._heapBody = Jolt.getPointer(nativeBody) >> 2;
            if (motionType !== Jolt.EMotionType_Static) {
                this._heapMotion = Jolt.getPointer(nativeBody.GetMotionProperties()) >> 2;
            }
        }

        if (motionType === Jolt.EMotionType_Dynamic && mass > 0) {
            this._invMass = 1 / mass;
        }
    }

    /**
     * Whether the body is simulated with forces, i.e. a dynamic body that is not a trigger.
     *
     * @type {boolean}
     * @ignore
     */
    get _dynamic() {
        return this._motionType === this._world._jolt.EMotionType_Dynamic;
    }

    setFriction(friction) {
        this._friction = friction;
        this.nativeBody.SetFriction(friction);
    }

    setRollingFriction(friction) {
        if (friction !== 0) {
            Debug.warnOnce('JoltPhysicsBody: Jolt has no rolling friction, so ' +
                'RigidBodyComponent#rollingFriction is ignored. Use angularDamping instead.');
        }
    }

    setRestitution(restitution) {
        this._restitution = restitution;
        this.nativeBody.SetRestitution(restitution);
    }

    setDamping(linear, angular) {
        if (this._motionType !== this._world._jolt.EMotionType_Static) {
            const motion = this.nativeBody.GetMotionProperties();
            motion.SetLinearDamping(toJoltDamping(linear));
            motion.SetAngularDamping(toJoltDamping(angular));
        }
    }

    setLinearFactor(factor) {
        if (this._dynamic) {
            const Jolt = this._world._jolt;
            const dofs = factorToDofs(factor, Jolt.EAllowedDOFs_TranslationX,
                Jolt.EAllowedDOFs_TranslationY, Jolt.EAllowedDOFs_TranslationZ);
            this._linearMask.set(factor.x !== 0 ? 1 : 0, factor.y !== 0 ? 1 : 0,
                factor.z !== 0 ? 1 : 0);
            if (dofs !== this._linearDofs) {
                this._linearDofs = dofs;
                this._updateMassProperties();
            }
        }
    }

    setAngularFactor(factor) {
        if (this._dynamic) {
            const Jolt = this._world._jolt;
            const dofs = factorToDofs(factor, Jolt.EAllowedDOFs_RotationX,
                Jolt.EAllowedDOFs_RotationY, Jolt.EAllowedDOFs_RotationZ);
            if (dofs !== this._angularDofs) {
                this._angularDofs = dofs;
                this._updateMassProperties();
            }
        }
    }

    setGravityScale(scale) {
        // Jolt multiplies the world gravity by the factor itself, so a later gravity change needs
        // nothing further
        if (this._dynamic) {
            this.nativeBody.GetMotionProperties().SetGravityFactor(scale);
        }
    }

    setLinearVelocity(velocity) {
        if (this._motionType !== this._world._jolt.EMotionType_Static) {
            const vec = this._world._vec;
            vec.Set(velocity.x, velocity.y, velocity.z);
            this.nativeBody.SetLinearVelocityClamped(vec);
        }
    }

    getLinearVelocity(velocity) {
        this._readVelocity(this._world._layout?.linearVelocity, velocity, true);
    }

    setAngularVelocity(velocity) {
        if (this._motionType !== this._world._jolt.EMotionType_Static) {
            const vec = this._world._vec;
            vec.Set(velocity.x, velocity.y, velocity.z);
            this.nativeBody.SetAngularVelocityClamped(vec);
        }
    }

    getAngularVelocity(velocity) {
        this._readVelocity(this._world._layout?.angularVelocity, velocity, false);
    }

    setMass(mass) {
        this._mass = mass;
        this._updateMassProperties();
    }

    isActive() {
        return this._inWorld && this.nativeBody.IsActive();
    }

    activate() {
        // Jolt would put a body that is not in the physics system on its active list, so only
        // bodies in the simulation are woken
        if (this._inWorld && this._motionType !== this._world._jolt.EMotionType_Static) {
            this._world._bodyInterface.ActivateBody(this._id);
        }
    }

    setTransform(position, rotation) {
        const world = this._world;
        const Jolt = world._jolt;
        const rvec = world._rvec;
        const quat = world._quat;

        rvec.Set(position.x, position.y, position.z);
        quat.Set(rotation.x, rotation.y, rotation.z, rotation.w);

        const activation = this._inWorld && this._motionType !== Jolt.EMotionType_Static ?
            Jolt.EActivation_Activate : Jolt.EActivation_DontActivate;

        // Jolt refreshes the broadphase bounds immediately, so queries find the body at its new
        // pose before the next step. Triggers are synced every step, mostly without moving
        const bodyInterface = world._bodyInterface;
        if (this._sensor) {
            bodyInterface.SetPositionAndRotationWhenChanged(this._id, rvec, quat, activation);
        } else {
            bodyInterface.SetPositionAndRotation(this._id, rvec, quat, activation);
        }

        // a teleport is not interpolated
        this._prevPosition.copy(position);
        this._prevRotation.copy(rotation);
    }

    getTransform(position, rotation) {
        this._readPose(position, rotation);

        // dynamic bodies are presented between their last two substeps, like the motion state
        // interpolation of the Ammo backend
        const alpha = this._world._interpolation;
        if (alpha < 1 && this._inWorld && this._dynamic) {
            position.lerp(this._prevPosition, position, alpha);
            rotation.slerp(this._prevRotation, rotation, alpha);
        }
    }

    setKinematicTarget(position, rotation) {
        // applied by the world before the next substep, over the whole time the step simulates
        this._targetPosition.copy(position);
        this._targetRotation.copy(rotation);
        this._hasTarget = true;
    }

    applyForce(force, relativePoint) {
        if (this._dynamic) {
            this._force.add(force);
            this._addTorqueFrom(relativePoint, force, this._torque);
            this._world._addForceBody(this);
        }
    }

    applyTorque(torque) {
        if (this._dynamic) {
            this._torque.add(torque);
            this._world._addForceBody(this);
        }
    }

    applyImpulse(impulse, relativePoint) {
        if (this._dynamic) {
            const vec = this._world._vec;
            vec.Set(impulse.x, impulse.y, impulse.z);
            this.nativeBody.AddImpulse(vec);

            // the offset part as an angular impulse about the body origin, as Bullet does
            _vec3.set(0, 0, 0);
            if (this._addTorqueFrom(relativePoint, impulse, _vec3)) {
                vec.Set(_vec3.x, _vec3.y, _vec3.z);
                this.nativeBody.AddAngularImpulse(vec);
            }
        }
    }

    applyTorqueImpulse(torque) {
        if (this._dynamic) {
            const vec = this._world._vec;
            vec.Set(torque.x, torque.y, torque.z);
            this.nativeBody.AddAngularImpulse(vec);
        }
    }

    /**
     * Adds the moment of a force or impulse applied at an offset from the body origin to a
     * torque. Like Bullet, the force is first masked by the free translation axes.
     *
     * @param {Vec3} relativePoint - The world space offset from the body origin.
     * @param {Vec3} force - The world space force or impulse.
     * @param {Vec3} torque - The torque to add to.
     * @returns {boolean} False if the offset is zero and nothing was added.
     * @private
     */
    _addTorqueFrom(relativePoint, force, torque) {
        const rx = relativePoint.x, ry = relativePoint.y, rz = relativePoint.z;
        if (rx === 0 && ry === 0 && rz === 0) {
            return false;
        }

        const mask = this._linearMask;
        const fx = force.x * mask.x, fy = force.y * mask.y, fz = force.z * mask.z;
        torque.x += ry * fz - rz * fy;
        torque.y += rz * fx - rx * fz;
        torque.z += rx * fy - ry * fx;
        return true;
    }

    /**
     * Applies the accumulated force and torque for the next substep. Called by the world.
     *
     * @ignore
     */
    _applyForces() {
        const vec = this._world._vec;
        const force = this._force;
        const torque = this._torque;
        vec.Set(force.x, force.y, force.z);
        this.nativeBody.AddForce(vec);
        vec.Set(torque.x, torque.y, torque.z);
        this.nativeBody.AddTorque(vec);
    }

    /**
     * Discards the accumulated force and torque. Called by the world at the end of each step.
     *
     * @ignore
     */
    _clearForces() {
        this._force.set(0, 0, 0);
        this._torque.set(0, 0, 0);
        this._hasForce = false;
    }

    /**
     * Records the current pose as the start of interpolation. Called by the world before the
     * last substep of a step.
     *
     * @ignore
     */
    _capturePose() {
        this._readPose(this._prevPosition, this._prevRotation);
    }

    /**
     * Recomputes the mass properties of a dynamic body from its shape, mass and allowed degrees
     * of freedom. A body with no mass cannot move, as in Bullet, so all its degrees of freedom
     * are locked.
     *
     * @ignore
     */
    _updateMassProperties() {
        if (!this._dynamic) {
            return;
        }

        const mass = this._mass;
        const dofs = mass > 0 ? this._linearDofs | this._angularDofs : 0;
        const props = computeMassProperties(this._world, this._shape, mass);
        this.nativeBody.GetMotionProperties().SetMassProperties(dofs, props);
        this._invMass = mass > 0 && this._linearDofs !== 0 ? 1 / mass : 0;
    }

    /**
     * Reads the current pose of the body.
     *
     * @param {Vec3} position - Receives the world space position.
     * @param {Quat} rotation - Receives the world space rotation.
     * @ignore
     */
    _readPose(position, rotation) {
        const layout = this._world._layout;
        if (layout) {
            const heap = this._world._jolt.HEAPF32;
            const p = this._heapBody + layout.bodyPosition;
            const r = this._heapBody + layout.bodyRotation;
            position.set(heap[p], heap[p + 1], heap[p + 2]);
            rotation.set(heap[r], heap[r + 1], heap[r + 2], heap[r + 3]);
        } else {
            const p = this.nativeBody.GetPosition();
            position.set(p.GetX(), p.GetY(), p.GetZ());
            const q = this.nativeBody.GetRotation();
            rotation.set(q.GetX(), q.GetY(), q.GetZ(), q.GetW());
        }
    }

    /**
     * Reads the linear and angular velocity of the body. Static bodies have none.
     *
     * @param {Vec3} linear - Receives the linear velocity.
     * @param {Vec3} angular - Receives the angular velocity.
     * @ignore
     */
    _readVelocities(linear, angular) {
        const layout = this._world._layout;
        this._readVelocity(layout?.linearVelocity, linear, true);
        this._readVelocity(layout?.angularVelocity, angular, false);
    }

    /**
     * Reads the linear or angular velocity of the body. Static bodies have none.
     *
     * @param {number|undefined} offset - The heap offset of the velocity, if the layout is known.
     * @param {Vec3} velocity - Receives the velocity.
     * @param {boolean} linear - True for the linear velocity, false for the angular one.
     * @private
     */
    _readVelocity(offset, velocity, linear) {
        if (this._motionType === this._world._jolt.EMotionType_Static) {
            velocity.set(0, 0, 0);
        } else if (offset !== undefined) {
            const heap = this._world._jolt.HEAPF32;
            const v = this._heapMotion + offset;
            velocity.set(heap[v], heap[v + 1], heap[v + 2]);
        } else {
            const body = this.nativeBody;
            const v = linear ? body.GetLinearVelocity() : body.GetAngularVelocity();
            velocity.set(v.GetX(), v.GetY(), v.GetZ());
        }
    }
}

export { JoltPhysicsBody };
