Object.assign(pc, function () {
    /**
     * @private
     * @component
     * @class
     * @name pc.JointComponent
     * @augments pc.Component
     * @classdesc The JointComponent adds a physics joint constraint linking two rigid bodies.
     * @param {pc.JointComponentSystem} system - The ComponentSystem that created this Component.
     */

    var JointComponent = function JointComponent(system, entity) {
        pc.Component.call(this, system, entity);

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
        this._linearLimitsX = new pc.Vec2(0, 0);
        this._linearLimitsY = new pc.Vec2(0, 0);
        this._linearLimitsZ = new pc.Vec2(0, 0);
        this._angularLimitsX = new pc.Vec2(0, 0);
        this._angularLimitsY = new pc.Vec2(0, 0);
        this._angularLimitsZ = new pc.Vec2(0, 0);

        this.on('set_enabled', this._onSetEnabled, this);
    };
    JointComponent.prototype = Object.create(pc.Component.prototype);
    JointComponent.prototype.constructor = JointComponent;

    Object.assign(JointComponent.prototype, {
        _convertTransform: function (pcTransform, ammoTransform) {
            var pos = pcTransform.getTranslation();
            var rot = new pc.Quat();
            rot.setFromMat4(pcTransform);

            var ammoVec = new Ammo.btVector3(pos.x, pos.y, pos.z);
            var ammoQuat = new Ammo.btQuaternion(rot.x, rot.y, rot.z, rot.w);

            ammoTransform.setOrigin(ammoVec);
            ammoTransform.setRotation(ammoQuat);

            Ammo.destroy(ammoVec);
            Ammo.destroy(ammoQuat);
        },

        _updateAngularLimits: function () {
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
        },

        _updateLinearLimits: function () {
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
        },

        _createConstraint: function () {
            if (this._entityA && this._entityA.rigidbody) {
                this._destroyConstraint();

                var mat = new pc.Mat4();

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
        },

        _destroyConstraint: function () {
            if (this._constraint) {
                var app = this.system.app;
                var dynamicsWorld = app.systems.rigidbody.dynamicsWorld;
                dynamicsWorld.removeConstraint(this._constraint);

                Ammo.destroy(this._constraint);
                this._constraint = null;
            }
        },

        onEnable: function () {
            this._createConstraint();
        },

        onDisable: function () {
            this._destroyConstraint();
        },

        _onSetEnabled: function (prop, old, value) {
        },

        _onBeforeRemove: function () {
            this.fire('remove');
        }
    });

    Object.defineProperties(JointComponent.prototype, {
        entityA: {
            set: function (body) {
                this._destroyConstraint();
                this._entityA = body;
                this._createConstraint();
            },
            get: function () {
                return this._entityA;
            }
        },
        entityB: {
            set: function (body) {
                this._destroyConstraint();
                this._entityB = body;
                this._createConstraint();
            },
            get: function () {
                return this._entityB;
            }
        },
        breakForce: {
            set: function (force) {
                if (this._constraint && this._breakForce !== force) {
                    this._constraint.setBreakingImpulseThreshold(force);
                    this._breakForce = force;
                }
            },
            get: function () {
                return this._breakForce;
            }
        },
        enableCollision: {
            set: function (enableCollision) {
                this._destroyJoint();
                this._enableCollision = enableCollision;
                this._createJoint();
            },
            get: function () {
                return this._enableCollision;
            }
        },
        angularLimitsX: {
            set: function (limits) {
                if (!this._anularLimitsX.equals(limits)) {
                    this._angularLimitsX.copy(limits);
                    this._updateAngularLimits();
                }
            },
            get: function () {
                return this._angularLimitsX;
            }
        },
        angularLimitsY: {
            set: function (limits) {
                if (!this._angularLimitsY.equals(limits)) {
                    this._angularLimitsY.copy(limits);
                    this._updateAngularLimits();
                }
            },
            get: function () {
                return this._angularLimitsY;
            }
        },
        angularLimitsZ: {
            set: function (limits) {
                if (!this._angularLimitsZ.equals(limits)) {
                    this._angularLimitsZ.copy(limits);
                    this._updateAngularLimits();
                }
            },
            get: function () {
                return this._angularLimitsZ;
            }
        },
        linearLimitsX: {
            set: function (limits) {
                if (!this._linearLimitsX.equals(limits)) {
                    this._linearLimitsX.copy(limits);
                    this._updateLinearLimits();
                }
            },
            get: function () {
                return this._linearLimitsX;
            }
        },
        linearLimitsY: {
            set: function (limits) {
                if (!this._linearLimitsY.equals(limits)) {
                    this._linearLimitsY.copy(limits);
                    this._updateLinearLimits();
                }
            },
            get: function () {
                return this._linearLimitsY;
            }
        },
        linearLimitsZ: {
            set: function (limits) {
                if (!this._linearLimitsZ.equals(limits)) {
                    this._linearLimitsZ.copy(limits);
                    this._updateLinearLimits();
                }
            },
            get: function () {
                return this._linearLimitsZ;
            }
        }
    });

    return {
        JointComponent: JointComponent
    };
}());
