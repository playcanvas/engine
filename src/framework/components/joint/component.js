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

        this._breakForce = 3.4e+38;
        this._entityA = null;
        this._entityB = null;
        this._constraint = null;
        this._enableCollision = true;
        this._linearLimitsX = new Vec2(0, 0);
        this._linearLimitsY = new Vec2(0, 0);
        this._linearLimitsZ = new Vec2(0, 0);
        this._angularLimitsX = new Vec2(0, 0);
        this._angularLimitsY = new Vec2(0, 0);
        this._angularLimitsZ = new Vec2(0, 0);

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
        this._destroyJoint();
        this._enableCollision = enableCollision;
        this._createJoint();
    }

    get enableCollision() {
        return this._enableCollision;
    }

    set angularLimitsX(limits) {
        if (!this._anularLimitsX.equals(limits)) {
            this._angularLimitsX.copy(limits);
            this._updateAngularLimits();
        }
    }

    get angularLimitsX() {
        return this._angularLimitsX;
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

    set angularLimitsZ(limits) {
        if (!this._angularLimitsZ.equals(limits)) {
            this._angularLimitsZ.copy(limits);
            this._updateAngularLimits();
        }
    }

    get angularLimitsZ() {
        return this._angularLimitsZ;
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

    set linearLimitsY(limits) {
        if (!this._linearLimitsY.equals(limits)) {
            this._linearLimitsY.copy(limits);
            this._updateLinearLimits();
        }
    }

    get linearLimitsY() {
        return this._linearLimitsY;
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

                this._constraint = new Ammo.btGeneric6DofConstraint(bodyA, bodyB, frameA, frameB, !this._enableCollision);
                Ammo.destroy(frameB);
            } else {
                this._constraint = new Ammo.btGeneric6DofConstraint(bodyA, frameA, !this._enableCollision);
            }

            Ammo.destroy(frameA);

            this._constraint.setBreakingImpulseThreshold(this._breakForce);

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
