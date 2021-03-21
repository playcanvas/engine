import { Mat4 } from '../../../math/mat4.js';
import { Quat } from '../../../math/quat.js';
import { Vec2 } from '../../../math/vec2.js';

import { Component } from '../component.js';

/**
 * @private
 * @component
 * @class
 * @name JointComponent
 * @augments Component
 * @classdesc The JointComponent adds a physics joint constraint linking two rigid bodies.
 * @param {JointComponentSystem} system - The ComponentSystem that created this Component.
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

        this._linearLimitsX = new Vec2(0, 0);
        this._linearSpringX = false;
        this._linearStiffnessX = 0;
        this._linearEquilibriumX = 0;

        this._linearLimitsY = new Vec2(0, 0);
        this._linearSpringY = false;
        this._linearStiffnessY = 0;
        this._linearEquilibriumY = 0;

        this._linearLimitsZ = new Vec2(0, 0);
        this._linearSpringZ = false;
        this._linearStiffnessZ = 0;
        this._linearEquilibriumZ = 0;

        this._angularLimitsX = new Vec2(0, 0);
        this._angularSpringX = false;
        this._angularStiffnessX = 0;
        this._angularEquilibriumX = 0;

        this._angularLimitsY = new Vec2(0, 0);
        this._angularSpringY = false;
        this._angularStiffnessY = 0;
        this._angularEquilibriumY = 0;

        this._angularLimitsZ = new Vec2(0, 0);
        this._angularSpringZ = false;
        this._angularStiffnessZ = 0;
        this._angularEquilibriumZ = 0;

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

    set angularSpringX(value) {
        if (this._angularSpringX !== value) {
            this._angularSpringX = value;
            this._constraint.enableSpring(3, value);
        }
    }

    get angularSpringX() {
        return this._angularSpringX;
    }

    set angularStiffnessX(value) {
        if (this._angularStiffnessX !== value) {
            this._angularStiffnessX = value;
            this._constraint.setStiffness(3, value);
        }
    }

    get angularStiffnessX() {
        return this._angularStiffnessX;
    }

    set angularEquilibriumX(value) {
        if (this._angularEquilibriumX !== value) {
            this._angularEquilibriumX = value;
            this._constraint.setEquilibriumPoint(3, value);
        }
    }

    get angularEquilibriumX() {
        return this._angularEquilibriumX;
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

    set angularSpringY(value) {
        if (this._angularSpringY !== value) {
            this._angularSpringY = value;
            this._constraint.enableSpring(4, value);
        }
    }

    get angularSpringY() {
        return this._angularSpringY;
    }

    set angularStiffnessY(value) {
        if (this._angularStiffnessY !== value) {
            this._angularStiffnessY = value;
            this._constraint.setStiffness(4, value);
        }
    }

    get angularStiffnessY() {
        return this._angularStiffnessY;
    }

    set angularEquilibriumY(value) {
        if (this._angularEquilibriumY !== value) {
            this._angularEquilibriumY = value;
            this._constraint.setEquilibriumPoint(4, value);
        }
    }

    get angularEquilibriumY() {
        return this._angularEquilibriumY;
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

    set angularSpringZ(value) {
        if (this._angularSpringZ !== value) {
            this._angularSpringZ = value;
            this._constraint.enableSpring(5, value);
        }
    }

    get angularSpringZ() {
        return this._angularSpringZ;
    }

    set angularStiffnessZ(value) {
        if (this._angularStiffnessZ !== value) {
            this._angularStiffnessZ = value;
            this._constraint.setStiffness(5, value);
        }
    }

    get angularStiffnessZ() {
        return this._angularStiffnessZ;
    }

    set angularEquilibriumZ(value) {
        if (this._angularEquilibriumZ !== value) {
            this._angularEquilibriumZ = value;
            this._constraint.setEquilibriumPoint(5, value);
        }
    }

    get angularEquilibriumZ() {
        return this._angularEquilibriumZ;
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

    set linearSpringX(value) {
        if (this._linearSpringX !== value) {
            this._linearSpringX = value;
            this._constraint.enableSpring(0, value);
        }
    }

    get linearSpringX() {
        return this._linearSpringX;
    }

    set linearStiffnessX(value) {
        if (this._linearStiffnessX !== value) {
            this._linearStiffnessX = value;
            this._constraint.setStiffness(0, value);
        }
    }

    get linearStiffnessX() {
        return this._linearStiffnessX;
    }

    set linearEquilibriumX(value) {
        if (this._linearEquilibriumX !== value) {
            this._linearEquilibriumX = value;
            this._constraint.setEquilibriumPoint(0, value);
        }
    }

    get linearEquilibriumX() {
        return this._linearEquilibriumX;
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

    set linearSpringY(value) {
        if (this._linearSpringY !== value) {
            this._linearSpringY = value;
            this._constraint.enableSpring(1, value);
        }
    }

    get linearSpringY() {
        return this._linearSpringY;
    }

    set linearStiffnessY(value) {
        if (this._linearStiffnessY !== value) {
            this._linearStiffnessY = value;
            this._constraint.setStiffness(1, value);
        }
    }

    get linearStiffnessY() {
        return this._linearStiffnessY;
    }

    set linearEquilibriumY(value) {
        if (this._linearEquilibriumY !== value) {
            this._linearEquilibriumY = value;
            this._constraint.setEquilibriumPoint(1, value);
        }
    }

    get linearEquilibriumY() {
        return this._linearEquilibriumY;
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

    set linearSpringZ(value) {
        if (this._linearSpringZ !== value) {
            this._linearSpringZ = value;
            this._constraint.enableSpring(2, value);
        }
    }

    get linearSpringZ() {
        return this._linearSpringZ;
    }

    set linearStiffnessZ(value) {
        if (this._linearStiffnessZ !== value) {
            this._linearStiffnessZ = value;
            this._constraint.setStiffness(2, value);
        }
    }

    get linearStiffnessZ() {
        return this._linearStiffnessZ;
    }

    set linearEquilibriumZ(value) {
        if (this._linearEquilibriumZ !== value) {
            this._linearEquilibriumZ = value;
            this._constraint.setEquilibriumPoint(2, value);
        }
    }

    get linearEquilibriumZ() {
        return this._linearEquilibriumZ;
    }

    _convertTransform(pcTransform, ammoTransform) {
        var pos = pcTransform.getTranslation();
        var rot = new Quat();
        rot.setFromMat4(pcTransform);

        var ammoVec = new Ammo.btVector3(pos.x, pos.y, pos.z);
        var ammoQuat = new Ammo.btQuaternion(rot.x, rot.y, rot.z, rot.w);

        ammoTransform.setOrigin(ammoVec);
        ammoTransform.setRotation(ammoQuat);

        Ammo.destroy(ammoVec);
        Ammo.destroy(ammoQuat);
    }

    _updateAngularLimits() {
        var constraint = this._constraint;
        if (constraint) {
            var alx = this._angularLimitsX;
            var aly = this._angularLimitsY;
            var alz = this._angularLimitsZ;

            var limits = new Ammo.btVector3(alx.x, aly.x, alz.x);
            constraint.setAngularLowerLimit(limits);
            limits.setValue(alx.y, aly.y, alz.y);
            constraint.setAngularUpperLimit(limits);
            Ammo.destroy(limits);
        }
    }

    _updateLinearLimits() {
        var constraint = this._constraint;
        if (constraint) {
            var llx = this._linearLimitsX;
            var lly = this._linearLimitsY;
            var llz = this._linearLimitsZ;

            var limits = new Ammo.btVector3(llx.x, lly.x, llz.x);
            constraint.setLinearLowerLimit(limits);
            limits.setValue(llx.y, lly.y, llz.y);
            constraint.setLinearUpperLimit(limits);
            Ammo.destroy(limits);
        }
    }

    _createConstraint() {
        if (this._entityA && this._entityA.rigidbody) {
            this._destroyConstraint();

            var mat = new Mat4();

            var bodyA = this._entityA.rigidbody.body;
            var bodyB;
            var frameA = new Ammo.btTransform();

            var jointWtm = this.entity.getWorldTransform();

            var entityWtm = this._entityA.getWorldTransform();
            var invEntityWtm = entityWtm.clone().invert();
            mat.mul2(invEntityWtm, jointWtm);

            this._convertTransform(mat, frameA);

            if (this._entityB && this._entityB.rigidbody) {
                bodyB = this._entityB.rigidbody.body;
                var frameB = new Ammo.btTransform();

                entityWtm = this._entityB.getWorldTransform();
                invEntityWtm = entityWtm.clone().invert();
                mat.mul2(invEntityWtm, jointWtm);

                this._convertTransform(mat, frameB);

                this._constraint = new Ammo.btGeneric6DofSpringConstraint(bodyA, bodyB, frameA, frameB, !this._enableCollision);
                Ammo.destroy(frameB);
            } else {
                this._constraint = new Ammo.btGeneric6DofSpringConstraint(bodyA, frameA, !this._enableCollision);
            }

            Ammo.destroy(frameA);

            this._constraint.setBreakingImpulseThreshold(this._breakForce);
            this._constraint.enableSpring(0, this._linearSpringX);
            this._constraint.setStiffness(0, this._linearStiffnessX);
            this._constraint.setEquilibriumPoint(0, this._linearEquilibriumX);
            this._constraint.enableSpring(1, this._linearSpringY);
            this._constraint.setStiffness(1, this._linearStiffnessY);
            this._constraint.setEquilibriumPoint(1, this._linearEquilibriumY);
            this._constraint.enableSpring(2, this._linearSpringZ);
            this._constraint.setStiffness(2, this._linearStiffnessZ);
            this._constraint.setEquilibriumPoint(2, this._linearEquilibriumZ);
            this._constraint.enableSpring(3, this._angularSpringX);
            this._constraint.setStiffness(3, this._angularStiffnessX);
            this._constraint.setEquilibriumPoint(3, this._angularEquilibriumX);
            this._constraint.enableSpring(4, this._angularSpringY);
            this._constraint.setStiffness(4, this._angularStiffnessY);
            this._constraint.setEquilibriumPoint(4, this._angularEquilibriumY);
            this._constraint.enableSpring(5, this._angularSpringZ);
            this._constraint.setStiffness(5, this._angularStiffnessZ);
            this._constraint.setEquilibriumPoint(5, this._angularEquilibriumZ);

            this._updateLinearLimits();
            this._updateAngularLimits();

            var app = this.system.app;
            var dynamicsWorld = app.systems.rigidbody.dynamicsWorld;
            dynamicsWorld.addConstraint(this._constraint, !this._enableCollision);

            bodyA.activate();
            if (bodyB) {
                bodyB.activate();
            }
        }
    }

    _destroyConstraint() {
        if (this._constraint) {
            var app = this.system.app;
            var dynamicsWorld = app.systems.rigidbody.dynamicsWorld;
            dynamicsWorld.removeConstraint(this._constraint);

            Ammo.destroy(this._constraint);
            this._constraint = null;
        }
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

export { JointComponent };
