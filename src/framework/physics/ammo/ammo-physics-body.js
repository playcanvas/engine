import { BODYTYPE_DYNAMIC, BODYTYPE_KINEMATIC } from '../../components/rigid-body/constants.js';
import { PhysicsBody } from '../physics-body.js';

/**
 * @import { AmmoPhysicsWorld } from './ammo-physics-world.js'
 */

/**
 * An Ammo.js rigid body. Converts engine math types to Bullet types using the owning world's
 * cached temporaries - no method allocates.
 *
 * @ignore
 */
class AmmoPhysicsBody extends PhysicsBody {
    /**
     * @type {AmmoPhysicsWorld}
     * @private
     */
    _world;

    /**
     * The body type the native body was constructed with.
     *
     * @type {string}
     * @private
     */
    _type;

    /**
     * Whether the body was created without contact response (trigger).
     *
     * @private
     */
    _noContactResponse;

    /**
     * @param {AmmoPhysicsWorld} world - The owning world.
     * @param {object} nativeBody - The btRigidBody.
     * @param {string} type - The body type: BODYTYPE_STATIC, BODYTYPE_DYNAMIC or
     * BODYTYPE_KINEMATIC.
     * @param {boolean} noContactResponse - Whether the body has no contact response.
     */
    constructor(world, nativeBody, type, noContactResponse) {
        super();
        this._world = world;
        this.nativeBody = nativeBody;
        this._type = type;
        this._noContactResponse = noContactResponse;
    }

    setFriction(friction) {
        this.nativeBody.setFriction(friction);
    }

    setRollingFriction(friction) {
        this.nativeBody.setRollingFriction(friction);
    }

    setRestitution(restitution) {
        this.nativeBody.setRestitution(restitution);
    }

    setDamping(linear, angular) {
        this.nativeBody.setDamping(linear, angular);
    }

    setLinearFactor(factor) {
        const vec = this._world._btVec1;
        vec.setValue(factor.x, factor.y, factor.z);
        this.nativeBody.setLinearFactor(vec);
    }

    setAngularFactor(factor) {
        const vec = this._world._btVec1;
        vec.setValue(factor.x, factor.y, factor.z);
        this.nativeBody.setAngularFactor(vec);
    }

    setLinearVelocity(velocity) {
        const vec = this._world._btVec1;
        vec.setValue(velocity.x, velocity.y, velocity.z);
        this.nativeBody.setLinearVelocity(vec);
    }

    getLinearVelocity(velocity) {
        const vec = this.nativeBody.getLinearVelocity();
        velocity.set(vec.x(), vec.y(), vec.z());
    }

    setAngularVelocity(velocity) {
        const vec = this._world._btVec1;
        vec.setValue(velocity.x, velocity.y, velocity.z);
        this.nativeBody.setAngularVelocity(vec);
    }

    getAngularVelocity(velocity) {
        const vec = this.nativeBody.getAngularVelocity();
        velocity.set(vec.x(), vec.y(), vec.z());
    }

    setMass(mass) {
        const vec = this._world._btVec1;
        // calculateLocalInertia writes local inertia to vec here...
        this.nativeBody.getCollisionShape().calculateLocalInertia(mass, vec);
        // ...and then writes the calculated local inertia to the body
        this.nativeBody.setMassProps(mass, vec);
        this.nativeBody.updateInertiaTensor();
    }

    isActive() {
        return this.nativeBody.isActive();
    }

    activate() {
        this.nativeBody.activate();
    }

    setTransform(position, rotation) {
        const body = this.nativeBody;
        const transform = this._world._btTransform;
        const vec = this._world._btVec1;
        const quat = this._world._btQuat;

        vec.setValue(position.x, position.y, position.z);
        quat.setValue(rotation.x, rotation.y, rotation.z, rotation.w);
        transform.setOrigin(vec);
        transform.setRotation(quat);

        body.setWorldTransform(transform);

        if (this._type === BODYTYPE_KINEMATIC) {
            const motionState = body.getMotionState();
            if (motionState) {
                motionState.setWorldTransform(transform);
            }
        } else if (this._type === BODYTYPE_DYNAMIC && !this._noContactResponse && body.setInterpolationWorldTransform) {
            // Sync the interpolation state so the transform read back by getTransform is the
            // teleport target on frames that run zero fixed sub-steps (high refresh rates);
            // zero the interpolation velocities so it is exact, not extrapolated.
            // Guarded: older ammo builds lack these bindings.
            body.setInterpolationWorldTransform(transform);
            vec.setValue(0, 0, 0);
            body.setInterpolationLinearVelocity(vec);
            body.setInterpolationAngularVelocity(vec);
        }

        body.activate();
    }

    getTransform(position, rotation) {
        // Note that the test for the presence of the motion state is technically redundant
        // since the engine creates one for all bodies.
        const motionState = this.nativeBody.getMotionState();
        if (motionState) {
            const transform = this._world._btTransform;
            motionState.getWorldTransform(transform);

            const p = transform.getOrigin();
            const q = transform.getRotation();
            position.set(p.x(), p.y(), p.z());
            rotation.set(q.x(), q.y(), q.z(), q.w());
        }
    }

    setKinematicTarget(position, rotation) {
        const motionState = this.nativeBody.getMotionState();
        if (motionState) {
            const transform = this._world._btTransform;
            const vec = this._world._btVec1;
            const quat = this._world._btQuat;

            vec.setValue(position.x, position.y, position.z);
            quat.setValue(rotation.x, rotation.y, rotation.z, rotation.w);
            transform.setOrigin(vec);
            transform.setRotation(quat);

            motionState.setWorldTransform(transform);
        }
    }

    applyForce(force, relativePoint) {
        const vec1 = this._world._btVec1;
        const vec2 = this._world._btVec2;
        vec1.setValue(force.x, force.y, force.z);
        vec2.setValue(relativePoint.x, relativePoint.y, relativePoint.z);
        this.nativeBody.applyForce(vec1, vec2);
    }

    applyTorque(torque) {
        const vec = this._world._btVec1;
        vec.setValue(torque.x, torque.y, torque.z);
        this.nativeBody.applyTorque(vec);
    }

    applyImpulse(impulse, relativePoint) {
        const vec1 = this._world._btVec1;
        const vec2 = this._world._btVec2;
        vec1.setValue(impulse.x, impulse.y, impulse.z);
        vec2.setValue(relativePoint.x, relativePoint.y, relativePoint.z);
        this.nativeBody.applyImpulse(vec1, vec2);
    }

    applyTorqueImpulse(torque) {
        const vec = this._world._btVec1;
        vec.setValue(torque.x, torque.y, torque.z);
        this.nativeBody.applyTorqueImpulse(vec);
    }
}

export { AmmoPhysicsBody };
