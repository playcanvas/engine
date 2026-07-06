/**
 * @import { PhysicsJointSettings } from './physics-world.js'
 */

/**
 * The base class for a joint (constraint) owned by a {@link PhysicsWorld}. Backends subclass
 * it and override every method. The base implementation is inert: parameter updates do nothing
 * and the joint never breaks.
 *
 * @ignore
 */
class PhysicsJoint {
    /**
     * The backend-native constraint object - btTypedConstraint when the Ammo backend is
     * active, null otherwise. Surfaced by JointComponent#constraint.
     *
     * @type {object|null}
     */
    nativeJoint = null;

    /**
     * Applies the limit-related settings for the joint's type.
     *
     * @param {PhysicsJointSettings} settings - The joint parameter bag.
     */
    updateLimits(settings) {
    }

    /**
     * Applies the motor-related settings for the joint's type.
     *
     * @param {PhysicsJointSettings} settings - The joint parameter bag.
     */
    updateMotor(settings) {
    }

    /**
     * Applies the spring-related settings for the joint's type.
     *
     * @param {PhysicsJointSettings} settings - The joint parameter bag.
     */
    updateSpring(settings) {
    }

    /**
     * Sets the impulse threshold above which the joint breaks. Infinity makes the joint
     * unbreakable.
     *
     * @param {number} impulse - The break impulse threshold.
     */
    setBreakImpulse(impulse) {
    }

    /**
     * Returns whether the joint broke during simulation, or null when the backend cannot
     * determine it - the caller then falls back to its own heuristic.
     *
     * @returns {boolean|null} True if broken, false if intact, null if undeterminable.
     */
    isBroken() {
        return false;
    }
}

export { PhysicsJoint };
