import { Debug } from '../../../core/debug.js';
import { math } from '../../../core/math/math.js';
import { Mat4 } from '../../../core/math/mat4.js';
import { Quat } from '../../../core/math/quat.js';
import { Vec2 } from '../../../core/math/vec2.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { GraphNode } from '../../../scene/graph-node.js';
import { Component } from '../component.js';
import { BODYTYPE_DYNAMIC } from '../rigid-body/constants.js';
import {
    JOINTTYPE_6DOF, JOINTTYPE_BALL, JOINTTYPE_FIXED, JOINTTYPE_HINGE, JOINTTYPE_SLIDER,
    MOTION_FREE, MOTION_LIMITED, MOTION_LOCKED
} from './constants.js';

/**
 * @import { Entity } from '../../entity.js'
 * @import { EventHandle } from '../../../core/event-handle.js'
 */

const _mat = new Mat4();
const _jointMat = new Mat4();
const _vec3 = new Vec3();
const _vec3b = new Vec3();
const _quat = new Quat();

// anchor separation, in meters, beyond which a constraint that bullet has internally broken is
// considered detectably broken - far above the violation a live constraint exhibits under load
const _breakSeparation = 0.2;

// assigns an incoming Vec2 or [x, y] array to target, returning true if it changed
function setVec2(target, value) {
    const x = value instanceof Vec2 ? value.x : value[0];
    const y = value instanceof Vec2 ? value.y : value[1];
    if (target.x !== x || target.y !== y) {
        target.set(x, y);
        return true;
    }
    return false;
}

// assigns an incoming Vec3 or [x, y, z] array to target, returning true if it changed
function setVec3(target, value) {
    const x = value instanceof Vec3 ? value.x : value[0];
    const y = value instanceof Vec3 ? value.y : value[1];
    const z = value instanceof Vec3 ? value.z : value[2];
    if (target.x !== x || target.y !== y || target.z !== z) {
        target.set(x, y, z);
        return true;
    }
    return false;
}

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

// Per-type joint backends, mapping the component's properties onto the most appropriate bullet
// constraint. Methods other than create are optional - a type without a motor simply omits
// updateMotor. axisCorrection, where present, rotates both joint frames so that the constraint's
// native axis lands on the joint entity's X axis.

const fixedJoint = {
    create(bodyA, bodyB, frameA, frameB) {
        return new Ammo.btFixedConstraint(bodyA, bodyB, frameA, frameB);
    }
};

const ballJoint = {
    create(bodyA, bodyB, frameA, frameB) {
        return new Ammo.btConeTwistConstraint(bodyA, bodyB, frameA, frameB);
    },

    updateLimits(joint) {
        const constraint = joint._constraint;

        // setLimit indices: 5 = swing span 1, limiting rotation about the constraint's Z axis
        // (i.e. swing towards Y), 4 = swing span 2, limiting rotation about Y (swing towards Z),
        // 3 = twist span about X
        if (joint.enableLimits) {
            constraint.setLimit(5, joint.swingLimitY * math.DEG_TO_RAD);
            constraint.setLimit(4, joint.swingLimitZ * math.DEG_TO_RAD);
            constraint.setLimit(3, joint.twistLimit * math.DEG_TO_RAD);
        } else {
            // bullet treats spans of this magnitude as unlimited
            constraint.setLimit(5, 1e30);
            constraint.setLimit(4, 1e30);
            constraint.setLimit(3, 1e30);
        }
    }
};

const hingeJoint = {
    // bullet hinges rotate about frame Z - map the joint's X axis onto it
    axisCorrection: new Mat4().setFromAxisAngle(Vec3.UP, 90),

    create(bodyA, bodyB, frameA, frameB) {
        return new Ammo.btHingeConstraint(bodyA, bodyB, frameA, frameB, false);
    },

    updateLimits(joint) {
        const constraint = joint._constraint;
        if (joint.enableLimits) {
            const limits = joint.limits;
            // the remaining arguments are bullet's default softness, bias and relaxation factors
            constraint.setLimit(limits.x * math.DEG_TO_RAD, limits.y * math.DEG_TO_RAD, 0.9, 0.3, 1);
        } else {
            // lower > upper leaves the rotation unconstrained
            constraint.setLimit(1, -1, 0.9, 0.3, 1);
        }
    },

    updateMotor(joint) {
        // bullet's hinge motor clamp is an impulse per simulation step, so scale the torque by
        // the fixed timestep
        const maxImpulse = joint.maxMotorForce * joint.system.app.systems.rigidbody.fixedTimeStep;
        joint._constraint.enableAngularMotor(joint.maxMotorForce > 0, joint.motorSpeed * math.DEG_TO_RAD, maxImpulse);
    }
};

const sliderJoint = {
    create(bodyA, bodyB, frameA, frameB) {
        // the final argument is useLinearReferenceFrameA - travel is measured in frame A's space
        return new Ammo.btSliderConstraint(bodyA, bodyB, frameA, frameB, true);
    },

    updateLimits(joint) {
        const constraint = joint._constraint;
        if (joint.enableLimits) {
            const limits = joint.limits;
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

    updateMotor(joint) {
        const constraint = joint._constraint;
        constraint.setPoweredLinMotor(joint.maxMotorForce > 0);
        constraint.setTargetLinMotorVelocity(joint.motorSpeed);
        constraint.setMaxLinMotorForce(joint.maxMotorForce);
    }
};

const sixDofJoint = {
    create(bodyA, bodyB, frameA, frameB) {
        // the final argument is useLinearReferenceFrameA - linear limits are measured in frame
        // A's space
        return new Ammo.btGeneric6DofSpringConstraint(bodyA, bodyB, frameA, frameB, true);
    },

    updateLimits(joint) {
        const constraint = joint._constraint;

        let dof = dofLimits(joint.linearMotionX, joint.linearLimitsX, 1);
        const lx = dof.lower, ux = dof.upper;
        dof = dofLimits(joint.linearMotionY, joint.linearLimitsY, 1);
        const ly = dof.lower, uy = dof.upper;
        dof = dofLimits(joint.linearMotionZ, joint.linearLimitsZ, 1);
        const lz = dof.lower, uz = dof.upper;

        const limits = new Ammo.btVector3(lx, ly, lz);
        constraint.setLinearLowerLimit(limits);
        limits.setValue(ux, uy, uz);
        constraint.setLinearUpperLimit(limits);

        dof = dofLimits(joint.angularMotionX, joint.angularLimitsX, math.DEG_TO_RAD);
        const alx = dof.lower, aux = dof.upper;
        dof = dofLimits(joint.angularMotionY, joint.angularLimitsY, math.DEG_TO_RAD);
        const aly = dof.lower, auy = dof.upper;
        dof = dofLimits(joint.angularMotionZ, joint.angularLimitsZ, math.DEG_TO_RAD);
        const alz = dof.lower, auz = dof.upper;

        limits.setValue(alx, aly, alz);
        constraint.setAngularLowerLimit(limits);
        limits.setValue(aux, auy, auz);
        constraint.setAngularUpperLimit(limits);
        Ammo.destroy(limits);
    },

    updateSpring(joint) {
        const constraint = joint._constraint;
        const rad = math.DEG_TO_RAD;
        const linStiffness = joint.linearStiffness;
        const linDamping = joint.linearDamping;
        const linEquilibrium = joint.linearEquilibrium;
        const angStiffness = joint.angularStiffness;
        const angDamping = joint.angularDamping;
        const angEquilibrium = joint.angularEquilibrium;

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
 * The JointComponent constrains the relative motion of two rigid bodies. The entity holding the
 * joint component is not itself constrained - instead, its world transform defines the joint
 * frame: the anchor point and axes that the constraint operates about. The constrained bodies are
 * assigned via {@link entityA} and {@link entityB}, both of which must have a
 * {@link RigidBodyComponent}. If {@link entityB} is null, {@link entityA} is constrained to a
 * fixed point in world space.
 *
 * A joint's primary axis is the joint entity's local X axis: a hinge rotates about X, a slider
 * translates along X and a ball joint twists about X. To aim a joint, rotate the joint entity. A
 * common pattern is to parent the joint entity to {@link entityA} at the pivot point. For 6dof
 * joints, each degree of freedom measures the offset of {@link entityB} (or of the world anchor
 * when {@link entityB} is null) relative to {@link entityA}, along the joint's axes.
 *
 * The joint frames are captured when the underlying constraint is created - typically when the
 * component is enabled and both bodies are present in the physics simulation. Moving the joint
 * entity afterwards has no effect on an existing constraint. Call {@link refreshFrames} to
 * re-capture the frames from the current world transforms. Entity scale is ignored, matching the
 * behavior of rigid bodies.
 *
 * Many properties apply only to specific joint types; each one documents the types it affects,
 * and properties without such a note (for example {@link entityA}, {@link enableCollision} and
 * {@link breakImpulse}) apply to all types.
 *
 * To add a JointComponent to an {@link Entity}, use {@link Entity#addComponent}:
 *
 * ```javascript
 * // Create a door hinge: the joint entity's position is the hinge point and its
 * // local X axis (rotated here to point up) is the hinge axis
 * const hinge = new pc.Entity('hinge');
 * hinge.setPosition(1, 1, 0);
 * hinge.setEulerAngles(0, 0, 90);
 * hinge.addComponent('joint', {
 *     type: pc.JOINTTYPE_HINGE,
 *     entityA: door,
 *     entityB: doorFrame,
 *     enableLimits: true,
 *     limits: new pc.Vec2(0, 110)
 * });
 * app.root.addChild(hinge);
 * ```
 *
 * @hideconstructor
 * @category Physics
 * @alpha
 */
class JointComponent extends Component {
    /**
     * Fired when the applied impulse on the joint exceeds {@link breakImpulse} and the constraint
     * breaks. The broken joint no longer constrains its bodies and {@link isBroken} becomes true.
     * Call {@link refreshFrames} to re-attach it. Note that on ammo builds that expose no
     * constraint state, breakage of 6dof joints cannot be detected, so this event does not fire
     * for them - other joint types are unaffected.
     *
     * @event
     * @example
     * entity.joint.on('break', () => {
     *     console.log('The joint broke');
     * });
     */
    static EVENT_BREAK = 'break';

    /**
     * The Ammo constraint, when created.
     *
     * @type {object|null}
     * @private
     */
    _constraint = null;

    /** @private */
    _type = JOINTTYPE_FIXED;

    /**
     * @type {Entity|null}
     * @private
     */
    _entityA = null;

    /**
     * @type {Entity|null}
     * @private
     */
    _entityB = null;

    /** @private */
    _enableCollision = false;

    /** @private */
    _breakImpulse = Infinity;

    /** @private */
    _broken = false;

    /** @private */
    _initialized = false;

    // hinge, slider and ball

    /** @private */
    _enableLimits = false;

    /** @private */
    _limits = new Vec2(-45, 45);

    /** @private */
    _motorSpeed = 0;

    /** @private */
    _maxMotorForce = 0;

    /** @private */
    _swingLimitY = 45;

    /** @private */
    _swingLimitZ = 45;

    /** @private */
    _twistLimit = 20;

    // 6dof

    /** @private */
    _linearMotionX = MOTION_LOCKED;

    /** @private */
    _linearMotionY = MOTION_LOCKED;

    /** @private */
    _linearMotionZ = MOTION_LOCKED;

    /** @private */
    _linearLimitsX = new Vec2();

    /** @private */
    _linearLimitsY = new Vec2();

    /** @private */
    _linearLimitsZ = new Vec2();

    /** @private */
    _linearStiffness = new Vec3();

    /** @private */
    _linearDamping = new Vec3(1, 1, 1);

    /** @private */
    _linearEquilibrium = new Vec3();

    /** @private */
    _angularMotionX = MOTION_LOCKED;

    /** @private */
    _angularMotionY = MOTION_LOCKED;

    /** @private */
    _angularMotionZ = MOTION_LOCKED;

    /** @private */
    _angularLimitsX = new Vec2();

    /** @private */
    _angularLimitsY = new Vec2();

    /** @private */
    _angularLimitsZ = new Vec2();

    /** @private */
    _angularStiffness = new Vec3();

    /** @private */
    _angularDamping = new Vec3(1, 1, 1);

    /** @private */
    _angularEquilibrium = new Vec3();

    // event bookkeeping

    /**
     * @type {EventHandle|null}
     * @private
     */
    _evtEntityADestroy = null;

    /**
     * @type {EventHandle|null}
     * @private
     */
    _evtEntityBDestroy = null;

    /**
     * @type {EventHandle|null}
     * @private
     */
    _evtSimEnabledA = null;

    /**
     * @type {EventHandle|null}
     * @private
     */
    _evtSimEnabledB = null;

    /**
     * @type {EventHandle[]}
     * @private
     */
    _evtBodyTeardown = [];

    // joint frame anchors captured at constraint creation, used for break detection on ammo
    // builds that expose no constraint state

    /** @private */
    _anchorA = new Vec3();

    /** @private */
    _anchorB = new Vec3();

    /** @private */
    _axisA = new Vec3();

    /**
     * Sets the type of joint. Can be:
     *
     * - {@link JOINTTYPE_FIXED}: rigidly locks the bodies together.
     * - {@link JOINTTYPE_BALL}: ball and socket - free rotation about the anchor point, with
     * optional swing and twist limits.
     * - {@link JOINTTYPE_HINGE}: rotation about the joint's X axis, with optional limits and
     * motor.
     * - {@link JOINTTYPE_SLIDER}: translation along the joint's X axis, with optional limits and
     * motor.
     * - {@link JOINTTYPE_6DOF}: each linear and angular axis is independently locked, limited or
     * free, with optional springs.
     *
     * Defaults to {@link JOINTTYPE_FIXED}.
     *
     * @type {JOINTTYPE_FIXED|JOINTTYPE_BALL|JOINTTYPE_HINGE|JOINTTYPE_SLIDER|JOINTTYPE_6DOF}
     */
    set type(type) {
        if (this._type !== type) {
            if (!jointImpls[type]) {
                Debug.warn(`JointComponent: invalid joint type '${type}'`);
                return;
            }
            this._destroyConstraint();
            this._broken = false;
            this._type = type;
            this._tryCreateConstraint();
        }
    }

    /**
     * Gets the type of joint.
     *
     * @type {JOINTTYPE_FIXED|JOINTTYPE_BALL|JOINTTYPE_HINGE|JOINTTYPE_SLIDER|JOINTTYPE_6DOF}
     */
    get type() {
        return this._type;
    }

    /**
     * Sets the first entity constrained by this joint. The entity must have a
     * {@link RigidBodyComponent}. Can be set to an {@link Entity} or the GUID of an entity. The
     * constraint is created once both constrained entities have rigid bodies in the simulation.
     *
     * @type {Entity|string|null}
     */
    set entityA(arg) {
        this._setJointEntity('_entityA', '_evtEntityADestroy', arg);
    }

    /**
     * Gets the first entity constrained by this joint.
     *
     * @type {Entity|null}
     */
    get entityA() {
        return this._entityA;
    }

    /**
     * Sets the second entity constrained by this joint. The entity must have a
     * {@link RigidBodyComponent}. Can be set to an {@link Entity} or the GUID of an entity. If
     * null, {@link entityA} is constrained to a fixed point in world space instead. Defaults to
     * null.
     *
     * @type {Entity|string|null}
     */
    set entityB(arg) {
        this._setJointEntity('_entityB', '_evtEntityBDestroy', arg);
    }

    /**
     * Gets the second entity constrained by this joint.
     *
     * @type {Entity|null}
     */
    get entityB() {
        return this._entityB;
    }

    /**
     * Sets whether the two constrained bodies can collide with each other. Defaults to false.
     *
     * @type {boolean}
     */
    set enableCollision(enableCollision) {
        if (this._enableCollision !== enableCollision) {
            this._destroyConstraint();
            this._enableCollision = enableCollision;
            this._tryCreateConstraint();
        }
    }

    /**
     * Gets whether the two constrained bodies can collide with each other.
     *
     * @type {boolean}
     */
    get enableCollision() {
        return this._enableCollision;
    }

    /**
     * Sets the impulse threshold, in Newton seconds, above which the joint breaks. A broken joint
     * no longer constrains its bodies, fires the 'break' event and has {@link isBroken} set to
     * true. As a rule of thumb, a steady force breaks the joint when force × simulation timestep
     * exceeds this value. Defaults to Infinity (unbreakable).
     *
     * @type {number}
     */
    set breakImpulse(impulse) {
        if (this._breakImpulse !== impulse) {
            this._breakImpulse = impulse;

            const constraint = this._constraint;
            if (constraint) {
                const breakable = Number.isFinite(impulse);
                constraint.setBreakingImpulseThreshold(breakable ? impulse : Number.MAX_VALUE);
                constraint.enableFeedback(breakable);
                if (breakable) {
                    this.system._breakable.add(this);
                } else {
                    this.system._breakable.delete(this);
                }
            }
        }
    }

    /**
     * Gets the impulse threshold above which the joint breaks.
     *
     * @type {number}
     */
    get breakImpulse() {
        return this._breakImpulse;
    }

    /**
     * The underlying Ammo (Bullet) constraint, or null if it has not been created or has broken.
     * An unsupported escape hatch for native functionality the component does not yet expose - it
     * is deliberately kept off the public, backend-agnostic API surface, mirroring
     * {@link RigidBodyComponent#body}.
     *
     * @type {object|null}
     * @ignore
     */
    get constraint() {
        return this._constraint;
    }

    /**
     * Gets whether the joint has broken as a result of the applied impulse exceeding
     * {@link breakImpulse}. A broken joint is re-armed by calling {@link refreshFrames}, toggling
     * {@link Component#enabled} or changing {@link type}, {@link entityA} or {@link entityB}.
     *
     * @type {boolean}
     */
    get isBroken() {
        return this._broken;
    }

    /**
     * Sets whether the joint's limits are enabled. For hinge joints, this limits rotation about
     * the joint's X axis to {@link limits}. For slider joints, this limits travel along the
     * joint's X axis to {@link limits}. For ball joints, this limits rotation to
     * {@link swingLimitY}, {@link swingLimitZ} and {@link twistLimit}. Not used by fixed and 6dof
     * joints. Defaults to false.
     *
     * @type {boolean}
     */
    set enableLimits(arg) {
        if (this._enableLimits !== arg) {
            this._enableLimits = arg;
            this._updateLimits();
        }
    }

    /**
     * Gets whether the joint's limits are enabled.
     *
     * @type {boolean}
     */
    get enableLimits() {
        return this._enableLimits;
    }

    /**
     * Sets the lower and upper limit of the joint's primary degree of freedom. For hinge joints,
     * these are angles of rotation about the joint's X axis, in degrees; for slider joints,
     * distances along the joint's X axis, in meters. Only used by hinge and slider joints, when
     * {@link enableLimits} is true. (Ball joints limit motion with {@link swingLimitY},
     * {@link swingLimitZ} and {@link twistLimit}; 6dof joints use {@link linearLimitsX} and
     * {@link angularLimitsX} etc.) Defaults to `[-45, 45]`.
     *
     * @type {Vec2}
     */
    set limits(arg) {
        if (setVec2(this._limits, arg)) {
            this._updateLimits();
        }
    }

    /**
     * Gets the lower and upper limit of the joint's primary degree of freedom.
     *
     * @type {Vec2}
     */
    get limits() {
        return this._limits;
    }

    /**
     * Sets the target speed the motor drives towards. For hinge joints, this is an angular speed
     * in degrees per second; for slider joints, a linear speed in meters per second. The motor is
     * active only while {@link maxMotorForce} is greater than 0; with a target speed of 0 and a
     * positive force the motor acts as a brake, holding the joint at rest. Only used by hinge and
     * slider joints. Defaults to 0.
     *
     * @type {number}
     */
    set motorSpeed(arg) {
        if (this._motorSpeed !== arg) {
            this._motorSpeed = arg;
            this._updateMotor();
        }
    }

    /**
     * Gets the target speed the motor drives towards.
     *
     * @type {number}
     */
    get motorSpeed() {
        return this._motorSpeed;
    }

    /**
     * Sets the maximum force the motor can apply to reach {@link motorSpeed}. For hinge joints,
     * this is a torque in Newton meters; for slider joints, a force in Newtons. The motor is
     * disabled while this is 0, so set it greater than 0 to engage the motor. Only used by hinge
     * and slider joints. Defaults to 0.
     *
     * @type {number}
     */
    set maxMotorForce(arg) {
        if (this._maxMotorForce !== arg) {
            this._maxMotorForce = arg;
            this._updateMotor();
        }
    }

    /**
     * Gets the maximum force the joint's motor can apply.
     *
     * @type {number}
     */
    get maxMotorForce() {
        return this._maxMotorForce;
    }

    /**
     * Sets the maximum swing of a ball joint towards its Y axis, in degrees, measured as a
     * half-angle either side of the joint's X axis. Only used by ball joints when
     * {@link enableLimits} is true. Defaults to 45.
     *
     * @type {number}
     */
    set swingLimitY(arg) {
        if (this._swingLimitY !== arg) {
            this._swingLimitY = arg;
            this._updateLimits();
        }
    }

    /**
     * Gets the maximum swing of a ball joint towards its Y axis.
     *
     * @type {number}
     */
    get swingLimitY() {
        return this._swingLimitY;
    }

    /**
     * Sets the maximum swing of a ball joint towards its Z axis, in degrees, measured as a
     * half-angle either side of the joint's X axis. Only used by ball joints when
     * {@link enableLimits} is true. Defaults to 45.
     *
     * @type {number}
     */
    set swingLimitZ(arg) {
        if (this._swingLimitZ !== arg) {
            this._swingLimitZ = arg;
            this._updateLimits();
        }
    }

    /**
     * Gets the maximum swing of a ball joint towards its Z axis.
     *
     * @type {number}
     */
    get swingLimitZ() {
        return this._swingLimitZ;
    }

    /**
     * Sets the maximum twist of a ball joint about its X axis, in degrees, measured as a
     * half-angle either side of the rest orientation. Only used by ball joints when
     * {@link enableLimits} is true. Defaults to 20.
     *
     * @type {number}
     */
    set twistLimit(arg) {
        if (this._twistLimit !== arg) {
            this._twistLimit = arg;
            this._updateLimits();
        }
    }

    /**
     * Gets the maximum twist of a ball joint about its X axis.
     *
     * @type {number}
     */
    get twistLimit() {
        return this._twistLimit;
    }

    /**
     * Sets the type of motion allowed for translation along the joint's X axis. Can be
     * {@link MOTION_LOCKED}, {@link MOTION_LIMITED} or {@link MOTION_FREE}. Only used by 6dof
     * joints. Defaults to {@link MOTION_LOCKED}.
     *
     * @type {MOTION_FREE|MOTION_LIMITED|MOTION_LOCKED}
     */
    set linearMotionX(arg) {
        if (this._linearMotionX !== arg) {
            this._linearMotionX = arg;
            this._updateLimits();
        }
    }

    /**
     * Gets the type of motion allowed for translation along the joint's X axis.
     *
     * @type {MOTION_FREE|MOTION_LIMITED|MOTION_LOCKED}
     */
    get linearMotionX() {
        return this._linearMotionX;
    }

    /**
     * Sets the type of motion allowed for translation along the joint's Y axis. Can be
     * {@link MOTION_LOCKED}, {@link MOTION_LIMITED} or {@link MOTION_FREE}. Only used by 6dof
     * joints. Defaults to {@link MOTION_LOCKED}.
     *
     * @type {MOTION_FREE|MOTION_LIMITED|MOTION_LOCKED}
     */
    set linearMotionY(arg) {
        if (this._linearMotionY !== arg) {
            this._linearMotionY = arg;
            this._updateLimits();
        }
    }

    /**
     * Gets the type of motion allowed for translation along the joint's Y axis.
     *
     * @type {MOTION_FREE|MOTION_LIMITED|MOTION_LOCKED}
     */
    get linearMotionY() {
        return this._linearMotionY;
    }

    /**
     * Sets the type of motion allowed for translation along the joint's Z axis. Can be
     * {@link MOTION_LOCKED}, {@link MOTION_LIMITED} or {@link MOTION_FREE}. Only used by 6dof
     * joints. Defaults to {@link MOTION_LOCKED}.
     *
     * @type {MOTION_FREE|MOTION_LIMITED|MOTION_LOCKED}
     */
    set linearMotionZ(arg) {
        if (this._linearMotionZ !== arg) {
            this._linearMotionZ = arg;
            this._updateLimits();
        }
    }

    /**
     * Gets the type of motion allowed for translation along the joint's Z axis.
     *
     * @type {MOTION_FREE|MOTION_LIMITED|MOTION_LOCKED}
     */
    get linearMotionZ() {
        return this._linearMotionZ;
    }

    /**
     * Sets the lower and upper limit of translation along the joint's X axis, in meters. Only
     * used by 6dof joints when {@link linearMotionX} is {@link MOTION_LIMITED}. Defaults to
     * `[0, 0]`.
     *
     * @type {Vec2}
     */
    set linearLimitsX(arg) {
        if (setVec2(this._linearLimitsX, arg)) {
            this._updateLimits();
        }
    }

    /**
     * Gets the lower and upper limit of translation along the joint's X axis.
     *
     * @type {Vec2}
     */
    get linearLimitsX() {
        return this._linearLimitsX;
    }

    /**
     * Sets the lower and upper limit of translation along the joint's Y axis, in meters. Only
     * used by 6dof joints when {@link linearMotionY} is {@link MOTION_LIMITED}. Defaults to
     * `[0, 0]`.
     *
     * @type {Vec2}
     */
    set linearLimitsY(arg) {
        if (setVec2(this._linearLimitsY, arg)) {
            this._updateLimits();
        }
    }

    /**
     * Gets the lower and upper limit of translation along the joint's Y axis.
     *
     * @type {Vec2}
     */
    get linearLimitsY() {
        return this._linearLimitsY;
    }

    /**
     * Sets the lower and upper limit of translation along the joint's Z axis, in meters. Only
     * used by 6dof joints when {@link linearMotionZ} is {@link MOTION_LIMITED}. Defaults to
     * `[0, 0]`.
     *
     * @type {Vec2}
     */
    set linearLimitsZ(arg) {
        if (setVec2(this._linearLimitsZ, arg)) {
            this._updateLimits();
        }
    }

    /**
     * Gets the lower and upper limit of translation along the joint's Z axis.
     *
     * @type {Vec2}
     */
    get linearLimitsZ() {
        return this._linearLimitsZ;
    }

    /**
     * Sets the stiffness of the springs acting on translation along the joint's X, Y and Z axes.
     * A spring acts on an axis when its stiffness component is greater than 0. Only used by 6dof
     * joints. Defaults to `[0, 0, 0]` (no springs).
     *
     * @type {Vec3}
     */
    set linearStiffness(arg) {
        if (setVec3(this._linearStiffness, arg)) {
            this._updateSpring();
        }
    }

    /**
     * Gets the stiffness of the springs acting on translation along the joint's X, Y and Z axes.
     *
     * @type {Vec3}
     */
    get linearStiffness() {
        return this._linearStiffness;
    }

    /**
     * Sets the damping of the springs acting on translation along the joint's X, Y and Z axes.
     * Only used by 6dof joints. Defaults to `[1, 1, 1]`.
     *
     * @type {Vec3}
     */
    set linearDamping(arg) {
        if (setVec3(this._linearDamping, arg)) {
            this._updateSpring();
        }
    }

    /**
     * Gets the damping of the springs acting on translation along the joint's X, Y and Z axes.
     *
     * @type {Vec3}
     */
    get linearDamping() {
        return this._linearDamping;
    }

    /**
     * Sets the rest positions of the springs acting on translation along the joint's X, Y and Z
     * axes, in meters. Only used by 6dof joints. Defaults to `[0, 0, 0]`.
     *
     * @type {Vec3}
     */
    set linearEquilibrium(arg) {
        if (setVec3(this._linearEquilibrium, arg)) {
            this._updateSpring();
        }
    }

    /**
     * Gets the rest positions of the springs acting on translation along the joint's X, Y and Z
     * axes.
     *
     * @type {Vec3}
     */
    get linearEquilibrium() {
        return this._linearEquilibrium;
    }

    /**
     * Sets the type of motion allowed for rotation about the joint's X axis. Can be
     * {@link MOTION_LOCKED}, {@link MOTION_LIMITED} or {@link MOTION_FREE}. Only used by 6dof
     * joints. Defaults to {@link MOTION_LOCKED}.
     *
     * @type {MOTION_FREE|MOTION_LIMITED|MOTION_LOCKED}
     */
    set angularMotionX(arg) {
        if (this._angularMotionX !== arg) {
            this._angularMotionX = arg;
            this._updateLimits();
        }
    }

    /**
     * Gets the type of motion allowed for rotation about the joint's X axis.
     *
     * @type {MOTION_FREE|MOTION_LIMITED|MOTION_LOCKED}
     */
    get angularMotionX() {
        return this._angularMotionX;
    }

    /**
     * Sets the type of motion allowed for rotation about the joint's Y axis. Can be
     * {@link MOTION_LOCKED}, {@link MOTION_LIMITED} or {@link MOTION_FREE}. Only used by 6dof
     * joints. Defaults to {@link MOTION_LOCKED}.
     *
     * @type {MOTION_FREE|MOTION_LIMITED|MOTION_LOCKED}
     */
    set angularMotionY(arg) {
        if (this._angularMotionY !== arg) {
            this._angularMotionY = arg;
            this._updateLimits();
        }
    }

    /**
     * Gets the type of motion allowed for rotation about the joint's Y axis.
     *
     * @type {MOTION_FREE|MOTION_LIMITED|MOTION_LOCKED}
     */
    get angularMotionY() {
        return this._angularMotionY;
    }

    /**
     * Sets the type of motion allowed for rotation about the joint's Z axis. Can be
     * {@link MOTION_LOCKED}, {@link MOTION_LIMITED} or {@link MOTION_FREE}. Only used by 6dof
     * joints. Defaults to {@link MOTION_LOCKED}.
     *
     * @type {MOTION_FREE|MOTION_LIMITED|MOTION_LOCKED}
     */
    set angularMotionZ(arg) {
        if (this._angularMotionZ !== arg) {
            this._angularMotionZ = arg;
            this._updateLimits();
        }
    }

    /**
     * Gets the type of motion allowed for rotation about the joint's Z axis.
     *
     * @type {MOTION_FREE|MOTION_LIMITED|MOTION_LOCKED}
     */
    get angularMotionZ() {
        return this._angularMotionZ;
    }

    /**
     * Sets the lower and upper limit of rotation about the joint's X axis, in degrees. For
     * stability, keep the limits within -180 and 180 degrees. Only used by 6dof joints when
     * {@link angularMotionX} is {@link MOTION_LIMITED}. Defaults to `[0, 0]`.
     *
     * @type {Vec2}
     */
    set angularLimitsX(arg) {
        if (setVec2(this._angularLimitsX, arg)) {
            this._updateLimits();
        }
    }

    /**
     * Gets the lower and upper limit of rotation about the joint's X axis.
     *
     * @type {Vec2}
     */
    get angularLimitsX() {
        return this._angularLimitsX;
    }

    /**
     * Sets the lower and upper limit of rotation about the joint's Y axis, in degrees. For
     * stability, keep the limits within -90 and 90 degrees. Only used by 6dof joints when
     * {@link angularMotionY} is {@link MOTION_LIMITED}. Defaults to `[0, 0]`.
     *
     * @type {Vec2}
     */
    set angularLimitsY(arg) {
        if (setVec2(this._angularLimitsY, arg)) {
            this._updateLimits();
        }
    }

    /**
     * Gets the lower and upper limit of rotation about the joint's Y axis.
     *
     * @type {Vec2}
     */
    get angularLimitsY() {
        return this._angularLimitsY;
    }

    /**
     * Sets the lower and upper limit of rotation about the joint's Z axis, in degrees. For
     * stability, keep the limits within -180 and 180 degrees. Only used by 6dof joints when
     * {@link angularMotionZ} is {@link MOTION_LIMITED}. Defaults to `[0, 0]`.
     *
     * @type {Vec2}
     */
    set angularLimitsZ(arg) {
        if (setVec2(this._angularLimitsZ, arg)) {
            this._updateLimits();
        }
    }

    /**
     * Gets the lower and upper limit of rotation about the joint's Z axis.
     *
     * @type {Vec2}
     */
    get angularLimitsZ() {
        return this._angularLimitsZ;
    }

    /**
     * Sets the stiffness of the springs acting on rotation about the joint's X, Y and Z axes. A
     * spring acts on an axis when its stiffness component is greater than 0. Only used by 6dof
     * joints. Defaults to `[0, 0, 0]` (no springs).
     *
     * @type {Vec3}
     */
    set angularStiffness(arg) {
        if (setVec3(this._angularStiffness, arg)) {
            this._updateSpring();
        }
    }

    /**
     * Gets the stiffness of the springs acting on rotation about the joint's X, Y and Z axes.
     *
     * @type {Vec3}
     */
    get angularStiffness() {
        return this._angularStiffness;
    }

    /**
     * Sets the damping of the springs acting on rotation about the joint's X, Y and Z axes. Only
     * used by 6dof joints. Defaults to `[1, 1, 1]`.
     *
     * @type {Vec3}
     */
    set angularDamping(arg) {
        if (setVec3(this._angularDamping, arg)) {
            this._updateSpring();
        }
    }

    /**
     * Gets the damping of the springs acting on rotation about the joint's X, Y and Z axes.
     *
     * @type {Vec3}
     */
    get angularDamping() {
        return this._angularDamping;
    }

    /**
     * Sets the rest angles of the springs acting on rotation about the joint's X, Y and Z axes,
     * in degrees. Only used by 6dof joints. Defaults to `[0, 0, 0]`.
     *
     * @type {Vec3}
     */
    set angularEquilibrium(arg) {
        if (setVec3(this._angularEquilibrium, arg)) {
            this._updateSpring();
        }
    }

    /**
     * Gets the rest angles of the springs acting on rotation about the joint's X, Y and Z axes.
     *
     * @type {Vec3}
     */
    get angularEquilibrium() {
        return this._angularEquilibrium;
    }

    /**
     * Destroys and recreates the underlying constraint, re-capturing the joint frames from the
     * current world transforms of the joint entity, {@link entityA} and {@link entityB}. Call
     * this after moving the joint entity to re-anchor the joint, or to re-attach a joint that has
     * broken.
     */
    refreshFrames() {
        this._destroyConstraint();
        this._broken = false;
        this._tryCreateConstraint();
    }

    /**
     * Resolves an entity reference, accepting an Entity instance or a GUID string, and tracks the
     * destruction of the referenced entity.
     *
     * @param {'_entityA'|'_entityB'} prop - The backing field to assign.
     * @param {'_evtEntityADestroy'|'_evtEntityBDestroy'} evtProp - The destroy event handle field.
     * @param {Entity|string|null} arg - The entity, entity GUID or null.
     * @private
     */
    _setJointEntity(prop, evtProp, arg) {
        let entity;
        if (arg instanceof GraphNode) {
            entity = arg;
        } else if (typeof arg === 'string') {
            entity = this.system.app.getEntityFromIndex(arg) ?? null;
        } else {
            entity = null;
        }

        if (this[prop] === entity) {
            return;
        }

        this._destroyConstraint();

        this[evtProp]?.off();
        this[evtProp] = null;

        this[prop] = entity;

        if (entity) {
            this[evtProp] = entity.once('destroy', () => {
                this[evtProp] = null;
                this[prop] = null;
                this._destroyConstraint();
            });
        }

        Debug.call(() => {
            if (this._entityA && this._entityA === this._entityB) {
                Debug.warn('JointComponent: entityA and entityB must be different entities.', this);
            }
        });

        this._broken = false;
        this._tryCreateConstraint();
    }

    /**
     * @param {Entity} entity - The entity to check.
     * @returns {boolean} True if the entity has a rigid body that is present in the simulation.
     * @private
     */
    _isBodyReady(entity) {
        const rigidbody = entity.rigidbody;
        return !!(rigidbody && rigidbody.body && rigidbody._simulationEnabled);
    }

    /** @private */
    _subscribeBodyAvailable() {
        if (!this._evtSimEnabledA && this._entityA?.rigidbody) {
            this._evtSimEnabledA = this._entityA.rigidbody.once('simulationenabled', this._onBodyAvailable, this);
        }
        if (!this._evtSimEnabledB && this._entityB?.rigidbody) {
            this._evtSimEnabledB = this._entityB.rigidbody.once('simulationenabled', this._onBodyAvailable, this);
        }
    }

    /** @private */
    _clearBodyAvailableSubscriptions() {
        this._evtSimEnabledA?.off();
        this._evtSimEnabledA = null;
        this._evtSimEnabledB?.off();
        this._evtSimEnabledB = null;
    }

    /** @private */
    _onBodyAvailable() {
        this._clearBodyAvailableSubscriptions();
        this._tryCreateConstraint();
    }

    /** @private */
    _onBodyLost() {
        this._destroyConstraint();
        this._tryCreateConstraint();
    }

    /**
     * Creates the constraint if the component is in a state where one should exist and both
     * constrained bodies are present in the simulation. Otherwise, the component registers with
     * the system to retry when the bodies become available, which is also where this is called
     * from.
     *
     * @ignore
     */
    _tryCreateConstraint() {
        const system = this.system;

        // check whether a constraint should currently exist at all
        if (this._constraint || !this._initialized || !this.enabled || !this.entity.enabled ||
            this._broken || !this._entityA || this._entityA === this._entityB) {
            system._pending.delete(this);
            this._clearBodyAvailableSubscriptions();
            return;
        }

        // wait for the rigid bodies to be created and added to the simulation - this also covers
        // Ammo not having loaded yet, as no bodies can exist without it
        if (!this._isBodyReady(this._entityA) || (this._entityB && !this._isBodyReady(this._entityB))) {
            system._pending.add(this);
            this._subscribeBodyAvailable();
            return;
        }

        system._pending.delete(this);
        this._clearBodyAvailableSubscriptions();
        this._createConstraint();
    }

    /**
     * Computes the joint frame in the local space of the given body entity, as an Ammo transform
     * owned by the caller. The frame's local origin and X axis are also written to anchor and
     * axis, for use by break detection.
     *
     * @param {Entity|null} bodyEntity - The entity whose local space the frame is expressed in,
     * or null for the world-pinning fixed body, whose transform is identity.
     * @param {Mat4} [axisCorrection] - Optional rotation mapping the joint's X axis onto the
     * Bullet constraint's native axis.
     * @param {Vec3} anchor - Receives the frame origin in the body's local space.
     * @param {Vec3} axis - Receives the frame X axis in the body's local space.
     * @returns {object} The frame as a new Ammo.btTransform.
     * @private
     */
    _createFrame(bodyEntity, axisCorrection, anchor, axis) {
        // bullet rigid bodies ignore entity scale - their transform is the entity's world
        // position and rotation - so the joint frames are derived from the same unscaled
        // transforms
        _jointMat.setTRS(this.entity.getPosition(), this.entity.getRotation(), Vec3.ONE);
        if (bodyEntity) {
            _mat.setTRS(bodyEntity.getPosition(), bodyEntity.getRotation(), Vec3.ONE);
            _mat.invert();
            _mat.mul(_jointMat);
        } else {
            _mat.copy(_jointMat);
        }
        if (axisCorrection) {
            _mat.mul(axisCorrection);
        }

        _mat.getTranslation(_vec3);
        _quat.setFromMat4(_mat);
        anchor.copy(_vec3);
        _mat.getX(axis).normalize();

        const frame = new Ammo.btTransform();
        const origin = new Ammo.btVector3(_vec3.x, _vec3.y, _vec3.z);
        const rotation = new Ammo.btQuaternion(_quat.x, _quat.y, _quat.z, _quat.w);
        frame.setOrigin(origin);
        frame.setRotation(rotation);
        Ammo.destroy(origin);
        Ammo.destroy(rotation);

        return frame;
    }

    /** @private */
    _createConstraint() {
        const entityA = this._entityA;
        const entityB = this._entityB;
        const rigidbodyA = entityA.rigidbody;
        const rigidbodyB = entityB ? entityB.rigidbody : null;
        const bodyA = rigidbodyA.body;

        // world-pinned joints attach to a shared static body with an identity transform
        const bodyB = rigidbodyB ? rigidbodyB.body : this.system.getFixedBody();

        Debug.call(() => {
            if (rigidbodyA.type !== BODYTYPE_DYNAMIC && (!rigidbodyB || rigidbodyB.type !== BODYTYPE_DYNAMIC)) {
                Debug.warn('JointComponent: neither constrained body is dynamic so the joint will have no effect.', this);
            }
        });

        const impl = jointImpls[this._type];
        const axisCorrection = impl.axisCorrection;

        const frameA = this._createFrame(entityA, axisCorrection, this._anchorA, this._axisA);
        const frameB = this._createFrame(entityB, axisCorrection, this._anchorB, _vec3b);

        const constraint = impl.create(bodyA, bodyB, frameA, frameB);

        Ammo.destroy(frameA);
        Ammo.destroy(frameB);

        this._constraint = constraint;

        impl.updateLimits?.(this);
        impl.updateMotor?.(this);
        impl.updateSpring?.(this);

        if (Number.isFinite(this._breakImpulse)) {
            constraint.setBreakingImpulseThreshold(this._breakImpulse);
            constraint.enableFeedback(true);
            this.system._breakable.add(this);

            Debug.call(() => {
                if (this._type === JOINTTYPE_6DOF &&
                    typeof constraint.isEnabled !== 'function' &&
                    typeof constraint.getAppliedImpulse !== 'function') {
                    Debug.warnOnce('JointComponent: this ammo build exposes no constraint state, so breakage of 6dof joints cannot be detected - the joint will still break but no break event will fire.');
                }
            });
        }

        bodyA.activate();
        bodyB?.activate();

        const dynamicsWorld = this.system.app.systems.rigidbody.dynamicsWorld;
        dynamicsWorld.addConstraint(constraint, !this._enableCollision);

        // tear the constraint down synchronously when either body leaves the simulation, before
        // the underlying btRigidBody can be destroyed
        this._evtBodyTeardown.push(
            rigidbodyA.on('simulationdisabled', this._onBodyLost, this),
            rigidbodyA.on('beforeremove', this._onBodyLost, this)
        );
        if (rigidbodyB) {
            this._evtBodyTeardown.push(
                rigidbodyB.on('simulationdisabled', this._onBodyLost, this),
                rigidbodyB.on('beforeremove', this._onBodyLost, this)
            );
        }
    }

    /** @private */
    _destroyConstraint() {
        this.system._pending.delete(this);
        this._clearBodyAvailableSubscriptions();

        const constraint = this._constraint;
        if (constraint) {
            this.system._breakable.delete(this);

            for (let i = 0; i < this._evtBodyTeardown.length; i++) {
                this._evtBodyTeardown[i].off();
            }
            this._evtBodyTeardown.length = 0;

            const dynamicsWorld = this.system.app.systems.rigidbody.dynamicsWorld;
            dynamicsWorld.removeConstraint(constraint);
            Ammo.destroy(constraint);
            this._constraint = null;
        }
    }

    /**
     * Tests whether the joint frame anchors of the two bodies have drifted apart, which can only
     * happen once bullet has internally disabled a broken constraint. Used for break detection
     * on ammo builds that expose no constraint state. The slide axis of slider joints is ignored
     * and 6dof joints, whose axes may all be free, are not detectable this way.
     *
     * @returns {boolean} True if the anchors have separated.
     * @private
     */
    _isAnchorSeparated() {
        if (this._type === JOINTTYPE_6DOF) {
            return false;
        }

        const entityA = this._entityA;
        _mat.setTRS(entityA.getPosition(), entityA.getRotation(), Vec3.ONE);
        _mat.transformPoint(this._anchorA, _vec3);

        const entityB = this._entityB;
        if (entityB) {
            _jointMat.setTRS(entityB.getPosition(), entityB.getRotation(), Vec3.ONE);
            _jointMat.transformPoint(this._anchorB, _vec3b);
        } else {
            _vec3b.copy(this._anchorB);
        }

        _vec3b.sub(_vec3);

        if (this._type === JOINTTYPE_SLIDER) {
            // separation along the slide axis (frame A's X axis in world space) is legitimate
            _mat.transformVector(this._axisA, _vec3);
            const slide = _vec3b.dot(_vec3);
            _vec3b.sub(_vec3.mulScalar(slide));
        }

        return _vec3b.lengthSq() > _breakSeparation * _breakSeparation;
    }

    /**
     * Tests whether the constraint has broken during the last simulation step and if so, fires
     * the break event and destroys the constraint. Called by the system after each physics step
     * for joints with a finite break impulse.
     *
     * @ignore
     */
    _checkBroken() {
        const constraint = this._constraint;
        if (!constraint) {
            return;
        }

        // bullet disables a constraint when its breaking impulse threshold is exceeded but the
        // stock ammo build exposes no way to query it - prefer isEnabled, then the applied
        // impulse, then fall back to measuring anchor separation
        let broken;
        if (typeof constraint.isEnabled === 'function') {
            broken = !constraint.isEnabled();
        } else if (typeof constraint.getAppliedImpulse === 'function') {
            broken = constraint.getAppliedImpulse() >= this._breakImpulse;
        } else {
            broken = this._isAnchorSeparated();
        }

        if (broken) {
            this._broken = true;
            this._destroyConstraint();
            this.fire('break');
        }
    }

    /**
     * Wakes the constrained bodies so that a change to the constraint takes immediate effect on
     * a sleeping simulation island.
     *
     * @private
     */
    _activateBodies() {
        this._entityA?.rigidbody?.activate();
        this._entityB?.rigidbody?.activate();
    }

    /** @private */
    _updateLimits() {
        const impl = jointImpls[this._type];
        if (this._constraint && impl.updateLimits) {
            impl.updateLimits(this);
            this._activateBodies();
        }
    }

    /** @private */
    _updateMotor() {
        const impl = jointImpls[this._type];
        if (this._constraint && impl.updateMotor) {
            impl.updateMotor(this);
            this._activateBodies();
        }
    }

    /** @private */
    _updateSpring() {
        const impl = jointImpls[this._type];
        if (this._constraint && impl.updateSpring) {
            impl.updateSpring(this);
            this._activateBodies();
        }
    }

    onEnable() {
        this._broken = false;
        this._tryCreateConstraint();
    }

    onDisable() {
        this._destroyConstraint();
    }

    onBeforeRemove() {
        this._destroyConstraint();

        this._evtEntityADestroy?.off();
        this._evtEntityADestroy = null;
        this._evtEntityBDestroy?.off();
        this._evtEntityBDestroy = null;
    }

    /**
     * Remaps entity references to their duplicated counterparts when the joint is cloned as part
     * of an entity subtree. References to entities outside the duplicated subtree are preserved.
     *
     * @param {JointComponent} oldJoint - The joint component being duplicated.
     * @param {Object<string, Entity>} duplicatedIdsMap - A map of original entity GUIDs to cloned
     * entities.
     * @ignore
     */
    resolveDuplicatedEntityReferenceProperties(oldJoint, duplicatedIdsMap) {
        if (oldJoint.entityA) {
            const newEntityA = duplicatedIdsMap[oldJoint.entityA.guid];
            if (newEntityA) {
                this.entityA = newEntityA;
            }
        }
        if (oldJoint.entityB) {
            const newEntityB = duplicatedIdsMap[oldJoint.entityB.guid];
            if (newEntityB) {
                this.entityB = newEntityB;
            }
        }
    }
}

export { JointComponent };
