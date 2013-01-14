pc.extend(pc.fw, function () {
    // Shared math variable to avoid excessive allocation
    var vel = pc.math.vec3.create();

    var quat = pc.math.quat.create();
    var ammoTransform;
    var ammoVec1, ammoVec2, ammoQuat, ammoOrigin;

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
            ammoOrigin = new Ammo.btVector3(0,0,0);
        }

        this.on('set_mass', this.onSetMass, this);
        this.on('set_friction', this.onSetFriction, this);
        this.on('set_restitution', this.onSetRestitution, this);
        this.on('set_bodyType', this.onSetBodyType, this);

        this.on('set_body', this.onSetBody, this);

        entity.on('livelink:updatetransform', this.onLiveLinkUpdateTransform, this);

        // For kinematic
        this.displacement = pc.math.vec3.create();
        this.linearVelocity = pc.math.vec3.create();
        this.angularVelocity = pc.math.vec3.create();

    };
    Body3dComponent = pc.inherits(Body3dComponent, pc.fw.Component);

    pc.extend(Body3dComponent.prototype, {
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
                if (relativePoint) {
                    ammoVec2.setValue(relativePoint[0], relativePoint[1], relativePoint[2]);
                    body.applyForce(ammoVec1, ammoVec2);
                } else {
                    body.applyForce(ammoVec1, ammoOrigin);
                }
                
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
                if (relativePoint) {
                    ammoVec2.setValue(relativePoint[0], relativePoint[1], relativePoint[2]);
                    body.applyImpulse(ammoVec1, ammoVec2);                    
                } else {
                    body.applyImpulse(ammoVec1, ammoOrigin);
                }
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
         * @description Set the angular velocity of the body
         * @param {Number} x The x value of the angular velocity
         * @param {Number} y The y value of the angular velocity
         * @param {Number} z The z value of the angular velocity
         */
        setAngularVelocity: function (x, y, z) {
            if (!this.isKinematic()) {
                var body = this.entity.body3d.body;
                if (body) {
                    ammoVec1.setValue(x, y, z);
                    body.setAngularVelocity(ammoVec1);
                }
            } else {
                pc.math.vec3.set(this.angularVelocity, x, y, z);
            }
        },

        // /**
        // * @private
        // * @name pc.fw.Body3dComponent#setLinearDamping
        // * @description Set the linear damping value of the body. 
        // * Damping parameters should be between 0 and 1.
        // * @param {Number} damping The damping value
        // */
        // setLinearDamping: function (damping) {
        //     var body = this.entity.body3d.body;
        //     if (body) {
        //         body.setDamping(damping, 0);
        //     }
        // },

        // setAngularDamping: function (damping) {
        //     if (this.body) {
        //         this.body.setDamping(0, damping);
        //     }
        // },

        isStatic: function () {
            return (this.bodyType === pc.fw.BODY3D_TYPE_STATIC);
        },

        isStaticOrKinematic: function () {
            return (this.bodyType === pc.fw.BODY3D_TYPE_STATIC || this.bodyType === pc.fw.BODY3D_TYPE_KINEMATIC);
        },

        isKinematic: function () {
            return (this.bodyType === pc.fw.BODY3D_TYPE_KINEMATIC);
        },


        /**
        * @private
        * @name pc.fw.Body3dComponent#syncTransform
        * @description Set the rigid body transform to to be the same as the Entity transform.
        * This must be called after any Entity transformation functions (e.g. {@link pc.fw.Entity#setPosition}) are called
        * in order to update the rigid body to match the Entity.
        */
        syncTransform: function () {
            var transform = this.entity.getWorldTransform();

            var body = this.entity.body3d.body;
            if (body) {
                var position = pc.math.mat4.getTranslation(transform);
                pc.math.mat4.toQuat(transform, quat);

                var transform = body.getWorldTransform();
                transform.getOrigin().setValue(position[0], position[1], position[2]);
                
                ammoQuat.setValue(quat[0], quat[1], quat[2], quat[3]);
                transform.setRotation(ammoQuat);

                body.activate();
            }
        },

        /** 
        * @private
        * @name pc.fwBody3dComponent#syncEntity
        * @description Update the Entity transform from the rigid body.
        * This is called after the simulation is stepped, to keep the Entity transform in sync with the rigid body transform.
        */
        syncEntityTransform: function () {
            var body = this.body;
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

        /**
        * @private
        * @function
        * @name pc.fw.Body3dComponent#updateKinematic
        * @description Kinematic objects maintain their own linear and angular velocities. This method updates their transform
        * based on their current velocity. It is called in every frame in the main physics update loop, after the simulation is stepped.
        */
        updateKinematic: function (dt) {
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
            }                
        },

        onSetBodyType: function (name, oldValue, newValue) {
            if (newValue !== oldValue) {
                // Create a new body
                this.createBody();
            }
        },

        onSetBody: function (name, oldValue, newValue) {
            if (this.body) {
                this.body.activate();
            }
        },

        onLiveLinkUpdateTransform: function (position, rotation, scale) {
            this.syncTransform();
            // Reset velocities
            this.setLinearVelocity(0,0,0);
            this.setAngularVelocity(0,0,0);    
        }
    });

    return {
        Body3dComponent: Body3dComponent
    };
}());