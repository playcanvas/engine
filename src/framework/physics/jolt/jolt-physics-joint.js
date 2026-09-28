import { math } from '../../../core/math/math.js';
import { Quat } from '../../../core/math/quat.js';
import { Vec3 } from '../../../core/math/vec3.js';
import {
    JOINTTYPE_6DOF, JOINTTYPE_BALL, JOINTTYPE_FIXED, JOINTTYPE_HINGE, JOINTTYPE_SLIDER,
    MOTION_FREE, MOTION_LIMITED
} from '../../components/joint/constants.js';
import { PhysicsJoint } from '../physics-joint.js';

/**
 * @import { JoltPhysicsBody } from './jolt-physics-body.js'
 * @import { JoltPhysicsWorld } from './jolt-physics-world.js'
 * @import { Mat4 } from '../../../core/math/mat4.js'
 * @import { Vec2 } from '../../../core/math/vec2.js'
 * @import { PhysicsJointDesc } from '../physics-world.js'
 */

// FLT_MAX: Jolt's value for an unlimited range
const FLT_MAX = 3.4028234663852886e38;

const _position = new Vec3();
const _axisX = new Vec3();
const _axisY = new Vec3();
const _vec3 = new Vec3();
const _quat = new Quat();

// Sign conventions. Joint frames are expressed in the local space of each body, which for Jolt is
// the space of its center of mass - the body origin, for every shape the backend creates. Body A
// is Jolt's body 1 and body B its body 2, except for ball joints (see ballJoint). Jolt measures
// both translation and rotation as body 2 relative to body 1, so linear values carry over
// unchanged, but the engine measures rotation as A relative to B: angular limits, targets and
// motor speeds change sign.

/**
 * Writes the frame origin and X and Y axes of a scale-free joint frame to the module scratch.
 *
 * @param {Mat4} frame - The joint frame.
 */
function readFrame(frame) {
    frame.getTranslation(_position);
    frame.getX(_axisX).normalize();
    frame.getY(_axisY).normalize();
}

/**
 * Returns the engine limits of a hinge or angular 6dof axis in degrees as Jolt limits in
 * radians, flipped to Jolt's sign convention.
 *
 * @param {number} lower - The lower limit in degrees.
 * @param {number} upper - The upper limit in degrees.
 * @param {{ min: number, max: number }} out - Receives the Jolt limits.
 * @returns {{ min: number, max: number }} The limits.
 */
function flipAngular(lower, upper, out) {
    out.min = Math.max(-upper * math.DEG_TO_RAD, -Math.PI);
    out.max = Math.min(-lower * math.DEG_TO_RAD, Math.PI);
    return out;
}

const _limits = { min: 0, max: 0 };

/**
 * Returns the Jolt range of a 6dof degree of freedom. Like Bullet, a limited axis whose lower
 * limit exceeds its upper one is free, and equal limits lock it.
 *
 * @param {string} motion - MOTION_FREE, MOTION_LIMITED or MOTION_LOCKED.
 * @param {Vec2} limits - The engine limits.
 * @param {boolean} angular - Whether the axis is angular (limits in degrees).
 * @param {{ min: number, max: number }} out - Receives the range.
 * @returns {{ min: number, max: number }} The range.
 */
function dofRange(motion, limits, angular, out) {
    const free = angular ? Math.PI : FLT_MAX;
    if (motion === MOTION_LIMITED && limits.x <= limits.y) {
        if (angular) {
            flipAngular(limits.x, limits.y, out);
        } else {
            out.min = limits.x;
            out.max = limits.y;
        }
    } else if (motion === MOTION_FREE || motion === MOTION_LIMITED) {
        out.min = -free;
        out.max = free;
    } else { // MOTION_LOCKED
        out.min = 0;
        out.max = 0;
    }
    return out;
}

/**
 * Returns the largest absolute component of a Jolt vector.
 *
 * @param {object} v - The Jolt Vec3.
 * @returns {number} The largest absolute component.
 */
function maxAbs3(v) {
    return Math.max(Math.abs(v.GetX()), Math.abs(v.GetY()), Math.abs(v.GetZ()));
}

/**
 * Returns the largest absolute component of a Jolt Vector2.
 *
 * @param {object} v - The Jolt Vector2.
 * @returns {number} The largest absolute component.
 */
function maxAbs2(v) {
    return Math.max(Math.abs(v.GetComponent(0)), Math.abs(v.GetComponent(1)));
}

/**
 * Returns the inverse mass (linear) or inverse moment of inertia about an axis (angular) of a
 * joint body, or 0 for a body that does not move.
 *
 * @param {JoltPhysicsBody|null} body - The body.
 * @param {Vec3} axis - The world space axis.
 * @param {boolean} angular - Whether the spring is angular.
 * @param {object} vec - A Jolt Vec3 temporary.
 * @returns {number} The inverse mass or moment of inertia.
 */
function inverseMass(body, axis, angular, vec) {
    if (!body?._dynamic) {
        return 0;
    }
    if (!angular) {
        return body._invMass;
    }
    vec.Set(axis.x, axis.y, axis.z);
    const w = body.nativeBody.GetInverseInertia().Multiply3x3(vec);
    return axis.x * w.GetX() + axis.y * w.GetY() + axis.z * w.GetZ();
}

/**
 * Returns the effective mass the bodies of a joint present to a spring along or about an axis:
 * the inverse of the sum of their inverse masses (linear) or inverse moments of inertia about
 * the axis (angular). Infinity if neither body moves.
 *
 * @param {JoltPhysicsJoint} joint - The joint.
 * @param {Vec3} axis - The world space axis.
 * @param {boolean} angular - Whether the spring is angular.
 * @returns {number} The effective mass.
 */
function effectiveMass(joint, axis, angular) {
    const vec = joint._world._vec;
    const inverse = inverseMass(joint._bodyA, axis, angular, vec) +
        inverseMass(joint._bodyB, axis, angular, vec);
    return inverse > 0 ? 1 / inverse : Infinity;
}

/**
 * Configures the position motor of one 6dof axis as a spring towards its target.
 *
 * @param {JoltPhysicsJoint} joint - The joint.
 * @param {number} axis - The Jolt axis, 0 to 5.
 * @param {number} stiffness - The spring stiffness; the spring is off when not above 0.
 * @param {number} damping - The engine damping: 1 (the default) is undamped and 0 critically
 * damped. Bullet's springs use the same range.
 */
function setSpring(joint, axis, stiffness, damping) {
    const Jolt = joint._world._jolt;
    const constraint = joint.nativeJoint;

    if (!(stiffness > 0)) {
        constraint.SetMotorState(axis, Jolt.EMotorState_Off);
        return;
    }

    // the axis in world space, from the frame of body A
    const angular = axis >= 3;
    const column = axis % 3;
    _vec3.set(column === 0 ? 1 : 0, column === 1 ? 1 : 0, column === 2 ? 1 : 0);
    joint._frameRotationA.transformVector(_vec3, _vec3);
    joint._bodyA._readPose(_position, _quat);
    _quat.transformVector(_vec3, _vec3);

    const ratio = 1 - Math.min(Math.max(damping, 0), 1);
    const mass = effectiveMass(joint, _vec3, angular);
    const coefficient = Number.isFinite(mass) ? 2 * ratio * Math.sqrt(stiffness * mass) : 0;

    const spring = constraint.GetMotorSettings(axis).mSpringSettings;
    spring.mMode = Jolt.ESpringMode_StiffnessAndDamping;
    spring.mStiffness = stiffness;
    spring.mDamping = coefficient;
    constraint.SetMotorState(axis, Jolt.EMotorState_Position);
}

/**
 * Writes the frames of the two bodies to six degree of freedom constraint settings.
 *
 * @param {JoltPhysicsWorld} world - The owning world.
 * @param {object} settings - The SixDOFConstraintSettings.
 * @param {Mat4} frame1 - The frame of body 1.
 * @param {Mat4} frame2 - The frame of body 2.
 */
function setSixDofFrames(world, settings, frame1, frame2) {
    const rvec = world._rvec;
    const vec = world._vec;

    readFrame(frame1);
    rvec.Set(_position.x, _position.y, _position.z);
    settings.mPosition1 = rvec;
    vec.Set(_axisX.x, _axisX.y, _axisX.z);
    settings.mAxisX1 = vec;
    vec.Set(_axisY.x, _axisY.y, _axisY.z);
    settings.mAxisY1 = vec;

    readFrame(frame2);
    rvec.Set(_position.x, _position.y, _position.z);
    settings.mPosition2 = rvec;
    vec.Set(_axisX.x, _axisX.y, _axisX.z);
    settings.mAxisX2 = vec;
    vec.Set(_axisY.x, _axisY.y, _axisY.z);
    settings.mAxisY2 = vec;
}

/**
 * @param {JoltPhysicsJoint} joint - A joint built on a SixDOFConstraint.
 * @returns {number} The largest impulse the constraint applied in the last substep.
 */
function sixDofMaxLambda(joint) {
    const constraint = joint.nativeJoint;
    return Math.max(
        maxAbs3(constraint.GetTotalLambdaPosition()),
        maxAbs3(constraint.GetTotalLambdaRotation()),
        maxAbs3(constraint.GetTotalLambdaMotorTranslation()),
        maxAbs3(constraint.GetTotalLambdaMotorRotation())
    );
}

// Per-type joint implementations. Settings are created in the local space of each body, with X as
// the primary axis. Methods other than create are optional - a type without a motor omits
// updateMotor. maxLambda returns the largest impulse the constraint applied in the last substep.

const fixedJoint = {
    // a six degree of freedom constraint with every axis locked, as Jolt's fixed constraint
    // does not expose the impulses break detection reads
    create(world) {
        const Jolt = world._jolt;
        const settings = new Jolt.SixDOFConstraintSettings();
        for (let axis = 0; axis < 6; axis++) {
            settings.MakeFixedAxis(axis);
        }
        return settings;
    },

    setFrames: setSixDofFrames,

    cast: world => world._jolt.SixDOFConstraint,

    maxLambda: sixDofMaxLambda
};

const ballJoint = {
    // Jolt measures swing in the frame of body 1, so entityB, the body the swing cone belongs
    // to, is body 1: measured from entityA's frame, a twist would let entityA swing past its
    // limits. The limits are symmetric, so the order changes no signs
    parentFirst: true,

    create(world) {
        const Jolt = world._jolt;
        const settings = new Jolt.SwingTwistConstraintSettings();
        settings.mSwingType = Jolt.ESwingType_Cone;
        return settings;
    },

    setFrames(world, settings, frameA, frameB) {
        const rvec = world._rvec;
        const vec = world._vec;

        readFrame(frameA);
        rvec.Set(_position.x, _position.y, _position.z);
        settings.mPosition1 = rvec;
        vec.Set(_axisX.x, _axisX.y, _axisX.z);
        settings.mTwistAxis1 = vec;
        vec.Set(_axisY.x, _axisY.y, _axisY.z);
        settings.mPlaneAxis1 = vec;

        readFrame(frameB);
        rvec.Set(_position.x, _position.y, _position.z);
        settings.mPosition2 = rvec;
        vec.Set(_axisX.x, _axisX.y, _axisX.z);
        settings.mTwistAxis2 = vec;
        vec.Set(_axisY.x, _axisY.y, _axisY.z);
        settings.mPlaneAxis2 = vec;
    },

    cast: world => world._jolt.SwingTwistConstraint,

    updateLimits(joint, settings) {
        const constraint = joint.nativeJoint;

        // the swing towards Y turns about the constraint's Z (normal) axis, which Jolt limits by
        // its plane half cone angle, and the swing towards Z turns about the Y (plane) axis,
        // limited by the normal half cone angle, as with Bullet's cone twist limits. Spans of
        // 180 degrees or more are free
        if (settings.enableLimits) {
            const swingY = settings.swingLimitY * math.DEG_TO_RAD;
            const swingZ = settings.swingLimitZ * math.DEG_TO_RAD;
            const twist = settings.twistLimit * math.DEG_TO_RAD;
            constraint.SetPlaneHalfConeAngle(Math.min(swingY, Math.PI));
            constraint.SetNormalHalfConeAngle(Math.min(swingZ, Math.PI));
            constraint.SetTwistMinAngle(Math.max(-twist, -Math.PI));
            constraint.SetTwistMaxAngle(Math.min(twist, Math.PI));
        } else {
            constraint.SetNormalHalfConeAngle(Math.PI);
            constraint.SetPlaneHalfConeAngle(Math.PI);
            constraint.SetTwistMinAngle(-Math.PI);
            constraint.SetTwistMaxAngle(Math.PI);
        }
    },

    maxLambda(joint) {
        const constraint = joint.nativeJoint;
        return Math.max(
            maxAbs3(constraint.GetTotalLambdaPosition()),
            Math.abs(constraint.GetTotalLambdaTwist()),
            Math.abs(constraint.GetTotalLambdaSwingY()),
            Math.abs(constraint.GetTotalLambdaSwingZ()),
            maxAbs3(constraint.GetTotalLambdaMotor())
        );
    }
};

const hingeJoint = {
    create: world => new world._jolt.HingeConstraintSettings(),

    setFrames(world, settings, frameA, frameB) {
        const rvec = world._rvec;
        const vec = world._vec;

        readFrame(frameA);
        rvec.Set(_position.x, _position.y, _position.z);
        settings.mPoint1 = rvec;
        vec.Set(_axisX.x, _axisX.y, _axisX.z);
        settings.mHingeAxis1 = vec;
        vec.Set(_axisY.x, _axisY.y, _axisY.z);
        settings.mNormalAxis1 = vec;

        readFrame(frameB);
        rvec.Set(_position.x, _position.y, _position.z);
        settings.mPoint2 = rvec;
        vec.Set(_axisX.x, _axisX.y, _axisX.z);
        settings.mHingeAxis2 = vec;
        vec.Set(_axisY.x, _axisY.y, _axisY.z);
        settings.mNormalAxis2 = vec;
    },

    cast: world => world._jolt.HingeConstraint,

    updateLimits(joint, settings) {
        if (settings.enableLimits) {
            const limits = flipAngular(settings.limits.x, settings.limits.y, _limits);
            joint.nativeJoint.SetLimits(limits.min, limits.max);
        } else {
            joint.nativeJoint.SetLimits(-Math.PI, Math.PI);
        }
    },

    updateMotor(joint, settings) {
        const Jolt = joint._world._jolt;
        const constraint = joint.nativeJoint;
        const maxTorque = settings.maxMotorForce;
        if (maxTorque > 0) {
            const motor = constraint.GetMotorSettings();
            motor.mMinTorqueLimit = -maxTorque;
            motor.mMaxTorqueLimit = maxTorque;
            constraint.SetTargetAngularVelocity(-settings.motorSpeed * math.DEG_TO_RAD);
            constraint.SetMotorState(Jolt.EMotorState_Velocity);
        } else {
            constraint.SetMotorState(Jolt.EMotorState_Off);
        }
    },

    maxLambda(joint) {
        const constraint = joint.nativeJoint;
        return Math.max(
            maxAbs3(constraint.GetTotalLambdaPosition()),
            maxAbs2(constraint.GetTotalLambdaRotation()),
            Math.abs(constraint.GetTotalLambdaRotationLimits()),
            Math.abs(constraint.GetTotalLambdaMotor())
        );
    }
};

const sliderJoint = {
    create(world) {
        const settings = new world._jolt.SliderConstraintSettings();
        settings.mAutoDetectPoint = false;
        return settings;
    },

    setFrames(world, settings, frameA, frameB) {
        const rvec = world._rvec;
        const vec = world._vec;

        readFrame(frameA);
        rvec.Set(_position.x, _position.y, _position.z);
        settings.mPoint1 = rvec;
        vec.Set(_axisX.x, _axisX.y, _axisX.z);
        settings.mSliderAxis1 = vec;
        vec.Set(_axisY.x, _axisY.y, _axisY.z);
        settings.mNormalAxis1 = vec;

        readFrame(frameB);
        rvec.Set(_position.x, _position.y, _position.z);
        settings.mPoint2 = rvec;
        vec.Set(_axisX.x, _axisX.y, _axisX.z);
        settings.mSliderAxis2 = vec;
        vec.Set(_axisY.x, _axisY.y, _axisY.z);
        settings.mNormalAxis2 = vec;
    },

    cast: world => world._jolt.SliderConstraint,

    updateLimits(joint, settings) {
        // rotation about the slide axis is always locked by Jolt's slider
        if (settings.enableLimits) {
            joint.nativeJoint.SetLimits(settings.limits.x, settings.limits.y);
        } else {
            joint.nativeJoint.SetLimits(-FLT_MAX, FLT_MAX);
        }
    },

    updateMotor(joint, settings) {
        const Jolt = joint._world._jolt;
        const constraint = joint.nativeJoint;
        const maxForce = settings.maxMotorForce;
        if (maxForce > 0) {
            const motor = constraint.GetMotorSettings();
            motor.mMinForceLimit = -maxForce;
            motor.mMaxForceLimit = maxForce;
            constraint.SetTargetVelocity(settings.motorSpeed);
            constraint.SetMotorState(Jolt.EMotorState_Velocity);
        } else {
            constraint.SetMotorState(Jolt.EMotorState_Off);
        }
    },

    maxLambda(joint) {
        const constraint = joint.nativeJoint;
        return Math.max(
            maxAbs2(constraint.GetTotalLambdaPosition()),
            Math.abs(constraint.GetTotalLambdaPositionLimits()),
            maxAbs3(constraint.GetTotalLambdaRotation()),
            Math.abs(constraint.GetTotalLambdaMotor())
        );
    }
};

const sixDofJoint = {
    create(world) {
        const Jolt = world._jolt;
        const settings = new Jolt.SixDOFConstraintSettings();
        // the pyramid swing limits each swing axis separately, allowing asymmetric ranges
        settings.mSwingType = Jolt.ESwingType_Pyramid;
        return settings;
    },

    setFrames: setSixDofFrames,

    cast: world => world._jolt.SixDOFConstraint,

    updateLimits(joint, settings) {
        const world = joint._world;
        const min = world._vec;
        const max = world._vec2;

        let r = dofRange(settings.linearMotionX, settings.linearLimitsX, false, _limits);
        const lx = r.min, ux = r.max;
        r = dofRange(settings.linearMotionY, settings.linearLimitsY, false, _limits);
        const ly = r.min, uy = r.max;
        r = dofRange(settings.linearMotionZ, settings.linearLimitsZ, false, _limits);
        min.Set(lx, ly, r.min);
        max.Set(ux, uy, r.max);
        joint.nativeJoint.SetTranslationLimits(min, max);

        r = dofRange(settings.angularMotionX, settings.angularLimitsX, true, _limits);
        const alx = r.min, aux = r.max;
        r = dofRange(settings.angularMotionY, settings.angularLimitsY, true, _limits);
        const aly = r.min, auy = r.max;
        r = dofRange(settings.angularMotionZ, settings.angularLimitsZ, true, _limits);
        min.Set(alx, aly, r.min);
        max.Set(aux, auy, r.max);
        joint.nativeJoint.SetRotationLimits(min, max);
    },

    updateSpring(joint, settings) {
        const world = joint._world;
        const constraint = joint.nativeJoint;
        const linStiffness = settings.linearStiffness;
        const linDamping = settings.linearDamping;
        const linEquilibrium = settings.linearEquilibrium;
        const angStiffness = settings.angularStiffness;
        const angDamping = settings.angularDamping;
        const angEquilibrium = settings.angularEquilibrium;

        // a spring acts on an axis when its stiffness component is greater than 0, as a position
        // motor towards the equilibrium: axes 0-2 are linear X/Y/Z, axes 3-5 angular X/Y/Z
        setSpring(joint, 0, linStiffness.x, linDamping.x);
        setSpring(joint, 1, linStiffness.y, linDamping.y);
        setSpring(joint, 2, linStiffness.z, linDamping.z);
        setSpring(joint, 3, angStiffness.x, angDamping.x);
        setSpring(joint, 4, angStiffness.y, angDamping.y);
        setSpring(joint, 5, angStiffness.z, angDamping.z);

        const vec = world._vec;
        vec.Set(linEquilibrium.x, linEquilibrium.y, linEquilibrium.z);
        constraint.SetTargetPositionCS(vec);

        // the angular equilibrium is the rotation of frame A relative to frame B as Bullet's
        // Euler angles, Rx Ry Rz. Jolt's target is the inverse, frame B relative to frame A,
        // Rz Ry Rx of the negated angles: the order setFromEulerAngles composes in
        _quat.setFromEulerAngles(-angEquilibrium.x, -angEquilibrium.y, -angEquilibrium.z);
        const quat = world._quat;
        quat.Set(_quat.x, _quat.y, _quat.z, _quat.w);
        constraint.SetTargetOrientationCS(quat);
    },

    maxLambda: sixDofMaxLambda
};

const jointImpls = {
    [JOINTTYPE_FIXED]: fixedJoint,
    [JOINTTYPE_BALL]: ballJoint,
    [JOINTTYPE_HINGE]: hingeJoint,
    [JOINTTYPE_SLIDER]: sliderJoint,
    [JOINTTYPE_6DOF]: sixDofJoint
};

/**
 * A Jolt joint (TwoBodyConstraint). Jolt has no breakable constraints, so the world compares the
 * impulses a breakable joint applied against its break impulse after every substep and disables
 * it once exceeded, which is how Bullet breaks constraints.
 *
 * @ignore
 */
class JoltPhysicsJoint extends PhysicsJoint {
    /**
     * @type {JoltPhysicsWorld}
     * @ignore
     */
    _world;

    /**
     * @type {string}
     * @private
     */
    _type;

    /**
     * @type {JoltPhysicsBody}
     * @ignore
     */
    _bodyA;

    /**
     * The second body, or null for a joint pinned to the world.
     *
     * @type {JoltPhysicsBody|null}
     * @ignore
     */
    _bodyB;

    /**
     * The rotation of the joint frame in body A's space, for spring axes.
     *
     * @ignore
     */
    _frameRotationA = new Quat();

    /** @private */
    _breakImpulse = Infinity;

    /** @private */
    _broken = false;

    /**
     * Whether the joint registered a pair of bodies that must not collide with the world.
     *
     * @ignore
     */
    _noCollision = false;

    /**
     * @param {JoltPhysicsWorld} world - The owning world.
     * @param {string} type - The joint type.
     * @param {object} constraint - The native constraint.
     * @param {JoltPhysicsBody} bodyA - The first body.
     * @param {JoltPhysicsBody|null} bodyB - The second body, or null.
     */
    constructor(world, type, constraint, bodyA, bodyB) {
        super();
        this._world = world;
        this._type = type;
        this.nativeJoint = constraint;
        this._bodyA = bodyA;
        this._bodyB = bodyB;
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

        const breakable = this._world._breakableJoints;
        if (Number.isFinite(impulse) && !this._broken) {
            breakable.add(this);
        } else {
            breakable.delete(this);
        }
    }

    isBroken() {
        return this._broken;
    }

    /**
     * Breaks the joint if it applied more than its break impulse in the last substep. Called by
     * the world for breakable joints.
     *
     * @ignore
     */
    _checkBreak() {
        if (jointImpls[this._type].maxLambda(this) >= this._breakImpulse) {
            this._broken = true;
            this.nativeJoint.SetEnabled(false);
            this._world._breakableJoints.delete(this);
        }
    }
}

/**
 * @param {JoltPhysicsWorld} world - The owning world.
 * @param {PhysicsJointDesc} desc - The joint descriptor.
 * @returns {JoltPhysicsJoint} The new joint, added to the simulation.
 */
function createJoint(world, desc) {
    const Jolt = world._jolt;
    const impl = jointImpls[desc.type];
    const settings = desc.settings;

    // world-pinned joints attach to Jolt's static body at the origin, so frame B is the joint's
    // world frame
    const bodyA = /** @type {JoltPhysicsBody} */ (desc.bodyA);
    const bodyB = /** @type {JoltPhysicsBody|null} */ (desc.bodyB);
    const nativeA = bodyA.nativeBody;
    const nativeB = bodyB ? bodyB.nativeBody : world._fixedToWorld;

    const constraintSettings = impl.create(world);
    constraintSettings.mSpace = Jolt.EConstraintSpace_LocalToBodyCOM;
    let native;
    if (impl.parentFirst) {
        impl.setFrames(world, constraintSettings, desc.frameB, desc.frameA);
        native = constraintSettings.Create(nativeB, nativeA);
    } else {
        impl.setFrames(world, constraintSettings, desc.frameA, desc.frameB);
        native = constraintSettings.Create(nativeA, nativeB);
    }
    Jolt.destroy(constraintSettings);

    const constraint = Jolt.castObject(native, impl.cast(world));
    constraint.AddRef();
    world._system.AddConstraint(constraint);

    const joint = new JoltPhysicsJoint(world, desc.type, constraint, bodyA, bodyB);
    _quat.setFromMat4(desc.frameA);
    joint._frameRotationA.copy(_quat);

    impl.updateLimits?.(joint, settings);
    impl.updateMotor?.(joint, settings);
    impl.updateSpring?.(joint, settings);

    if (Number.isFinite(settings.breakImpulse)) {
        joint.setBreakImpulse(settings.breakImpulse);
    }

    if (!desc.enableCollision && bodyB) {
        world._setPairCollision(bodyA, bodyB, false);
        joint._noCollision = true;
    }

    bodyA.activate();
    bodyB?.activate();

    return joint;
}

/**
 * @param {JoltPhysicsWorld} world - The owning world.
 * @param {JoltPhysicsJoint} joint - The joint to remove and destroy.
 */
function destroyJoint(world, joint) {
    world._breakableJoints.delete(joint);

    // only joints between two bodies disable collision
    if (joint._noCollision) {
        const bodyB = /** @type {JoltPhysicsBody} */ (joint._bodyB);
        world._setPairCollision(joint._bodyA, bodyB, true);
        joint._noCollision = false;
    }

    const constraint = joint.nativeJoint;
    world._system.RemoveConstraint(constraint);
    constraint.Release();
    joint.nativeJoint = null;
}

export { JoltPhysicsJoint, createJoint, destroyJoint };
