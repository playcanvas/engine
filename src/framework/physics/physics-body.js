/**
 * @import { Entity } from '../entity.js'
 * @import { Quat } from '../../core/math/quat.js'
 * @import { Vec3 } from '../../core/math/vec3.js'
 */

/**
 * The base class for a rigid body owned by a {@link PhysicsWorld}. Backends subclass it and
 * override every method. The base implementation is inert: setters do nothing and getters
 * leave their out-parameters untouched, so callers fall back to their own cached values -
 * matching the engine's behavior when no physics library is loaded.
 *
 * @ignore
 */
class PhysicsBody {
    /**
     * The entity this body simulates. Surfaced by raycast and contact results.
     *
     * @type {Entity|null}
     */
    entity = null;

    /**
     * The backend-native body object - btRigidBody when the Ammo backend is active, null
     * otherwise. Surfaced by RigidBodyComponent#body.
     *
     * @type {object|null}
     */
    nativeBody = null;

    /**
     * @param {number} friction - The friction value used when contacts occur.
     */
    setFriction(friction) {
    }

    /**
     * @param {number} friction - The torsional friction orthogonal to the contact point.
     */
    setRollingFriction(friction) {
    }

    /**
     * @param {number} restitution - The amount of energy preserved on collision.
     */
    setRestitution(restitution) {
    }

    /**
     * Sets both damping values in one call.
     *
     * @param {number} linear - The rate at which the body loses linear velocity.
     * @param {number} angular - The rate at which the body loses angular velocity.
     */
    setDamping(linear, angular) {
    }

    /**
     * @param {Vec3} factor - The scaling factor for linear movement per axis.
     */
    setLinearFactor(factor) {
    }

    /**
     * @param {Vec3} factor - The scaling factor for angular movement per axis.
     */
    setAngularFactor(factor) {
    }

    /**
     * @param {Vec3} velocity - The world space linear velocity.
     */
    setLinearVelocity(velocity) {
    }

    /**
     * Reads the body's linear velocity into an out-parameter. Inert backends leave it
     * untouched.
     *
     * @param {Vec3} velocity - The vector to write the linear velocity to.
     */
    getLinearVelocity(velocity) {
    }

    /**
     * @param {Vec3} velocity - The world space angular velocity.
     */
    setAngularVelocity(velocity) {
    }

    /**
     * Reads the body's angular velocity into an out-parameter. Inert backends leave it
     * untouched.
     *
     * @param {Vec3} velocity - The vector to write the angular velocity to.
     */
    getAngularVelocity(velocity) {
    }

    /**
     * Sets the body mass and recomputes its inertia from the current collision shape.
     *
     * @param {number} mass - The new mass.
     */
    setMass(mass) {
    }

    /**
     * Returns true if the body is actively simulating, i.e. not sleeping.
     *
     * @returns {boolean} True if the body is active.
     */
    isActive() {
        return false;
    }

    /**
     * Forcibly wakes the body.
     */
    activate() {
    }

    /**
     * Teleports the body to a new world space pose and wakes it. Backends also refresh any
     * interpolation state so the pose read back by {@link PhysicsBody#getTransform} is the
     * teleport target even on frames that run zero fixed substeps.
     *
     * @param {Vec3} position - The world space position.
     * @param {Quat} rotation - The world space rotation.
     */
    setTransform(position, rotation) {
    }

    /**
     * Reads the simulated pose to present to the scene (the interpolated transform on backends
     * that interpolate). Inert backends leave the out-parameters untouched.
     *
     * @param {Vec3} position - The vector to write the world space position to.
     * @param {Quat} rotation - The quaternion to write the world space rotation to.
     */
    getTransform(position, rotation) {
    }

    /**
     * Drives a kinematic body towards a world space pose for the next simulation step.
     *
     * @param {Vec3} position - The world space position.
     * @param {Quat} rotation - The world space rotation.
     */
    setKinematicTarget(position, rotation) {
    }

    /**
     * Applies a force at a point relative to the body's origin. The body is not woken - callers
     * activate first, matching the engine's established call order.
     *
     * @param {Vec3} force - The world space force.
     * @param {Vec3} relativePoint - The world space offset from the body origin.
     */
    applyForce(force, relativePoint) {
    }

    /**
     * @param {Vec3} torque - The world space torque.
     */
    applyTorque(torque) {
    }

    /**
     * Applies an impulse at a point relative to the body's origin.
     *
     * @param {Vec3} impulse - The world space impulse.
     * @param {Vec3} relativePoint - The local space offset from the body origin.
     */
    applyImpulse(impulse, relativePoint) {
    }

    /**
     * @param {Vec3} torque - The world space torque impulse.
     */
    applyTorqueImpulse(torque) {
    }
}

export { PhysicsBody };
