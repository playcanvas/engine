pc.extend(pc.fw, function () {
    // Shared math variable to avoid excessive allocation
    var quat = pc.math.quat.create();
    var ammoTransform;
    var ammoVec1, ammoVec2, ammoQuat, ammoOrigin;

    /**
     * @component
     * @name pc.fw.RigidBodyComponent
     * @constructor Create a new RigidBodyComponent
     * @class The rigidbody Component, when combined with a collision volume Component, e.g. {@link pc.fw.CollisionBoxComponent}, allows your Entities to be simulated using realistic physics. 
     * A rigidbody Component will fall under gravity and collide with other rigid bodies, using scripts you can apply forces to the body.
     * @param {pc.fw.RigidBodyComponentSystem} system The ComponentSystem that created this Component
     * @param {pc.fw.Entity} entity The Entity this Component is attached to
     * @extends pc.fw.Component
     * @property {Number} mass The mass of the body. This is only relevant for {@link pc.fw.RIGIDBODY_TYPE_DYNAMIC} bodies, other types have infinite mass.
     * @property {Number} friction The friction value used when contacts occur between two bodies. A higher value indicates more friction.
     * @property {Number} restitution The amount of energy lost when two objects collide, this determines the bounciness of the object. 
     * A value of 0 means that no energy is lost in the collision, a value of 1 means that all energy is lost. 
     * So the higher the value the less bouncy the object is.
     * @property {pc.fw.RIGIDBODY_TYPE} bodyType The type of RigidBody determines how it is simulated. 
     * Static objects have infinite mass and cannot move, 
     * Dynamic objects are simulated according to the forces applied to them, 
     * Kinematic objects have infinite mass and do not respond to forces, but can still be moved by setting their velocity or position.
     */
    var RigidBodyComponent = function RigidBodyComponent (system, entity) {
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
    RigidBodyComponent = pc.inherits(RigidBodyComponent, pc.fw.Component);

    pc.extend(RigidBodyComponent.prototype, {
        /**
        * @private
        * @function
        * @name pc.fw.RigidBodyComponent#createBody
        * @description If the Entity has a Collision shape attached then create a rigid body using this shape. This method destroys the existing body.
        */
        createBody: function () {
            var entity = this.entity;
            var shape;

            if (entity.collisionbox) {
                shape = entity.collisionbox.shape;
            } else if (entity.collisioncapsule) {
                shape = entity.collisioncapsule.shape;
            } else if (entity.collisionsphere) {
                shape = entity.collisionsphere.shape;
            } else if (entity.collisionmesh) {
                shape = entity.collisionmesh.shape;
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
                    body.setCollisionFlags(body.getCollisionFlags() | pc.fw.RIGIDBODY_CF_KINEMATIC_OBJECT);
                    body.setActivationState(pc.fw.RIGIDBODY_DISABLE_DEACTIVATION);
                }

                body.entity = entity;

                this.system.addBody(body);

                entity.rigidbody.body = body;
                entity.rigidbody.body.activate();
            }
        },

        /**
        * @function
        * @name pc.fw.RigidBodyComponent#isActive
        * @description Returns true if the rigid body is currently actively being simulated. i.e. not 'sleeping'
        * @returns {Boolean} True if the body is active
        */
        isActive: function () {
            if (this.body) {
                return this.body.isActive();
            }

            return false;
        },

        /**
        * @function
        * @name pc.fw.RigidBodyComponent#activate
        * @description Forceably activate the rigid body simulation
        */
        activate: function () {
            if (this.body) {
                this.body.activate();
            }
        },

        /**
         * @function
         * @name pc.fw.RigidBodyComponent#applyForce
         * @description Apply an force to the body at a point
         * @param {pc.math.vec3} force The force to apply, in world space.
         * @param {pc.math.vec3} [relativePoint] The point at which to apply the force, in local space (relative to the entity).
         */

        /**
         * @function
         * @name pc.fw.RigidBodyComponent#applyForce^2
         * @description Apply an force to the body at a point
         * @param {Number} x The x component of the force to apply, in world space.
         * @param {Number} y The y component of the force to apply, in world space.
         * @param {Number} z The z component of the force to apply, in world space.
         * @param {Number} [px] The x component of the point at which to apply the force, in local space (relative to the Entity).
         * @param {Number} [py] The y component of the point at which to apply the force, in local space (relative to the Entity).
         * @param {Number} [pz] The z component of the point at which to apply the force, in local space (relative to the Entity).
         */
        applyForce: function () {
            var x, y, z;
            var px,py,pz;
            switch (arguments.length) {
                case 1:
                    x = arguments[0][0];
                    y = arguments[0][1];
                    z = arguments[0][2];
                    break;
                case 2:
                    x = arguments[0][0];
                    y = arguments[0][1];
                    z = arguments[0][2];
                    px = arguments[1][0];
                    py = arguments[1][1];
                    pz = arguments[1][2];
                    break;
                case 3:
                    x = arguments[0];
                    y = arguments[1];
                    z = arguments[2];
                    break;
                case 6:
                    x = arguments[0];
                    y = arguments[1];
                    z = arguments[2];
                    px = arguments[0];
                    py = arguments[1];
                    pz = arguments[2];
                    break;
            }
            var body = this.body;
            if (body) {
                ammoVec1.setValue(x, y, z);
                if (typeof(px) !== 'undefined') {
                    ammoVec2.setValue(px, py, pz);
                    body.applyForce(ammoVec1, ammoVec2);
                } else {
                    body.applyForce(ammoVec1, ammoOrigin);
                }
                
            }
        },

        /**
         * @function
         * @name pc.fw.RigidBodyComponent#applyImpulse
         * @description Apply an impulse (instantaneous change of velocity) to the body at a point.
         * @param {pc.math.vec3} impulse The impulse to apply, in world space.
         * @param {pc.math.vec3} [relativePoint] The point at which to apply the impulse, in local space (relative to the entity).
         */

        /**
         * @function
         * @name pc.fw.RigidBodyComponent#applyImpulse^2
         * @description Apply an impulse (instantaneous change of velocity) to the body at a point.
         * @param {Number} x The x component of the impulse to apply, in world space.
         * @param {Number} y The y component of the impulse to apply, in world space.
         * @param {Number} z The z component of the impulse to apply, in world space.
         * @param {Number} [px] The x component of the point at which to apply the impulse, in local space (relative to the Entity).
         * @param {Number} [py] The y component of the point at which to apply the impulse, in local space (relative to the Entity).
         * @param {Number} [pz] The z component of the point at which to apply the impulse, in local space (relative to the Entity).
        */
        applyImpulse: function () {
            var x, y, z;
            var px,py,pz;
            switch (arguments.length) {
                case 1:
                    x = arguments[0][0];
                    y = arguments[0][1];
                    z = arguments[0][2];
                    break;
                case 2:
                    x = arguments[0][0];
                    y = arguments[0][1];
                    z = arguments[0][2];
                    px = arguments[1][0];
                    py = arguments[1][1];
                    pz = arguments[1][2];
                    break;
                case 3:
                    x = arguments[0];
                    y = arguments[1];
                    z = arguments[2];
                    break;
                case 6:
                    x = arguments[0];
                    y = arguments[1];
                    z = arguments[2];
                    px = arguments[0];
                    py = arguments[1];
                    pz = arguments[2];
                    break;
            }
            var body = this.body;
            if (body) {
                ammoVec1.setValue(x, y, z);
                if (typeof(px) !== 'undefined') {
                    ammoVec2.setValue(px, py, pz);
                    body.applyImpulse(ammoVec1, ammoVec2);                    
                } else {
                    body.applyImpulse(ammoVec1, ammoOrigin);
                }
            }
        },

        /**
        * @function
        * @name pc.fw.RigidBodyComponent#getLinearVelocity
        * @description Return the current linear velocity of the rigid body
        * @returns {pc.math.vec3} The linear velocity
        */
        getLinearVelocity: function () {
            if (!this.isKinematic()) {
                if (this.body) {
                    var vel = this.body.getLinearVelocity();
                    pc.math.vec3.set(this.linearVelocity, vel.x(), vel.y(), vel.z());
                    return this.linearVelocity;
                }
            } else {
                return this.linearVelocity;
            }
        },

        /**
        * @function
        * @name pc.fw.RigidBodyComponent#getAngularVelocity
        * @description Return the current angular velocity of the rigid body
        * @returns {pc.math.vec3} The angular velocity
        */
        getAngularVelocity: function () {
            if (!this.isKinematic()) {
                if (this.body) {
                    var vel = this.body.getAngularVelocity();
                    pc.math.vec3.set(this.angularVelocity, vel.x(), vel.y(), vel.z());
                    return this.angularVelocity;
                }
            } else {
                return this.angularVelocity;
            }
        },

        /**
         * @function
         * @name pc.fw.RigidBodyComponent#setLinearVelocity
         * @description Set the linear velocity of the body.
         * @param {Number} x The x value of the velocity
         * @param {Number} y The y value of the velocity
         * @param {Number} z The z value of the velocity
         */
        setLinearVelocity: function (x, y, z) {
            if (!this.isKinematic()) {
                var body = this.body;
                if (body) {
                    ammoVec1.setValue(x, y, z);
                    body.setLinearVelocity(ammoVec1);
                }                
            } else {
                pc.math.vec3.set(this.linearVelocity, x, y, z);
            }
        },

        /**
         * @function
         * @name pc.fw.RigidBodyComponent#setAngularVelocity
         * @description Set the angular velocity of the body
         * @param {Number} x The x value of the angular velocity
         * @param {Number} y The y value of the angular velocity
         * @param {Number} z The z value of the angular velocity
         */
        setAngularVelocity: function (x, y, z) {
            if (!this.isKinematic()) {
                var body = this.body;
                if (body) {
                    ammoVec1.setValue(x, y, z);
                    body.setAngularVelocity(ammoVec1);
                }
            } else {
                pc.math.vec3.set(this.angularVelocity, x, y, z);
            }
        },

        /**
        * @function
        * @name pc.fw.RigidBodyComponent#setLinearFactor
        * @description Apply a scaling factor to linear motion in each axis. 
        * Use this to limit motion in one or more axes
        * @param {Number} x The factor to scale x-axis motion by. 0 means no linear motion, 1 means linear motion is unchanged
        * @param {Number} y The factor to scale y-axis motion by. 0 means no linear motion, 1 means linear motion is unchanged
        * @param {Number} z The factor to scale z-axis motion by. 0 means no linear motion, 1 means linear motion is unchanged
        * @example
        * // Restrict motion to the vertical y-axis
        * entity.rigidbody.setLinearFactor(0, 1, 0);
        */
        setLinearFactor: function (x, y, z) {
            if (this.body) {
                this.body.setLinearFactor(x, y, z);
            }
        },

        /**
        * @function
        * @name pc.fw.RigidBodyComponent#setAngularFactor
        * @description Apply a scaling factor to angular motion.
        * @param {Number} f The factor to scale by, 0 means no angular motion, 1 means angular motion is unchanged
        * @example
        * // Prevent an body from rotating
        * entity.rigidbody.setAngularFactor(0);
        */
        setAngularFactor: function (a) {
            if (this.body) {
                this.body.setAngularFactor(a);
            }
        },

        // /**
        // * @private
        // * @name pc.fw.RigidBodyComponent#setLinearDamping
        // * @description Set the linear damping value of the body. 
        // * Damping parameters should be between 0 and 1.
        // * @param {Number} damping The damping value
        // */
        // setLinearDamping: function (damping) {
        //     var body = this.body;
        //     if (body) {
        //         body.setDamping(damping, 0);
        //     }
        // },

        // setAngularDamping: function (damping) {
        //     if (this.body) {
        //         this.body.setDamping(0, damping);
        //     }
        // },

        /**
        * @function
        * @name pc.fw.RigidBodyComponent#isStatic
        * @description Returns true if the rigid body is of type {@link pc.fw.RIGIDBODY_TYPE_STATIC}
        * @returns {Boolean} True if static
        */
        isStatic: function () {
            return (this.bodyType === pc.fw.RIGIDBODY_TYPE_STATIC);
        },

        /**
        * @function
        * @name pc.fw.RigidBodyComponent#isStaticOrKinematic
        * @description Returns true if the rigid body is of type {@link pc.fw.RIGIDBODY_TYPE_STATIC} or {@link pc.fw.RIGIDBODY_TYPE_KINEMATIC}
        * @returns {Boolean} True if static or kinematic
        */
        isStaticOrKinematic: function () {
            return (this.bodyType === pc.fw.RIGIDBODY_TYPE_STATIC || this.bodyType === pc.fw.RIGIDBODY_TYPE_KINEMATIC);
        },

        /**
        * @function
        * @name pc.fw.RigidBodyComponent#isKinematic
        * @description Returns true if the rigid body is of type {@link pc.fw.RIGIDBODY_TYPE_KINEMATIC}
        * @returns {Boolean} True if kinematic
        */
        isKinematic: function () {
            return (this.bodyType === pc.fw.RIGIDBODY_TYPE_KINEMATIC);
        },


        /**
        * @function
        * @name pc.fw.RigidBodyComponent#syncEntityToBody
        * @description Set the rigid body transform to to be the same as the Entity transform.
        * This must be called after any Entity transformation functions (e.g. {@link pc.fw.Entity#setPosition}) are called
        * in order to update the rigid body to match the Entity.
        */
        syncEntityToBody: function () {
            var body = this.body;
            if (body) {
                var position = this.entity.getPosition();
                var rotation = this.entity.getRotation();

                var transform = body.getWorldTransform();
                transform.getOrigin().setValue(position[0], position[1], position[2]);

                ammoQuat.setValue(rotation[0], rotation[1], rotation[2], rotation[3]);
                transform.setRotation(ammoQuat);

                body.activate();
            }
        },

        /** 
        * @private
        * @function
        * @name pc.fwRigidBodyComponent#syncBodyToEntity
        * @description Update the Entity transform from the rigid body.
        * This is called internally after the simulation is stepped, to keep the Entity transform in sync with the rigid body transform.
        */
        syncBodyToEntity: function () {
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
        * @name pc.fw.RigidBodyComponent#updateKinematic
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

        /**
        * Handle an update over livelink from the tools updating the Entities transform
        */
        onLiveLinkUpdateTransform: function (position, rotation, scale) {
            this.syncEntityToBody();
            // Reset velocities
            this.setLinearVelocity(0,0,0);
            this.setAngularVelocity(0,0,0);    
        }
    });

    return {
        RigidBodyComponent: RigidBodyComponent
    };
}());