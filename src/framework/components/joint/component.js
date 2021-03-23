import { Mat4 } from '../../../math/mat4.js';
import { Quat } from '../../../math/quat.js';
import { Vec2 } from '../../../math/vec2.js';

import { Component } from '../component.js';

import { MOTION_FREE, MOTION_LOCKED } from './constants.js';

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
 * @private
 * @component
 * @class
 * @name JointComponent
 * @augments Component
 * @classdesc The JointComponent adds a physics joint constraint linking two rigid bodies.
 * @param {JointComponentSystem} system - The ComponentSystem that created this Component.
 * @param {Entity} entity - The Entity that this Component is attached to.
 */
class JointComponent extends Component {
    constructor(system, entity) {
        super(system, entity);

        // #ifdef DEBUG
        if (typeof Ammo === 'undefined') {
            console.error('ERROR: Attempting to create a pc.JointComponent but Ammo.js is not loaded');
        }
        // #endif

        this._constraint = null;

        this._entityA = null;
        this._entityB = null;
        this._breakForce = 3.4e+38;
        this._enableCollision = true;

        // Linear X degree of freedom
        this._linearMotionX = MOTION_LOCKED;
        this._linearLimitsX = new Vec2(0, 0);
        this._linearSpringX = false;
        this._linearStiffnessX = 0;
        this._linearDampingX = 1;
        this._linearEquilibriumX = 0;

        // Linear Y degree of freedom
        this._linearMotionY = MOTION_LOCKED;
        this._linearLimitsY = new Vec2(0, 0);
        this._linearSpringY = false;
        this._linearStiffnessY = 0;
        this._linearDampingY = 1;
        this._linearEquilibriumY = 0;

        // Linear Z degree of freedom
        this._linearMotionZ = MOTION_LOCKED;
        this._linearLimitsZ = new Vec2(0, 0);
        this._linearSpringZ = false;
        this._linearStiffnessZ = 0;
        this._linearDampingZ = 1;
        this._linearEquilibriumZ = 0;

        // Angular X degree of freedom
        this._angularMotionX = MOTION_LOCKED;
        this._angularLimitsX = new Vec2(0, 0);
        this._angularSpringX = false;
        this._angularStiffnessX = 0;
        this._angularDampingX = 1;
        this._angularEquilibriumX = 0;

        // Angular Y degree of freedom
        this._angularMotionY = MOTION_LOCKED;
        this._angularLimitsY = new Vec2(0, 0);
        this._angularSpringY = false;
        this._angularStiffnessY = 0;
        this._angularDampingY = 1;
        this._angularEquilibriumY = 0;

        // Angular Z degree of freedom
        this._angularMotionZ = MOTION_LOCKED;
        this._angularLimitsZ = new Vec2(0, 0);
        this._angularSpringZ = false;
        this._angularEquilibriumZ = 0;
        this._angularDampingZ = 1;
        this._angularStiffnessZ = 0;

        this.on('set_enabled', this._onSetEnabled, this);
    }

    set entityA(body) {
        this._destroyConstraint();
        this._entityA = body;
        this._createConstraint();
    }

    get entityA() {
        return this._entityA;
    }

    set entityB(body) {
        this._destroyConstraint();
        this._entityB = body;
        this._createConstraint();
    }

    get entityB() {
        return this._entityB;
    }

    set breakForce(force) {
        if (this._constraint && this._breakForce !== force) {
            this._constraint.setBreakingImpulseThreshold(force);
            this._breakForce = force;
        }
    }

    get breakForce() {
        return this._breakForce;
    }

    set enableCollision(enableCollision) {
        this._destroyConstraint();
        this._enableCollision = enableCollision;
        this._createConstraint();
    }

    get enableCollision() {
        return this._enableCollision;
    }

    set angularLimitsX(limits) {
        if (!this._angularLimitsX.equals(limits)) {
            this._angularLimitsX.copy(limits);
            this._updateAngularLimits();
        }
    }

    get angularLimitsX() {
        return this._angularLimitsX;
    }

    set angularMotionX(value) {
        if (this._angularMotionX !== value) {
            this._angularMotionX = value;
            this._updateAngularLimits();
        }
    }

    get angularMotionX() {
        return this._angularMotionX;
    }

    set angularLimitsY(limits) {
        if (!this._angularLimitsY.equals(limits)) {
            this._angularLimitsY.copy(limits);
            this._updateAngularLimits();
        }
    }

    get angularLimitsY() {
        return this._angularLimitsY;
    }

    set angularMotionY(value) {
        if (this._angularMotionY !== value) {
            this._angularMotionY = value;
            this._updateAngularLimits();
        }
    }

    get angularMotionY() {
        return this._angularMotionY;
    }

    set angularLimitsZ(limits) {
        if (!this._angularLimitsZ.equals(limits)) {
            this._angularLimitsZ.copy(limits);
            this._updateAngularLimits();
        }
    }

    get angularLimitsZ() {
        return this._angularLimitsZ;
    }

    set angularMotionZ(value) {
        if (this._angularMotionZ !== value) {
            this._angularMotionZ = value;
            this._updateAngularLimits();
        }
    }

    get angularMotionZ() {
        return this._angularMotionZ;
    }

    set linearLimitsX(limits) {
        if (!this._linearLimitsX.equals(limits)) {
            this._linearLimitsX.copy(limits);
            this._updateLinearLimits();
        }
    }

    get linearLimitsX() {
        return this._linearLimitsX;
    }

    set linearMotionX(value) {
        if (this._linearMotionX !== value) {
            this._linearMotionX = value;
            this._updateLinearLimits();
        }
    }

    get linearMotionX() {
        return this._linearMotionX;
    }

    set linearLimitsY(limits) {
        if (!this._linearLimitsY.equals(limits)) {
            this._linearLimitsY.copy(limits);
            this._updateLinearLimits();
        }
    }

    get linearLimitsY() {
        return this._linearLimitsY;
    }

    set linearMotionY(value) {
        if (this._linearMotionY !== value) {
            this._linearMotionY = value;
            this._updateLinearLimits();
        }
    }

    get linearMotionY() {
        return this._linearMotionY;
    }

    set linearLimitsZ(limits) {
        if (!this._linearLimitsZ.equals(limits)) {
            this._linearLimitsZ.copy(limits);
            this._updateLinearLimits();
        }
    }

    get linearLimitsZ() {
        return this._linearLimitsZ;
    }

    set linearMotionZ(value) {
        if (this._linearMotionZ !== value) {
            this._linearMotionZ = value;
            this._updateLinearLimits();
        }
    }

    get linearMotionZ() {
        return this._linearMotionZ;
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
            let lx, ly, lz;

            if (this._angularMotionX === MOTION_LOCKED) {
                lx = Vec2.ZERO;
            } else if (this._angularMotionX === MOTION_FREE) {
                lx = Vec2.RIGHT; // In ammo.js, if lower limit is greater than upper limit, DoF is free
            } else { // MOTION_LIMITED
                lx = this._angularLimitsX;
            }

            if (this._angularMotionY === MOTION_LOCKED) {
                ly = Vec2.ZERO;
            } else if (this._angularMotionY === MOTION_FREE) {
                ly = Vec2.RIGHT;
            } else { // MOTION_LIMITED
                ly = this._angularLimitsY;
            }

            if (this._angularMotionZ === MOTION_LOCKED) {
                lz = Vec2.ZERO;
            } else if (this._angularMotionZ === MOTION_FREE) {
                lz = Vec2.RIGHT;
            } else { // MOTION_LIMITED
                lz = this._angularLimitsZ;
            }

            const limits = new Ammo.btVector3(lx.x, ly.x, lz.x);
            constraint.setAngularLowerLimit(limits);
            limits.setValue(lx.y, ly.y, lz.y);
            constraint.setAngularUpperLimit(limits);
            Ammo.destroy(limits);
        }
    }

    _updateLinearLimits() {
        const constraint = this._constraint;
        if (constraint) {
            let lx, ly, lz;

            if (this._linearMotionX === MOTION_LOCKED) {
                lx = Vec2.ZERO;
            } else if (this._linearMotionX === MOTION_FREE) {
                lx = Vec2.RIGHT; // In ammo.js, if lower limit is greater than upper limit, DoF is free
            } else { // MOTION_LIMITED
                lx = this._linearLimitsX;
            }

            if (this._linearMotionY === MOTION_LOCKED) {
                ly = Vec2.ZERO;
            } else if (this._linearMotionY === MOTION_FREE) {
                ly = Vec2.RIGHT;
            } else { // MOTION_LIMITED
                ly = this._linearLimitsY;
            }

            if (this._linearMotionZ === MOTION_LOCKED) {
                lz = Vec2.ZERO;
            } else if (this._linearMotionZ === MOTION_FREE) {
                lz = Vec2.RIGHT;
            } else { // MOTION_LIMITED
                lz = this._linearLimitsZ;
            }

            const limits = new Ammo.btVector3(lx.x, ly.x, lz.x);
            constraint.setLinearLowerLimit(limits);
            limits.setValue(lx.y, ly.y, lz.y);
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
                this._constraint.enableSpring(i, this[type + 'Spring' + axis[i]]);
                this._constraint.setDamping(i, this[type + 'Damping' + axis[i]]);
                this._constraint.setEquilibriumPoint(i, this[type + 'Equilibrium' + axis[i]]);
                this._constraint.setStiffness(i, this[type + 'Stiffness' + axis[i]]);
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
                    this['_' + prop].copy(data[prop]);
                } else {
                    this['_' + prop] = data[prop];
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

    _onSetEnabled(prop, old, value) {
    }

    _onBeforeRemove() {
        this.fire('remove');
    }
}

const functionMap = {
    Damping: 'setDamping',
    Equilibrium: 'setEquilibriumPoint',
    Spring: 'enableSpring',
    Stiffness: 'setStiffness'
};

// Define additional properties for each degree of freedom
['linear', 'angular'].forEach(type => {
    ['Damping', 'Equilibrium', 'Spring', 'Stiffness'].forEach(name => {
        ['X', 'Y', 'Z'].forEach(axis => {
            const prop = type + name + axis;
            const propInternal = '_' + prop;

            let index = (type === 'linear') ? 0 : 3;
            if (axis === 'Y') index += 1;
            if (axis === 'Z') index += 2;

            Object.defineProperty(JointComponent.prototype, prop, {
                get: function () {
                    return this[propInternal];
                },

                set: function (value) {
                    if (this[propInternal] !== value) {
                        this[propInternal] = value;
                        this._constraint[functionMap[name]](index, value);
                    }
                }
            });
        });
    });
});

export { JointComponent };
