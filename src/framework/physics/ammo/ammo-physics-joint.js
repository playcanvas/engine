import { Debug } from '../../../core/debug.js';
import { math } from '../../../core/math/math.js';
import { Mat4 } from '../../../core/math/mat4.js';
import { Quat } from '../../../core/math/quat.js';
import { Vec3 } from '../../../core/math/vec3.js';
import {
    JOINTTYPE_6DOF, JOINTTYPE_BALL, JOINTTYPE_FIXED, JOINTTYPE_HINGE, JOINTTYPE_SLIDER,
    MOTION_FREE, MOTION_LIMITED
} from '../../components/joint/constants.js';
import { PhysicsJoint } from '../physics-joint.js';

/**
 * @import { AmmoPhysicsWorld } from './ammo-physics-world.js'
 * @import { PhysicsJointDesc } from '../physics-world.js'
 */

const _frameMat = new Mat4();
const _vec3 = new Vec3();
const _quat = new Quat();

// scratch for dofLimits
const _dof = { lower: 0, upper: 0 };

// computes the lower/upper pair encoding a 6dof degree of freedom: bullet treats
// lower > upper as free and lower === upper as locked
function dofLimits(motion, limits, scale) {
    if (motion === MOTION_LIMITED) {
        _dof.lower = limits.x * scale;
        _dof.upper = limits.y * scale;
    } else if (motion === MOTION_FREE) {
        _dof.lower = 1;
        _dof.upper = 0;
    } else { // MOTION_LOCKED
        _dof.lower = 0;
        _dof.upper = 0;
    }
    return _dof;
}

// Per-type joint implementations, mapping the engine's joint settings onto the most appropriate
// bullet constraint. Methods other than create are optional - a type without a motor simply
// omits updateMotor. axisCorrection, where present, rotates both joint frames so that the
// constraint's native axis lands on the engine's primary (X) joint axis.

const fixedJoint = {
    create(bodyA, bodyB, frameA, frameB) {
        return new Ammo.btFixedConstraint(bodyA, bodyB, frameA, frameB);
    }
};

const ballJoint = {
    create(bodyA, bodyB, frameA, frameB) {
        return new Ammo.btConeTwistConstraint(bodyA, bodyB, frameA, frameB);
    },

    updateLimits(joint, settings) {
        const constraint = joint.nativeJoint;

        // setLimit indices: 5 = swing span 1, limiting rotation about the constraint's Z axis
        // (i.e. swing towards Y), 4 = swing span 2, limiting rotation about Y (swing towards Z),
        // 3 = twist span about X
        if (settings.enableLimits) {
            constraint.setLimit(5, settings.swingLimitY * math.DEG_TO_RAD);
            constraint.setLimit(4, settings.swingLimitZ * math.DEG_TO_RAD);
            constraint.setLimit(3, settings.twistLimit * math.DEG_TO_RAD);
        } else {
            // bullet treats spans of this magnitude as unlimited
            constraint.setLimit(5, 1e30);
            constraint.setLimit(4, 1e30);
            constraint.setLimit(3, 1e30);
        }
    }
};

const hingeJoint = {
    // bullet hinges rotate about frame Z - map the engine's X axis onto it
    axisCorrection: new Mat4().setFromAxisAngle(Vec3.UP, 90),

    create(bodyA, bodyB, frameA, frameB) {
        return new Ammo.btHingeConstraint(bodyA, bodyB, frameA, frameB, false);
    },

    updateLimits(joint, settings) {
        const constraint = joint.nativeJoint;
        if (settings.enableLimits) {
            const limits = settings.limits;
            // the remaining arguments are bullet's default softness, bias and relaxation factors
            constraint.setLimit(limits.x * math.DEG_TO_RAD, limits.y * math.DEG_TO_RAD, 0.9, 0.3, 1);
        } else {
            // lower > upper leaves the rotation unconstrained
            constraint.setLimit(1, -1, 0.9, 0.3, 1);
        }
    },

    updateMotor(joint, settings) {
        // bullet's hinge motor clamp is an impulse per simulation step, so scale the torque by
        // the fixed timestep
        const maxImpulse = settings.maxMotorForce * joint._world._fixedTimeStep;
        joint.nativeJoint.enableAngularMotor(settings.maxMotorForce > 0, settings.motorSpeed * math.DEG_TO_RAD, maxImpulse);
    }
};

const sliderJoint = {
    create(bodyA, bodyB, frameA, frameB) {
        // the final argument is useLinearReferenceFrameA - travel is measured in frame A's space
        return new Ammo.btSliderConstraint(bodyA, bodyB, frameA, frameB, true);
    },

    updateLimits(joint, settings) {
        const constraint = joint.nativeJoint;
        if (settings.enableLimits) {
            const limits = settings.limits;
            constraint.setLowerLinLimit(limits.x);
            constraint.setUpperLinLimit(limits.y);
        } else {
            // lower > upper leaves the translation unconstrained
            constraint.setLowerLinLimit(1);
            constraint.setUpperLinLimit(-1);
        }

        // rotation about the slide axis is always locked
        constraint.setLowerAngLimit(0);
        constraint.setUpperAngLimit(0);
    },

    updateMotor(joint, settings) {
        const constraint = joint.nativeJoint;
        constraint.setPoweredLinMotor(settings.maxMotorForce > 0);
        constraint.setTargetLinMotorVelocity(settings.motorSpeed);
        constraint.setMaxLinMotorForce(settings.maxMotorForce);
    }
};

const sixDofJoint = {
    create(bodyA, bodyB, frameA, frameB) {
        // the final argument is useLinearReferenceFrameA - linear limits are measured in frame
        // A's space
        return new Ammo.btGeneric6DofSpringConstraint(bodyA, bodyB, frameA, frameB, true);
    },

    updateLimits(joint, settings) {
        const constraint = joint.nativeJoint;

        let dof = dofLimits(settings.linearMotionX, settings.linearLimitsX, 1);
        const lx = dof.lower, ux = dof.upper;
        dof = dofLimits(settings.linearMotionY, settings.linearLimitsY, 1);
        const ly = dof.lower, uy = dof.upper;
        dof = dofLimits(settings.linearMotionZ, settings.linearLimitsZ, 1);
        const lz = dof.lower, uz = dof.upper;

        const limits = joint._world._btVec1;
        limits.setValue(lx, ly, lz);
        constraint.setLinearLowerLimit(limits);
        limits.setValue(ux, uy, uz);
        constraint.setLinearUpperLimit(limits);

        dof = dofLimits(settings.angularMotionX, settings.angularLimitsX, math.DEG_TO_RAD);
        const alx = dof.lower, aux = dof.upper;
        dof = dofLimits(settings.angularMotionY, settings.angularLimitsY, math.DEG_TO_RAD);
        const aly = dof.lower, auy = dof.upper;
        dof = dofLimits(settings.angularMotionZ, settings.angularLimitsZ, math.DEG_TO_RAD);
        const alz = dof.lower, auz = dof.upper;

        limits.setValue(alx, aly, alz);
        constraint.setAngularLowerLimit(limits);
        limits.setValue(aux, auy, auz);
        constraint.setAngularUpperLimit(limits);
    },

    updateSpring(joint, settings) {
        const constraint = joint.nativeJoint;
        const rad = math.DEG_TO_RAD;
        const linStiffness = settings.linearStiffness;
        const linDamping = settings.linearDamping;
        const linEquilibrium = settings.linearEquilibrium;
        const angStiffness = settings.angularStiffness;
        const angDamping = settings.angularDamping;
        const angEquilibrium = settings.angularEquilibrium;

        // a spring acts on an axis when its stiffness component is greater than 0; axes 0-2 are
        // linear X/Y/Z, axes 3-5 are angular X/Y/Z; angular equilibrium points are specified in
        // degrees but applied in radians
        constraint.enableSpring(0, linStiffness.x > 0);
        constraint.setStiffness(0, linStiffness.x);
        constraint.setDamping(0, linDamping.x);
        constraint.setEquilibriumPoint(0, linEquilibrium.x);

        constraint.enableSpring(1, linStiffness.y > 0);
        constraint.setStiffness(1, linStiffness.y);
        constraint.setDamping(1, linDamping.y);
        constraint.setEquilibriumPoint(1, linEquilibrium.y);

        constraint.enableSpring(2, linStiffness.z > 0);
        constraint.setStiffness(2, linStiffness.z);
        constraint.setDamping(2, linDamping.z);
        constraint.setEquilibriumPoint(2, linEquilibrium.z);

        constraint.enableSpring(3, angStiffness.x > 0);
        constraint.setStiffness(3, angStiffness.x);
        constraint.setDamping(3, angDamping.x);
        constraint.setEquilibriumPoint(3, angEquilibrium.x * rad);

        constraint.enableSpring(4, angStiffness.y > 0);
        constraint.setStiffness(4, angStiffness.y);
        constraint.setDamping(4, angDamping.y);
        constraint.setEquilibriumPoint(4, angEquilibrium.y * rad);

        constraint.enableSpring(5, angStiffness.z > 0);
        constraint.setStiffness(5, angStiffness.z);
        constraint.setDamping(5, angDamping.z);
        constraint.setEquilibriumPoint(5, angEquilibrium.z * rad);
    }
};

const jointImpls = {
    [JOINTTYPE_FIXED]: fixedJoint,
    [JOINTTYPE_BALL]: ballJoint,
    [JOINTTYPE_HINGE]: hingeJoint,
    [JOINTTYPE_SLIDER]: sliderJoint,
    [JOINTTYPE_6DOF]: sixDofJoint
};

/**
 * An Ammo.js joint (btTypedConstraint).
 *
 * @ignore
 */
class AmmoPhysicsJoint extends PhysicsJoint {
    /**
     * @type {AmmoPhysicsWorld}
     * @private
     */
    _world;

    /**
     * The joint type the native constraint was created with.
     *
     * @type {string}
     * @private
     */
    _type;

    /**
     * The break impulse threshold, used by the applied-impulse break probe.
     *
     * @private
     */
    _breakImpulse = Infinity;

    /**
     * @param {AmmoPhysicsWorld} world - The owning world.
     * @param {string} type - The joint type.
     */
    constructor(world, type) {
        super();
        this._world = world;
        this._type = type;
    }

    updateLimits(settings) {
        const impl = jointImpls[this._type];
        if (impl.updateLimits) {
            impl.updateLimits(this, settings);
            return true;
        }
        return false;
    }

    updateMotor(settings) {
        const impl = jointImpls[this._type];
        if (impl.updateMotor) {
            impl.updateMotor(this, settings);
            return true;
        }
        return false;
    }

    updateSpring(settings) {
        const impl = jointImpls[this._type];
        if (impl.updateSpring) {
            impl.updateSpring(this, settings);
            return true;
        }
        return false;
    }

    setBreakImpulse(impulse) {
        this._breakImpulse = impulse;

        const breakable = Number.isFinite(impulse);
        this.nativeJoint.setBreakingImpulseThreshold(breakable ? impulse : Number.MAX_VALUE);
        this.nativeJoint.enableFeedback(breakable);
    }

    isBroken() {
        // bullet disables a constraint when its breaking impulse threshold is exceeded but the
        // stock ammo build exposes no way to query it - prefer isEnabled, then the applied
        // impulse, then let the caller fall back to its own heuristic
        const constraint = this.nativeJoint;
        if (typeof constraint.isEnabled === 'function') {
            return !constraint.isEnabled();
        }
        if (typeof constraint.getAppliedImpulse === 'function') {
            return constraint.getAppliedImpulse() >= this._breakImpulse;
        }
        return null;
    }
}

/**
 * Converts an engine-convention joint frame (a scale-free Mat4 with X as the primary axis) to a
 * new Ammo.btTransform owned by the caller, applying the joint type's native axis correction in
 * matrix space.
 *
 * @param {Mat4} frameMat - The joint frame.
 * @param {Mat4|undefined} axisCorrection - The joint type's axis correction, if any.
 * @returns {object} The frame as a new Ammo.btTransform.
 */
function createBtFrame(frameMat, axisCorrection) {
    _frameMat.copy(frameMat);
    if (axisCorrection) {
        _frameMat.mul(axisCorrection);
    }

    _frameMat.getTranslation(_vec3);
    _quat.setFromMat4(_frameMat);

    const frame = new Ammo.btTransform();
    const origin = new Ammo.btVector3(_vec3.x, _vec3.y, _vec3.z);
    const rotation = new Ammo.btQuaternion(_quat.x, _quat.y, _quat.z, _quat.w);
    frame.setOrigin(origin);
    frame.setRotation(rotation);
    Ammo.destroy(origin);
    Ammo.destroy(rotation);

    return frame;
}

/**
 * Returns the world's shared static body, lazily created and never added to the dynamics world,
 * that world-pinned joints (bodyB of null) attach to. Its transform is identity, so the frame a
 * joint computes against it is simply the joint's world frame. This mirrors Bullet's own
 * getFixedBody pattern and avoids the single-body constraint constructors, some of which do not
 * transform their frame to world space (notably btConeTwistConstraint).
 *
 * @param {AmmoPhysicsWorld} world - The owning world.
 * @returns {object} The shared static body.
 */
function getFixedBody(world) {
    if (!world._fixedBody) {
        const transform = new Ammo.btTransform();
        transform.setIdentity();
        const motionState = new Ammo.btDefaultMotionState(transform);
        const shape = new Ammo.btSphereShape(0.001);
        const inertia = new Ammo.btVector3(0, 0, 0);
        const info = new Ammo.btRigidBodyConstructionInfo(0, motionState, shape, inertia);
        world._fixedBody = new Ammo.btRigidBody(info);
        Ammo.destroy(info);
        Ammo.destroy(inertia);
        Ammo.destroy(transform);
    }

    return world._fixedBody;
}

/**
 * @param {AmmoPhysicsWorld} world - The owning world.
 * @param {PhysicsJointDesc} desc - The joint descriptor.
 * @returns {AmmoPhysicsJoint} The new joint, added to the simulation.
 */
function createJoint(world, desc) {
    const impl = jointImpls[desc.type];
    const axisCorrection = impl.axisCorrection;
    const settings = desc.settings;

    const frameA = createBtFrame(desc.frameA, axisCorrection);
    const frameB = createBtFrame(desc.frameB, axisCorrection);

    const bodyA = desc.bodyA.nativeBody;

    // world-pinned joints attach to a shared static body with an identity transform
    const bodyB = desc.bodyB ? desc.bodyB.nativeBody : getFixedBody(world);

    const constraint = impl.create(bodyA, bodyB, frameA, frameB);

    Ammo.destroy(frameA);
    Ammo.destroy(frameB);

    const joint = new AmmoPhysicsJoint(world, desc.type);
    joint.nativeJoint = constraint;

    impl.updateLimits?.(joint, settings);
    impl.updateMotor?.(joint, settings);
    impl.updateSpring?.(joint, settings);

    if (Number.isFinite(settings.breakImpulse)) {
        joint.setBreakImpulse(settings.breakImpulse);

        Debug.call(() => {
            if (desc.type === JOINTTYPE_6DOF &&
                typeof constraint.isEnabled !== 'function' &&
                typeof constraint.getAppliedImpulse !== 'function') {
                Debug.warnOnce('AmmoPhysicsJoint: this ammo build exposes no constraint state, so breakage of 6dof joints cannot be detected - the joint will still break but no break event will fire.');
            }
        });
    }

    bodyA.activate();
    bodyB.activate();

    world.nativeWorld.addConstraint(constraint, !desc.enableCollision);

    return joint;
}

/**
 * @param {AmmoPhysicsWorld} world - The owning world.
 * @param {AmmoPhysicsJoint} joint - The joint to remove and destroy.
 */
function destroyJoint(world, joint) {
    world.nativeWorld.removeConstraint(joint.nativeJoint);
    Ammo.destroy(joint.nativeJoint);
    joint.nativeJoint = null;
}

/**
 * Destroys the world's shared fixed anchor body, if it was ever created.
 *
 * @param {AmmoPhysicsWorld} world - The owning world.
 */
function destroyFixedBody(world) {
    if (world._fixedBody) {
        Ammo.destroy(world._fixedBody.getMotionState());
        Ammo.destroy(world._fixedBody.getCollisionShape());
        Ammo.destroy(world._fixedBody);
        world._fixedBody = null;
    }
}

export { AmmoPhysicsJoint, createJoint, destroyJoint, destroyFixedBody };
