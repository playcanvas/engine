import { Debug } from '../../../core/debug.js';
import { math } from '../../../core/math/math.js';
import { Mat4 } from '../../../core/math/mat4.js';
import { Quat } from '../../../core/math/quat.js';
import { Vec2 } from '../../../core/math/vec2.js';
import { Component } from '../component.js';
import { MOTION_FREE, MOTION_LIMITED, MOTION_LOCKED } from './constants.js';

/**
 * @import { Entity } from '../../entity.js'
 * @import { JointComponentSystem } from './system.js'
 */

const properties = [
    'angularDampingX', 'angularDampingY', 'angularDampingZ',
    'angularEquilibriumX', 'angularEquilibriumY', 'angularEquilibriumZ',
    'angularLimitsX', 'angularLimitsY', 'angularLimitsZ',
    'angularMotionX', 'angularMotionY', 'angularMotionZ',
    'angularSpringX', 'angularSpringY', 'angularSpringZ',
    'angularStiffnessX', 'angularStiffnessY', 'angularStiffnessZ',
    'breakForce', 'enableCollision', 'enabled', 'entityA', 'entityB',
    'linearDampingX', 'linearDampingY', 'linearDampingZ',
    'linearEquilibriumX', 'linearEquilibriumY', 'linearEquilibriumZ',
    'linearLimitsX', 'linearLimitsY', 'linearLimitsZ',
    'linearMotionX', 'linearMotionY', 'linearMotionZ',
    'linearSpringX', 'linearSpringY', 'linearSpringZ',
    'linearStiffnessX', 'linearStiffnessY', 'linearStiffnessZ'
];

/**
 * The JointComponent adds a physics joint constraint between two rigid body components. 
 * A joint connects two rigid bodies and restricts their relative movement in various ways.
 * It supports both linear and angular constraints along all three axes, with options for:
 * 
 * - Locked motion (no movement)
 * - Free motion (unrestricted movement)
 * - Limited motion (movement within specified limits)
 * - Spring behavior (with configurable stiffness, damping, and equilibrium points)
 * 
 * This can be used to create a variety of joint types like hinges, sliders, ball-and-socket joints, etc.
 * Each degree of freedom (linear and angular) for each axis (X, Y, Z) can be configured independently.
 * 
 * @beta
 */
class JointComponent extends Component {
    /** @private */
    _constraint = null;
    /** @private */
    _entityA = null;
    /** @private */
    _entityB = null;
    /** @private */
    _breakForce = 3.4e+38;
    /** @private */
    _enableCollision = true;

    // Linear X degree of freedom
    /** @private */
    _linearMotionX = MOTION_LOCKED;
    /** @private */
    _linearLimitsX = new Vec2(0, 0);
    /** @private */
    _linearSpringX = false;
    /** @private */
    _linearStiffnessX = 0;
    /** @private */
    _linearDampingX = 1;
    /** @private */
    _linearEquilibriumX = 0;

    // Linear Y degree of freedom
    /** @private */
    _linearMotionY = MOTION_LOCKED;
    /** @private */
    _linearLimitsY = new Vec2(0, 0);
    /** @private */
    _linearSpringY = false;
    /** @private */
    _linearStiffnessY = 0;
    /** @private */
    _linearDampingY = 1;
    /** @private */
    _linearEquilibriumY = 0;

    // Linear Z degree of freedom
    /** @private */
    _linearMotionZ = MOTION_LOCKED;
    /** @private */
    _linearLimitsZ = new Vec2(0, 0);
    /** @private */
    _linearSpringZ = false;
    /** @private */
    _linearStiffnessZ = 0;
    /** @private */
    _linearDampingZ = 1;
    /** @private */
    _linearEquilibriumZ = 0;

    // Angular X degree of freedom
    /** @private */
    _angularMotionX = MOTION_LOCKED;
    /** @private */
    _angularLimitsX = new Vec2(0, 0);
    /** @private */
    _angularSpringX = false;
    /** @private */
    _angularStiffnessX = 0;
    /** @private */
    _angularDampingX = 1;
    /** @private */
    _angularEquilibriumX = 0;

    // Angular Y degree of freedom
    /** @private */
    _angularMotionY = MOTION_LOCKED;
    /** @private */
    _angularLimitsY = new Vec2(0, 0);
    /** @private */
    _angularSpringY = false;
    /** @private */
    _angularStiffnessY = 0;
    /** @private */
    _angularDampingY = 1;
    /** @private */
    _angularEquilibriumY = 0;

    // Angular Z degree of freedom
    /** @private */
    _angularMotionZ = MOTION_LOCKED;
    /** @private */
    _angularLimitsZ = new Vec2(0, 0);
    /** @private */
    _angularSpringZ = false;
    /** @private */
    _angularEquilibriumZ = 0;
    /** @private */
    _angularDampingZ = 1;
    /** @private */
    _angularStiffnessZ = 0;

    /**
     * Create a new JointComponent instance.
     *
     * @param {JointComponentSystem} system - The ComponentSystem that created this Component.
     * @param {Entity} entity - The Entity that this Component is attached to.
     */
    constructor(system, entity) {
        super(system, entity);

        Debug.assert(typeof Ammo !== 'undefined', 'ERROR: Attempting to create a pc.JointComponent but Ammo.js is not loaded');
    }

    /**
     * Sets the angular damping for the X-axis. This reduces the angular velocity over time.
     * A value of 0 means no damping, while higher values cause more damping.
     *
     * @type {number}
     */
    set angularDampingX(value) {
        if (this._angularDampingX !== value) {
            this._angularDampingX = value;
            if (this._constraint) this._constraint.setDamping(3, value);
        }
    }

    /**
     * Gets the angular damping for the X-axis.
     *
     * @type {number}
     */
    get angularDampingX() {
        return this._angularDampingX;
    }

    /**
     * Sets the angular damping for the Y-axis. This reduces the angular velocity over time.
     * A value of 0 means no damping, while higher values cause more damping.
     *
     * @type {number}
     */
    set angularDampingY(value) {
        if (this._angularDampingY !== value) {
            this._angularDampingY = value;
            if (this._constraint) this._constraint.setDamping(4, value);
        }
    }

    /**
     * Gets the angular damping for the Y-axis.
     *
     * @type {number}
     */
    get angularDampingY() {
        return this._angularDampingY;
    }

    /**
     * Sets the angular damping for the Z-axis. This reduces the angular velocity over time.
     * A value of 0 means no damping, while higher values cause more damping.
     *
     * @type {number}
     */
    set angularDampingZ(value) {
        if (this._angularDampingZ !== value) {
            this._angularDampingZ = value;
            if (this._constraint) this._constraint.setDamping(5, value);
        }
    }

    /**
     * Gets the angular damping for the Z-axis.
     *
     * @type {number}
     */
    get angularDampingZ() {
        return this._angularDampingZ;
    }

    /**
     * Sets the angular equilibrium point for the X-axis. The spring will attempt to reach this angle.
     *
     * @type {number}
     */
    set angularEquilibriumX(value) {
        if (this._angularEquilibriumX !== value) {
            this._angularEquilibriumX = value;
            if (this._constraint) this._constraint.setEquilibriumPoint(3, value);
        }
    }

    /**
     * Gets the angular equilibrium point for the X-axis.
     *
     * @type {number}
     */
    get angularEquilibriumX() {
        return this._angularEquilibriumX;
    }

    /**
     * Sets the angular equilibrium point for the Y-axis. The spring will attempt to reach this angle.
     *
     * @type {number}
     */
    set angularEquilibriumY(value) {
        if (this._angularEquilibriumY !== value) {
            this._angularEquilibriumY = value;
            if (this._constraint) this._constraint.setEquilibriumPoint(4, value);
        }
    }

    /**
     * Gets the angular equilibrium point for the Y-axis.
     *
     * @type {number}
     */
    get angularEquilibriumY() {
        return this._angularEquilibriumY;
    }

    /**
     * Sets the angular equilibrium point for the Z-axis. The spring will attempt to reach this angle.
     *
     * @type {number}
     */
    set angularEquilibriumZ(value) {
        if (this._angularEquilibriumZ !== value) {
            this._angularEquilibriumZ = value;
            if (this._constraint) this._constraint.setEquilibriumPoint(5, value);
        }
    }

    /**
     * Gets the angular equilibrium point for the Z-axis.
     *
     * @type {number}
     */
    get angularEquilibriumZ() {
        return this._angularEquilibriumZ;
    }

    /**
     * Sets the angular limits for the X-axis rotation in degrees.
     *
     * @type {Vec2}
     */
    set angularLimitsX(limits) {
        if (!this._angularLimitsX.equals(limits)) {
            this._angularLimitsX.copy(limits);
            this._updateAngularLimits();
        }
    }

    /**
     * Gets the angular limits for the X-axis rotation.
     *
     * @type {Vec2}
     */
    get angularLimitsX() {
        return this._angularLimitsX;
    }

    /**
     * Sets the angular limits for the Y-axis rotation in degrees.
     *
     * @type {Vec2}
     */
    set angularLimitsY(limits) {
        if (!this._angularLimitsY.equals(limits)) {
            this._angularLimitsY.copy(limits);
            this._updateAngularLimits();
        }
    }

    /**
     * Gets the angular limits for the Y-axis rotation.
     *
     * @type {Vec2}
     */
    get angularLimitsY() {
        return this._angularLimitsY;
    }

    /**
     * Sets the angular limits for the Z-axis rotation in degrees.
     *
     * @type {Vec2}
     */
    set angularLimitsZ(limits) {
        if (!this._angularLimitsZ.equals(limits)) {
            this._angularLimitsZ.copy(limits);
            this._updateAngularLimits();
        }
    }

    /**
     * Gets the angular limits for the Z-axis rotation.
     *
     * @type {Vec2}
     */
    get angularLimitsZ() {
        return this._angularLimitsZ;
    }

    /**
     * Sets the type of motion allowed for rotation around the X-axis. Can be:
     * - MOTION_LOCKED: No rotation allowed
     * - MOTION_FREE: Unlimited rotation allowed
     * - MOTION_LIMITED: Rotation limited by angularLimitsX
     *
     * @type {string}
     */
    set angularMotionX(value) {
        if (this._angularMotionX !== value) {
            this._angularMotionX = value;
            this._updateAngularLimits();
        }
    }

    /**
     * Gets the type of motion allowed for rotation around the X-axis.
     *
     * @type {string}
     */
    get angularMotionX() {
        return this._angularMotionX;
    }

    /**
     * Sets the type of motion allowed for rotation around the Y-axis. Can be:
     * - MOTION_LOCKED: No rotation allowed
     * - MOTION_FREE: Unlimited rotation allowed
     * - MOTION_LIMITED: Rotation limited by angularLimitsY
     *
     * @type {string}
     */
    set angularMotionY(value) {
        if (this._angularMotionY !== value) {
            this._angularMotionY = value;
            this._updateAngularLimits();
        }
    }

    /**
     * Gets the type of motion allowed for rotation around the Y-axis.
     *
     * @type {string}
     */
    get angularMotionY() {
        return this._angularMotionY;
    }

    /**
     * Sets the type of motion allowed for rotation around the Z-axis. Can be:
     * - MOTION_LOCKED: No rotation allowed
     * - MOTION_FREE: Unlimited rotation allowed
     * - MOTION_LIMITED: Rotation limited by angularLimitsZ
     *
     * @type {string}
     */
    set angularMotionZ(value) {
        if (this._angularMotionZ !== value) {
            this._angularMotionZ = value;
            this._updateAngularLimits();
        }
    }

    /**
     * Gets the type of motion allowed for rotation around the Z-axis.
     *
     * @type {string}
     */
    get angularMotionZ() {
        return this._angularMotionZ;
    }

    /**
     * Enables or disables the spring behavior for rotation around the X-axis.
     *
     * @type {boolean}
     */
    set angularSpringX(value) {
        if (this._angularSpringX !== value) {
            this._angularSpringX = value;
            if (this._constraint) this._constraint.enableSpring(3, value);
        }
    }

    /**
     * Gets whether the spring behavior is enabled for rotation around the X-axis.
     *
     * @type {boolean}
     */
    get angularSpringX() {
        return this._angularSpringX;
    }

    /**
     * Enables or disables the spring behavior for rotation around the Y-axis.
     *
     * @type {boolean}
     */
    set angularSpringY(value) {
        if (this._angularSpringY !== value) {
            this._angularSpringY = value;
            if (this._constraint) this._constraint.enableSpring(4, value);
        }
    }

    /**
     * Gets whether the spring behavior is enabled for rotation around the Y-axis.
     *
     * @type {boolean}
     */
    get angularSpringY() {
        return this._angularSpringY;
    }

    /**
     * Enables or disables the spring behavior for rotation around the Z-axis.
     *
     * @type {boolean}
     */
    set angularSpringZ(value) {
        if (this._angularSpringZ !== value) {
            this._angularSpringZ = value;
            if (this._constraint) this._constraint.enableSpring(5, value);
        }
    }

    /**
     * Gets whether the spring behavior is enabled for rotation around the Z-axis.
     *
     * @type {boolean}
     */
    get angularSpringZ() {
        return this._angularSpringZ;
    }

    /**
     * Sets the spring stiffness for rotation around the X-axis.
     *
     * @type {number}
     */
    set angularStiffnessX(value) {
        if (this._angularStiffnessX !== value) {
            this._angularStiffnessX = value;
            if (this._constraint) this._constraint.setStiffness(3, value);
        }
    }

    /**
     * Gets the spring stiffness for rotation around the X-axis.
     *
     * @type {number}
     */
    get angularStiffnessX() {
        return this._angularStiffnessX;
    }

    /**
     * Sets the spring stiffness for rotation around the Y-axis.
     *
     * @type {number}
     */
    set angularStiffnessY(value) {
        if (this._angularStiffnessY !== value) {
            this._angularStiffnessY = value;
            if (this._constraint) this._constraint.setStiffness(4, value);
        }
    }

    /**
     * Gets the spring stiffness for rotation around the Y-axis.
     *
     * @type {number}
     */
    get angularStiffnessY() {
        return this._angularStiffnessY;
    }

    /**
     * Sets the spring stiffness for rotation around the Z-axis.
     *
     * @type {number}
     */
    set angularStiffnessZ(value) {
        if (this._angularStiffnessZ !== value) {
            this._angularStiffnessZ = value;
            if (this._constraint) this._constraint.setStiffness(5, value);
        }
    }

    /**
     * Gets the spring stiffness for rotation around the Z-axis.
     *
     * @type {number}
     */
    get angularStiffnessZ() {
        return this._angularStiffnessZ;
    }

    /**
     * Sets the breaking force threshold for the constraint.
     *
     * @type {number}
     */
    set breakForce(force) {
        if (this._constraint && this._breakForce !== force) {
            this._constraint.setBreakingImpulseThreshold(force);
            this._breakForce = force;
        }
    }

    /**
     * Gets the breaking force threshold for the constraint.
     *
     * @type {number}
     */
    get breakForce() {
        return this._breakForce;
    }

    /**
     * Enables or disables collision between the constrained entities.
     *
     * @type {boolean}
     */
    set enableCollision(enableCollision) {
        this._destroyConstraint();
        this._enableCollision = enableCollision;
        this._createConstraint();
    }

    /**
     * Gets whether collision is enabled between the constrained entities.
     *
     * @type {boolean}
     */
    get enableCollision() {
        return this._enableCollision;
    }

    /**
     * Sets the first entity in the constraint.
     *
     * @type {Entity}
     */
    set entityA(body) {
        this._destroyConstraint();
        this._entityA = body;
        this._createConstraint();
    }

    /**
     * Gets the first entity in the constraint.
     *
     * @type {Entity}
     */
    get entityA() {
        return this._entityA;
    }

    /**
     * Sets the second entity in the constraint.
     *
     * @type {Entity}
     */
    set entityB(body) {
        this._destroyConstraint();
        this._entityB = body;
        this._createConstraint();
    }

    /**
     * Gets the second entity in the constraint.
     *
     * @type {Entity}
     */
    get entityB() {
        return this._entityB;
    }

    /**
     * Sets the linear damping for movement along the X-axis.
     *
     * @type {number}
     */
    set linearDampingX(value) {
        if (this._linearDampingX !== value) {
            this._linearDampingX = value;
            if (this._constraint) this._constraint.setDamping(0, value);
        }
    }

    /**
     * Gets the linear damping for movement along the X-axis.
     *
     * @type {number}
     */
    get linearDampingX() {
        return this._linearDampingX;
    }

    /**
     * Sets the linear damping for movement along the Y-axis.
     *
     * @type {number}
     */
    set linearDampingY(value) {
        if (this._linearDampingY !== value) {
            this._linearDampingY = value;
            if (this._constraint) this._constraint.setDamping(1, value);
        }
    }

    /**
     * Gets the linear damping for movement along the Y-axis.
     *
     * @type {number}
     */
    get linearDampingY() {
        return this._linearDampingY;
    }

    /**
     * Sets the linear damping for movement along the Z-axis.
     *
     * @type {number}
     */
    set linearDampingZ(value) {
        if (this._linearDampingZ !== value) {
            this._linearDampingZ = value;
            if (this._constraint) this._constraint.setDamping(2, value);
        }
    }

    /**
     * Gets the linear damping for movement along the Z-axis.
     *
     * @type {number}
     */
    get linearDampingZ() {
        return this._linearDampingZ;
    }

    /**
     * Sets the linear equilibrium point for movement along the X-axis.
     *
     * @type {number}
     */
    set linearEquilibriumX(value) {
        if (this._linearEquilibriumX !== value) {
            this._linearEquilibriumX = value;
            if (this._constraint) this._constraint.setEquilibriumPoint(0, value);
        }
    }

    /**
     * Gets the linear equilibrium point for movement along the X-axis.
     *
     * @type {number}
     */
    get linearEquilibriumX() {
        return this._linearEquilibriumX;
    }

    /**
     * Sets the linear equilibrium point for movement along the Y-axis.
     *
     * @type {number}
     */
    set linearEquilibriumY(value) {
        if (this._linearEquilibriumY !== value) {
            this._linearEquilibriumY = value;
            if (this._constraint) this._constraint.setEquilibriumPoint(1, value);
        }
    }

    /**
     * Gets the linear equilibrium point for movement along the Y-axis.
     *
     * @type {number}
     */
    get linearEquilibriumY() {
        return this._linearEquilibriumY;
    }

    /**
     * Sets the linear equilibrium point for movement along the Z-axis.
     *
     * @type {number}
     */
    set linearEquilibriumZ(value) {
        if (this._linearEquilibriumZ !== value) {
            this._linearEquilibriumZ = value;
            if (this._constraint) this._constraint.setEquilibriumPoint(2, value);
        }
    }

    /**
     * Gets the linear equilibrium point for movement along the Z-axis.
     *
     * @type {number}
     */
    get linearEquilibriumZ() {
        return this._linearEquilibriumZ;
    }

    /**
     * Sets the linear limits for movement along the X-axis.
     *
     * @type {Vec2}
     */
    set linearLimitsX(limits) {
        if (!this._linearLimitsX.equals(limits)) {
            this._linearLimitsX.copy(limits);
            this._updateLinearLimits();
        }
    }

    /**
     * Gets the linear limits for movement along the X-axis.
     *
     * @type {Vec2}
     */
    get linearLimitsX() {
        return this._linearLimitsX;
    }

    /**
     * Sets the linear limits for movement along the Y-axis.
     *
     * @type {Vec2}
     */
    set linearLimitsY(limits) {
        if (!this._linearLimitsY.equals(limits)) {
            this._linearLimitsY.copy(limits);
            this._updateLinearLimits();
        }
    }

    /**
     * Gets the linear limits for movement along the Y-axis.
     *
     * @type {Vec2}
     */
    get linearLimitsY() {
        return this._linearLimitsY;
    }

    /**
     * Sets the linear limits for movement along the Z-axis.
     *
     * @type {Vec2}
     */
    set linearLimitsZ(limits) {
        if (!this._linearLimitsZ.equals(limits)) {
            this._linearLimitsZ.copy(limits);
            this._updateLinearLimits();
        }
    }

    /**
     * Gets the linear limits for movement along the Z-axis.
     *
     * @type {Vec2}
     */
    get linearLimitsZ() {
        return this._linearLimitsZ;
    }

    /**
     * Sets the type of motion allowed for movement along the X-axis. Can be:
     * - MOTION_LOCKED: No movement allowed
     * - MOTION_FREE: Unlimited movement allowed
     * - MOTION_LIMITED: Movement limited by linearLimitsX
     *
     * @type {string}
     */
    set linearMotionX(value) {
        if (this._linearMotionX !== value) {
            this._linearMotionX = value;
            this._updateLinearLimits();
        }
    }

    /**
     * Gets the type of motion allowed for movement along the X-axis.
     *
     * @type {string}
     */
    get linearMotionX() {
        return this._linearMotionX;
    }

    /**
     * Sets the type of motion allowed for movement along the Y-axis. Can be:
     * - MOTION_LOCKED: No movement allowed
     * - MOTION_FREE: Unlimited movement allowed
     * - MOTION_LIMITED: Movement limited by linearLimitsY
     *
     * @type {string}
     */
    set linearMotionY(value) {
        if (this._linearMotionY !== value) {
            this._linearMotionY = value;
            this._updateLinearLimits();
        }
    }

    /**
     * Gets the type of motion allowed for movement along the Y-axis.
     *
     * @type {string}
     */
    get linearMotionY() {
        return this._linearMotionY;
    }

    /**
     * Sets the type of motion allowed for movement along the Z-axis. Can be:
     * - MOTION_LOCKED: No movement allowed
     * - MOTION_FREE: Unlimited movement allowed
     * - MOTION_LIMITED: Movement limited by linearLimitsZ
     *
     * @type {string}
     */
    set linearMotionZ(value) {
        if (this._linearMotionZ !== value) {
            this._linearMotionZ = value;
            this._updateLinearLimits();
        }
    }

    /**
     * Gets the type of motion allowed for movement along the Z-axis.
     *
     * @type {string}
     */
    get linearMotionZ() {
        return this._linearMotionZ;
    }

    /**
     * Enables or disables the spring behavior for movement along the X-axis.
     *
     * @type {boolean}
     */
    set linearSpringX(value) {
        if (this._linearSpringX !== value) {
            this._linearSpringX = value;
            if (this._constraint) this._constraint.enableSpring(0, value);
        }
    }

    /**
     * Gets whether the spring behavior is enabled for movement along the X-axis.
     *
     * @type {boolean}
     */
    get linearSpringX() {
        return this._linearSpringX;
    }

    /**
     * Enables or disables the spring behavior for movement along the Y-axis.
     *
     * @type {boolean}
     */
    set linearSpringY(value) {
        if (this._linearSpringY !== value) {
            this._linearSpringY = value;
            if (this._constraint) this._constraint.enableSpring(1, value);
        }
    }

    /**
     * Gets whether the spring behavior is enabled for movement along the Y-axis.
     *
     * @type {boolean}
     */
    get linearSpringY() {
        return this._linearSpringY;
    }

    /**
     * Enables or disables the spring behavior for movement along the Z-axis.
     *
     * @type {boolean}
     */
    set linearSpringZ(value) {
        if (this._linearSpringZ !== value) {
            this._linearSpringZ = value;
            if (this._constraint) this._constraint.enableSpring(2, value);
        }
    }

    /**
     * Gets whether the spring behavior is enabled for movement along the Z-axis.
     *
     * @type {boolean}
     */
    get linearSpringZ() {
        return this._linearSpringZ;
    }

    /**
     * Sets the spring stiffness for movement along the X-axis.
     *
     * @type {number}
     */
    set linearStiffnessX(value) {
        if (this._linearStiffnessX !== value) {
            this._linearStiffnessX = value;
            if (this._constraint) this._constraint.setStiffness(0, value);
        }
    }

    /**
     * Gets the spring stiffness for movement along the X-axis.
     *
     * @type {number}
     */
    get linearStiffnessX() {
        return this._linearStiffnessX;
    }

    /**
     * Sets the spring stiffness for movement along the Y-axis.
     *
     * @type {number}
     */
    set linearStiffnessY(value) {
        if (this._linearStiffnessY !== value) {
            this._linearStiffnessY = value;
            if (this._constraint) this._constraint.setStiffness(1, value);
        }
    }

    /**
     * Gets the spring stiffness for movement along the Y-axis.
     *
     * @type {number}
     */
    get linearStiffnessY() {
        return this._linearStiffnessY;
    }

    /**
     * Sets the spring stiffness for movement along the Z-axis.
     *
     * @type {number}
     */
    set linearStiffnessZ(value) {
        if (this._linearStiffnessZ !== value) {
            this._linearStiffnessZ = value;
            if (this._constraint) this._constraint.setStiffness(2, value);
        }
    }

    /**
     * Gets the spring stiffness for movement along the Z-axis.
     *
     * @type {number}
     */
    get linearStiffnessZ() {
        return this._linearStiffnessZ;
    }

    _convertTransform(pcTransform, ammoTransform) {
        const pos = pcTransform.getTranslation();
        const rot = new Quat();
        rot.setFromMat4(pcTransform);

        const ammoVec = new Ammo.btVector3(pos.x, pos.y, pos.z);
        const ammoQuat = new Ammo.btQuaternion(rot.x, rot.y, rot.z, rot.w);

        ammoTransform.setOrigin(ammoVec);
        ammoTransform.setRotation(ammoQuat);

        Ammo.destroy(ammoVec);
        Ammo.destroy(ammoQuat);
    }

    _updateAngularLimits() {
        const constraint = this._constraint;
        if (constraint) {
            let lx, ly, lz, ux, uy, uz;

            if (this._angularMotionX === MOTION_LIMITED) {
                lx = this._angularLimitsX.x * math.DEG_TO_RAD;
                ux = this._angularLimitsX.y * math.DEG_TO_RAD;
            } else if (this._angularMotionX === MOTION_FREE) {
                lx = 1;
                ux = 0;
            } else { // MOTION_LOCKED
                lx = ux = 0;
            }

            if (this._angularMotionY === MOTION_LIMITED) {
                ly = this._angularLimitsY.x * math.DEG_TO_RAD;
                uy = this._angularLimitsY.y * math.DEG_TO_RAD;
            } else if (this._angularMotionY === MOTION_FREE) {
                ly = 1;
                uy = 0;
            } else { // MOTION_LOCKED
                ly = uy = 0;
            }

            if (this._angularMotionZ === MOTION_LIMITED) {
                lz = this._angularLimitsZ.x * math.DEG_TO_RAD;
                uz = this._angularLimitsZ.y * math.DEG_TO_RAD;
            } else if (this._angularMotionZ === MOTION_FREE) {
                lz = 1;
                uz = 0;
            } else { // MOTION_LOCKED
                lz = uz = 0;
            }

            const limits = new Ammo.btVector3(lx, ly, lz);
            constraint.setAngularLowerLimit(limits);
            limits.setValue(ux, uy, uz);
            constraint.setAngularUpperLimit(limits);
            Ammo.destroy(limits);
        }
    }

    _updateLinearLimits() {
        const constraint = this._constraint;
        if (constraint) {
            let lx, ly, lz, ux, uy, uz;

            if (this._linearMotionX === MOTION_LIMITED) {
                lx = this._linearLimitsX.x;
                ux = this._linearLimitsX.y;
            } else if (this._linearMotionX === MOTION_FREE) {
                lx = 1;
                ux = 0;
            } else { // MOTION_LOCKED
                lx = ux = 0;
            }

            if (this._linearMotionY === MOTION_LIMITED) {
                ly = this._linearLimitsY.x;
                uy = this._linearLimitsY.y;
            } else if (this._linearMotionY === MOTION_FREE) {
                ly = 1;
                uy = 0;
            } else { // MOTION_LOCKED
                ly = uy = 0;
            }

            if (this._linearMotionZ === MOTION_LIMITED) {
                lz = this._linearLimitsZ.x;
                uz = this._linearLimitsZ.y;
            } else if (this._linearMotionZ === MOTION_FREE) {
                lz = 1;
                uz = 0;
            } else { // MOTION_LOCKED
                lz = uz = 0;
            }

            const limits = new Ammo.btVector3(lx, ly, lz);
            constraint.setLinearLowerLimit(limits);
            limits.setValue(ux, uy, uz);
            constraint.setLinearUpperLimit(limits);
            Ammo.destroy(limits);
        }
    }

    _createConstraint() {
        if (this._entityA && this._entityA.rigidbody) {
            this._destroyConstraint();

            const mat = new Mat4();

            const bodyA = this._entityA.rigidbody.body;
            bodyA.activate();

            const jointWtm = this.entity.getWorldTransform();

            const entityAWtm = this._entityA.getWorldTransform();
            const invEntityAWtm = entityAWtm.clone().invert();
            mat.mul2(invEntityAWtm, jointWtm);

            const frameA = new Ammo.btTransform();
            this._convertTransform(mat, frameA);

            if (this._entityB && this._entityB.rigidbody) {
                const bodyB = this._entityB.rigidbody.body;
                bodyB.activate();

                const entityBWtm = this._entityB.getWorldTransform();
                const invEntityBWtm = entityBWtm.clone().invert();
                mat.mul2(invEntityBWtm, jointWtm);

                const frameB = new Ammo.btTransform();
                this._convertTransform(mat, frameB);

                this._constraint = new Ammo.btGeneric6DofSpringConstraint(bodyA, bodyB, frameA, frameB, !this._enableCollision);

                Ammo.destroy(frameB);
            } else {
                this._constraint = new Ammo.btGeneric6DofSpringConstraint(bodyA, frameA, !this._enableCollision);
            }

            Ammo.destroy(frameA);

            const axis = ['X', 'Y', 'Z', 'X', 'Y', 'Z'];

            for (let i = 0; i < 6; i++) {
                const type = i < 3 ? '_linear' : '_angular';
                this._constraint.enableSpring(i, this[`${type}Spring${axis[i]}`]);
                this._constraint.setDamping(i, this[`${type}Damping${axis[i]}`]);
                this._constraint.setEquilibriumPoint(i, this[`${type}Equilibrium${axis[i]}`]);
                this._constraint.setStiffness(i, this[`${type}Stiffness${axis[i]}`]);
            }

            this._constraint.setBreakingImpulseThreshold(this._breakForce);

            this._updateLinearLimits();
            this._updateAngularLimits();

            const app = this.system.app;
            const dynamicsWorld = app.systems.rigidbody.dynamicsWorld;
            dynamicsWorld.addConstraint(this._constraint, !this._enableCollision);
        }
    }

    _destroyConstraint() {
        if (this._constraint) {
            const app = this.system.app;
            const dynamicsWorld = app.systems.rigidbody.dynamicsWorld;
            dynamicsWorld.removeConstraint(this._constraint);

            Ammo.destroy(this._constraint);
            this._constraint = null;
        }
    }

    initFromData(data) {
        for (const prop of properties) {
            if (data.hasOwnProperty(prop)) {
                if (data[prop] instanceof Vec2) {
                    this[`_${prop}`].copy(data[prop]);
                } else {
                    this[`_${prop}`] = data[prop];
                }
            }
        }

        this._createConstraint();
    }

    onEnable() {
        this._createConstraint();
    }

    onDisable() {
        this._destroyConstraint();
    }

    _onBeforeRemove() {
        this.fire('remove');
    }
}

export { JointComponent };
