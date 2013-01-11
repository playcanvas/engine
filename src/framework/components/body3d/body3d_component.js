pc.extend(pc.fw, function () {
    // Shared math variable to avoid excessive allocation
    var vel = pc.math.vec3.create();

    var quat = pc.math.quat.create();
    var ammoTransform;
    var ammoVec1, ammoVec2, ammoQuat;

    /**
     * @private
     * @name pc.fw.Body3dComponent
     * @constructor Create a new Body3dComponent
     * @class 
     * @param {Object} context
     * @extends pc.fw.Component
     */
    var Body3dComponent = function Body3dComponent (system, entity) {
        // Lazily create shared variable
        if (typeof(Ammo) !== 'undefined' && !ammoTransform) {
            ammoTransform = new Ammo.btTransform();
            ammoVec1 = new Ammo.btVector3();
            ammoVec2 = new Ammo.btVector3();
            ammoQuat = new Ammo.btQuaternion();
        }

        this.on('set_mass', this.onSetMass, this);
        this.on('set_friction', this.onSetFriction, this);
        this.on('set_restitution', this.onSetRestitution, this);
        //this.on('set_static', this.onSetStatic, this);
        this.on('set_bodyType', this.onSetBodyType, this);

        entity.on('livelink:updatetransform', this.onLiveLinkUpdateTransform, this);

        // For kinematic
        this.displacement = pc.math.vec3.create();

        this.linearVelocity = pc.math.vec3.create();
        this.angularVelocity = pc.math.vec3.create();

    };
    Body3dComponent = pc.inherits(Body3dComponent, pc.fw.Component);

    pc.extend(Body3dComponent.prototype, {
        /**
         * @private
         * @name pc.fw.Body3dComponent#applyForce
         * @description Apply an force to the body
         * @param {pc.math.vec3} force The force to apply, in world space.
         * @param {pc.math.vec3} relativePoint The point at which to apply the force, in local space (relative to the entity).
         */
        applyForce: function (force, relativePoint) {
            var body = this.entity.body3d.body;
            if (body) {
                ammoVec1.setValue(force[0], force[1], force[2]);
                ammoVec2.setValue(relativePoint[0], relativePoint[1], relativePoint[2]);
                body.applyForce(ammoVec1, ammoVec2);
            }
        },

        /**
         * @private
         * @name pc.fw.Body3dComponent#applyImpulse
         * @description Apply an impulse (instantaneous change of velocity) to the body
         * @param {pc.math.vec3} impulse The impulse to apply, in world space.
         * @param {pc.math.vec3} relativePoint The point at which to apply the impulse, in local space (relative to the entity).
         */
        applyImpulse: function (impulse, relativePoint) {
            var body = this.entity.body3d.body;
            if (body) {
                ammoVec1.setValue(impulse[0], impulse[1], impulse[2]);
                ammoVec2.setValue(relativePoint[0], relativePoint[1], relativePoint[2]);
                body.applyImpulse(ammoVec1, ammoVec2);
            }
        },

        /**
         * @private
         * @name pc.fw.Body3dComponentSystem#setLinearVelocity
         * @description Set the linear velocity of the body.
         * @param {Number} x The x value of the velocity
         * @param {Number} y The y value of the velocity
         * @param {Number} y The z value of the velocity
         */
        setLinearVelocity: function (x, y, z) {
            if (!this.isKinematic()) {
                var body = this.entity.body3d.body;
                if (body) {
                    ammoVec1.setValue(x, y, z);
                    body.setLinearVelocity(ammoVec1);
                }                
            } else {
                pc.math.vec3.set(this.linearVelocity, x, y, z);
            }
        },

        /**
         * @private
         * @name pc.fw.Body3dComponent#setAngularVelocity
         * @description Set the angular  velocity of the body
         * @param {Number} x The x value of the angular velocity
         * @param {Number} y The y value of the angular velocity
         * @param {Number} z The z value of the angular velocity
         */
        setAngularVelocity: function (x, y, z) {
            var body = this.entity.body3d.body;
            if (body) {
                ammoVec1.setValue(x, y, z);
                body.setAngularVelocity(ammoVec1);
            }
        },

        setTransform: function (transform) {
            var body = this.entity.body3d.body;
            if (body) {
                var position = pc.math.mat4.getTranslation(transform);
                pc.math.mat4.toQuat(transform, quat);

                var transform = body.getWorldTransform();
                transform.getOrigin().setValue(position[0], position[1], position[2]);
                
                ammoQuat.setValue(quat[0], quat[1], quat[2], quat[3]);
                transform.setRotation(ammoQuat);

                this.setLinearVelocity(0, 0, 0);
                this.setAngularVelocity(0, 0, 0);
                body.activate();
            }
        },

        createBody: function () {
            var entity = this.entity;
            var shape;

            if (entity.collisionbox) {
                shape = entity.collisionbox.shape;
            }
            else if (entity.collisionsphere) {
                shape = entity.collisionsphere.shape;
            }

            if (shape) {
                if (this.body) {
                    this.system.removeBody(this.body);
                    Ammo.destroy(this.body);
                }

                var isStaticOrKinematic = this.isStaticOrKinematic();
                var mass = isStaticOrKinematic ? 0 : this.mass;

                var localInertia = new Ammo.btVector3(0, 0, 0);
                if (!isStaticOrKinematic) {
                    shape.calculateLocalInertia(mass, localInertia);
                }

                var pos = entity.getPosition();
                var rot = entity.getRotation();
                ammoQuat.setValue(rot[0], rot[1], rot[2], rot[3]);

                var startTransform = new Ammo.btTransform();
                startTransform.setIdentity();
                startTransform.getOrigin().setValue(pos[0], pos[1], pos[2]);
                startTransform.setRotation(ammoQuat);

                var motionState = new Ammo.btDefaultMotionState(startTransform);
                var bodyInfo = new Ammo.btRigidBodyConstructionInfo(mass, motionState, shape, localInertia);

                var body = new Ammo.btRigidBody(bodyInfo);
                body.setRestitution(this.restitution);
                body.setFriction(this.friction);

                if (this.isKinematic()) {
                    body.setCollisionFlags(body.getCollisionFlags() | pc.fw.BODY3D_CF_KINEMATIC_OBJECT);
                    body.setActivationState(pc.fw.BODY3D_DISABLE_DEACTIVATION);
                }

                body.entity = entity;

                this.system.addBody(body);

                entity.body3d.body = body;
                entity.body3d.body.activate();
            }
        },

        /** 
        Replacement for pc.scene.GraphNode#setPosition()
        Used by Entities with a Body3d Component so that when entity.setPosition() is called, the body transform can be updated
        */
        _setPosition: function (x, y, z) {
            if (arguments.length > 1) {
                this._setPosition(x, y, z);    
            } else {
                this._setPosition(x);
            }

            if (this.body3d && this.body3d.body) {
                var transform = this.body3d.body.getWorldTransform();
                transform.getOrigin().setValue(x, y, z);

                this.body3d.body.activate();
            }
        },

        /**
        * @private
        * @name pc.fw.Body3dComponent#setPosition
        * @description Set the position of the body
        * @param {Number} x The x value of the position
        * @param {Number} y The y value of the position
        * @param {Number} z The z value of the position
        */
        // setPosition: function (x, y, z) {
        //     var body = this.entity.body3d.body;
        //     if (body) {
        //         var transform = body.getWorldTransform();
        //         transform.setOrigin(new Ammo.btVector3(x, y, z));

        //         body.activate();

        //         this.entity.setPosition(x, y, z);
        //     }
        // },

        /**
        * @private
        * @name pc.fw.Body3dComponent#setAngle
        * @description Set the angle of the body
        * @param {Number} a The new angle, in degrees
        */
        setRotation: function (x, y, z) {
            var body = this.entity.body3d.body;
            if (body) {
                pc.math.quat.setFromEulers(quat, x, y, z);
                ammoQuat.setValue(quat[0], quat[1], quat[2], quat[3]);

                var transform = body.getWorldTransform();
                transform.setRotation(ammoQuat);

                body.activate();

                this.entity.setEulerAngles(x, y, z);
            }
        },

        /**
        * @private
        * @name pc.fw.Body3dComponent#setLinearDamping
        * @description Set the linear damping value of the body. 
        * Damping parameters should be between 0 and infinity, with 0 meaning no damping, and infinity 
        * meaning full damping. Normally you will use a damping value between 0 and 0.1
        * @param {Number} damping The damping value
        */
        setLinearDamping: function (entity, damping) {
            var body = this.entity.body3d.body;
            if (body) {
                body.setDamping(damping, 1);
            }
        },

        isStatic: function () {
            return (this.bodyType === pc.fw.BODY3D_TYPE_STATIC);
        },

        isStaticOrKinematic: function () {
            return (this.bodyType === pc.fw.BODY3D_TYPE_STATIC || this.bodyType === pc.fw.BODY3D_TYPE_KINEMATIC);
        },

        isKinematic: function () {
            return (this.bodyType === pc.fw.BODY3D_TYPE_KINEMATIC);
        },

        updateKinematicTransform: function (dt) {
            pc.math.vec3.scale(this.linearVelocity, dt, this.displacement);
            this.entity.translate(this.displacement);

            pc.math.vec3.scale(this.angularVelocity, dt, this.displacement);
            this.entity.rotate(this.displacement[0], this.displacement[1], this.displacement[2]);
            if (this.body.getMotionState()) {
                var pos = this.entity.getPosition();
                var rot = this.entity.getRotation();

                ammoTransform.getOrigin().setValue(pos[0], pos[1], pos[2]);
                ammoQuat.setValue(rot[0], rot[1], rot[2], rot[3]);
                ammoTransform.setRotation(ammoQuat);
                this.body.getMotionState().setWorldTransform(ammoTransform);
            }
        },

        /** 
        * update the Entity transform from the RigidBody
        */
        updateTransform: function (body) {
            if (body.isActive() && body.getMotionState()) {
                body.getMotionState().getWorldTransform(ammoTransform);

                var p = ammoTransform.getOrigin();
                var q = ammoTransform.getRotation();
                this.entity.setPosition(p.x(), p.y(), p.z());
                quat[0] = q.x();
                quat[1] = q.y();
                quat[2] = q.z();
                quat[3] = q.w();
                this.entity.setRotation(quat);
            }
        },

        onSetMass: function (name, oldValue, newValue) {
            var body = this.data.body;
            if (body) {
                this.system.removeBody(body);

                var mass = newValue;
                var localInertia = new Ammo.btVector3(0, 0, 0);
                body.getCollisionShape().calculateLocalInertia(mass, localInertia);
                body.setMassProps(mass, localInertia);
                body.updateInertiaTensor();

                this.system.addBody(body);
            }
        },

        onSetFriction: function (name, oldValue, newValue) {
            var body = this.data.body;
            if (body) {
                body.setFriction(newValue);
            }                
        },

        onSetRestitution: function (name, oldValue, newValue) {
            var body = this.data.body;
            if (body) {
                body.setRestitution(newValue);
                // if (this.data.static) {
                //     body.setRestitution(1);
                // } else {
                //     body.setRestitution(newValue);
                // }
            }                
        },

        // onSetStatic: function (name, oldValue, newValue) {
        //     var body = this.data.body;
        //     if (body) {
        //     }
        // },

        onSetBodyType: function (name, oldValue, newValue) {
            if (newValue !== oldValue) {
                this.createBody();    
            }
        },

        onLiveLinkUpdateTransform: function (position, rotation, scale) {
            this.setTransform(this.entity.getWorldTransform());
            this.setLinearVelocity(0,0,0);
            this.setAngularVelocity(0,0,0);    
        }
    });

    return {
        Body3dComponent: Body3dComponent
    };
}());