pc.extend(pc.fw, function () {
    // Shared math variable to avoid excessive allocation
    var ammoTransform;
    var ammoVec1, ammoVec2, ammoQuat, ammoOrigin;

    /**
     * @component
     * @name pc.fw.RigidBodyComponent
     * @constructor Create a new RigidBodyComponent
     * @class The rigidbody Component, when combined with a {@link pc.fw.CollisionComponent}, allows your Entities to be simulated using realistic physics. 
     * A rigidbody Component will fall under gravity and collide with other rigid bodies, using scripts you can apply forces to the body.
     * @param {pc.fw.RigidBodyComponentSystem} system The ComponentSystem that created this Component
     * @param {pc.fw.Entity} entity The Entity this Component is attached to
     * @extends pc.fw.Component
     * @property {Number} mass The mass of the body. This is only relevant for {@link pc.fw.RIGIDBODY_TYPE_DYNAMIC} bodies, other types have infinite mass.
     * @property {pc.Vec3} linearVelocity Defines the speed of the body in a given direction.
     * @property {pc.Vec3} angularVelocity Defines the rotational speed of the body around each world axis.
     * @property {Number} linearDamping Controls the rate at which a body loses linear velocity over time.
     * @property {Number} angularDamping Controls the rate at which a body loses angular velocity over time.
     * @property {pc.Vec3} linearFactor Scaling factor for linear movement of the body in each axis.
     * @property {pc.Vec3} angularFactor Scaling factor for angular movement of the body in each axis.
     * @property {Number} friction The friction value used when contacts occur between two bodies. A higher value indicates more friction.
     * @property {Number} restitution The amount of energy lost when two objects collide, this determines the bounciness of the object. 
     * A value of 0 means that no energy is lost in the collision, a value of 1 means that all energy is lost. 
     * So the higher the value the less bouncy the object is.
     * @property {pc.fw.RIGIDBODY_TYPE} type The type of RigidBody determines how it is simulated. 
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
            ammoOrigin = new Ammo.btVector3(0, 0, 0);
        }

        this.on('set_enabled', this.onSetEnabled, this);
        this.on('set_mass', this.onSetMass, this);
        this.on('set_linearDamping', this.onSetLinearDamping, this);
        this.on('set_angularDamping', this.onSetAngularDamping, this);
        this.on('set_linearFactor', this.onSetLinearFactor, this);
        this.on('set_angularFactor', this.onSetAngularFactor, this);
        this.on('set_friction', this.onSetFriction, this);
        this.on('set_restitution', this.onSetRestitution, this);
        this.on('set_type', this.onSetType, this);

        this.on('set_body', this.onSetBody, this);

        entity.on('livelink:updatetransform', this.onLiveLinkUpdateTransform, this);
        this.system.on('beforeremove', this.onBeforeRemove, this);

        // For kinematic
        this._displacement = new pc.Vec3(0, 0, 0);
        this._linearVelocity = new pc.Vec3(0, 0, 0);
        this._angularVelocity = new pc.Vec3(0, 0, 0);
    };
    RigidBodyComponent = pc.inherits(RigidBodyComponent, pc.fw.Component);

    Object.defineProperty(RigidBodyComponent.prototype, "bodyType", {
        get: function() {
            console.warn("WARNING: bodyType: Function is deprecated. Query type property instead.");
            return this.type;
        },
        set: function(type) {
            console.warn("WARNING: bodyType: Function is deprecated. Set type property instead.");
            this.type = type;
        },
    });

    Object.defineProperty(RigidBodyComponent.prototype, "linearVelocity", {
        get: function() {
            if (!this.isKinematic()) {
                if (this.body) {
                    var vel = this.body.getLinearVelocity();
                    this._linearVelocity.set(vel.x(), vel.y(), vel.z());
                    return this._linearVelocity;
                }
            } else {
                return this._linearVelocity;
            }
        },
        set: function(lv) {
            this.activate();
            if (!this.isKinematic()) {
                var body = this.body;
                if (body) {
                    ammoVec1.setValue(lv.x, lv.y, lv.z);
                    body.setLinearVelocity(ammoVec1);
                }                
            } else {
                this._linearVelocity.copy(lv);
            }
        },
    });

    Object.defineProperty(RigidBodyComponent.prototype, "angularVelocity", {
        get: function() {
            if (!this.isKinematic()) {
                if (this.body) {
                    var vel = this.body.getAngularVelocity();
                    this._angularVelocity.set(vel.x(), vel.y(), vel.z());
                    return this._angularVelocity;
                }
            } else {
                return this._angularVelocity;
            }
        },
        set: function(av) {
            this.activate();
            if (!this.isKinematic()) {
                var body = this.body;
                if (body) {
                    ammoVec1.setValue(av.x, av.y, av.z);
                    body.setAngularVelocity(ammoVec1);
                }
            } else {
                this._angularVelocity.copy(av);
            }
        },
    });

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

            if (entity.collision) {
                shape = entity.collision.shape;
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
                ammoQuat.setValue(rot.x, rot.y, rot.z, rot.w);

                var startTransform = new Ammo.btTransform();
                startTransform.setIdentity();
                startTransform.getOrigin().setValue(pos.x, pos.y, pos.z);
                startTransform.setRotation(ammoQuat);

                var motionState = new Ammo.btDefaultMotionState(startTransform);
                var bodyInfo = new Ammo.btRigidBodyConstructionInfo(mass, motionState, shape, localInertia);

                var body = new Ammo.btRigidBody(bodyInfo);

                body.setRestitution(this.restitution);
                body.setFriction(this.friction);
                body.setDamping(this.linearDamping, this.angularDamping);

                var v;
                v = this.linearFactor;
                ammoVec1.setValue(v.x, v.y, v.z);
                body.setLinearFactor(ammoVec1);
                v = this.angularFactor;
                ammoVec1.setValue(v.x, v.y, v.z);
                body.setAngularFactor(ammoVec1);

                body.entity = entity;

                if (this.isKinematic()) {
                    body.setCollisionFlags(body.getCollisionFlags() | pc.fw.RIGIDBODY_CF_KINEMATIC_OBJECT);
                    body.setActivationState(pc.fw.RIGIDBODY_DISABLE_DEACTIVATION);
                }

                entity.rigidbody.body = body;

                if (this.enabled) {
                    this.enableSimulation();
                } 
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

        enableSimulation: function () {
            if (this.entity.collision && this.entity.collision.enabled) {
                var body = this.body;
                if (body) {
                    this.system.addBody(body);

                    // set activation state so that the body goes back to normal simulation
                    if (this.isKinematic()) {
                        body.forceActivationState(pc.fw.RIGIDBODY_DISABLE_DEACTIVATION);
                    } else {
                        body.forceActivationState(pc.fw.RIGIDBODY_ACTIVE_TAG);
                    }

                    body.activate();
                }
            }
        },

        disableSimulation: function () {
            var body = this.body;
            if (body) {
                this.system.removeBody(body);
                // set activation state to disable simulation to avoid body.isActive() to return 
                // true even if it's not in the dynamics world
                body.forceActivationState(pc.fw.RIGIDBODY_DISABLE_SIMULATION);
            }
        },

        /**
         * @function
         * @name pc.fw.RigidBodyComponent#applyForce
         * @description Apply an force to the body at a point
         * @param {pc.Vec3} force The force to apply, in world space.
         * @param {pc.Vec3} [relativePoint] The point at which to apply the force, in local space (relative to the entity).
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
                    x = arguments[0].x;
                    y = arguments[0].y;
                    z = arguments[0].z;
                    break;
                case 2:
                    x = arguments[0].x;
                    y = arguments[0].y;
                    z = arguments[0].z;
                    px = arguments[1].x;
                    py = arguments[1].y;
                    pz = arguments[1].z;
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
                body.activate();
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
         * @name pc.fw.RigidBodyComponent#applyTorque
         * @description Apply torque (rotational force) to the body.
         * @param {pc.Vec3} force The torque to apply, in world space.
         */
        /**
         * @function
         * @name pc.fw.RigidBodyComponent#applyTorque^2
         * @description Apply torque (rotational force) to the body.
         * @param {Number} x The x component of the torque to apply, in world space.
         * @param {Number} y The y component of the torque to apply, in world space.
         * @param {Number} z The z component of the torque to apply, in world space.
         */
        applyTorque: function () {
            var x, y, z;
            switch (arguments.length) {
                case 1:
                    x = arguments[0].x;
                    y = arguments[0].y;
                    z = arguments[0].z;
                    break;
                case 3:
                    x = arguments[0];
                    y = arguments[1];
                    z = arguments[2];
                    break;
                default:
                    console.error('ERROR: applyTorque: function takes 1 or 3 arguments');
                    return;
            }
            var body = this.body;
            if (body) {
                body.activate();
                ammoVec1.setValue(x, y, z);
                body.applyTorque(ammoVec1);
            }
        },

        /**
         * @function
         * @name pc.fw.RigidBodyComponent#applyImpulse
         * @description Apply an impulse (instantaneous change of velocity) to the body at a point.
         * @param {pc.Vec3} impulse The impulse to apply, in world space.
         * @param {pc.Vec3} [relativePoint] The point at which to apply the impulse, in local space (relative to the entity).
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
                    x = arguments[0].x;
                    y = arguments[0].y;
                    z = arguments[0].z;
                    break;
                case 2:
                    x = arguments[0].x;
                    y = arguments[0].y;
                    z = arguments[0].z;
                    px = arguments[1].x;
                    py = arguments[1].y;
                    pz = arguments[1].z;
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
                body.activate();
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
         * @name pc.fw.RigidBodyComponent#applyTorqueImpulse
         * @description Apply a torque impulse (rotational force applied instantaneously) to the body.
         * @param {pc.Vec3} torqueImpulse The torque impulse to apply, in world space.
         */
        /**
         * @function
         * @name pc.fw.RigidBodyComponent#applyTorqueImpulse^2
         * @description Apply a torque impulse (rotational force applied instantaneously) to the body.
         * @param {Number} x The x component of the torque impulse to apply, in world space.
         * @param {Number} y The y component of the torque impulse to apply, in world space.
         * @param {Number} z The z component of the torque impulse to apply, in world space.
        */
        applyTorqueImpulse: function () {
            var x, y, z;
            switch (arguments.length) {
                case 1:
                    x = arguments[0].x;
                    y = arguments[0].y;
                    z = arguments[0].z;
                    break;
                case 3:
                    x = arguments[0];
                    y = arguments[1];
                    z = arguments[2];
                    break;
                default:
                    console.error('ERROR: applyTorqueImpulse: function takes 1 or 3 arguments');
                    return;
            }
            var body = this.body;
            if (body) {
                body.activate();
                ammoVec1.setValue(x, y, z);
                body.applyTorqueImpulse(ammoVec1);                    
            }
        },

        /**
         * @function
         * @name pc.fw.RigidBodyComponent#isStatic
         * @description Returns true if the rigid body is of type {@link pc.fw.RIGIDBODY_TYPE_STATIC}
         * @returns {Boolean} True if static
         */
        isStatic: function () {
            return (this.type === pc.fw.RIGIDBODY_TYPE_STATIC);
        },

        /**
         * @function
         * @name pc.fw.RigidBodyComponent#isStaticOrKinematic
         * @description Returns true if the rigid body is of type {@link pc.fw.RIGIDBODY_TYPE_STATIC} or {@link pc.fw.RIGIDBODY_TYPE_KINEMATIC}
         * @returns {Boolean} True if static or kinematic
         */
        isStaticOrKinematic: function () {
            return (this.type === pc.fw.RIGIDBODY_TYPE_STATIC || this.type === pc.fw.RIGIDBODY_TYPE_KINEMATIC);
        },

        /**
         * @function
         * @name pc.fw.RigidBodyComponent#isKinematic
         * @description Returns true if the rigid body is of type {@link pc.fw.RIGIDBODY_TYPE_KINEMATIC}
         * @returns {Boolean} True if kinematic
         */
        isKinematic: function () {
            return (this.type === pc.fw.RIGIDBODY_TYPE_KINEMATIC);
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
                var pos = this.entity.getPosition();
                var rot = this.entity.getRotation();

                var transform = body.getWorldTransform();
                transform.getOrigin().setValue(pos.x, pos.y, pos.z);

                ammoQuat.setValue(rot.x, rot.y, rot.z, rot.w);
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
                this.entity.setRotation(q.x(), q.y(), q.z(), q.w());
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
            this._displacement.copy(this._linearVelocity).scale(dt);
            this.entity.translate(this._displacement);

            this._displacement.copy(this._angularVelocity).scale(dt);
            this.entity.rotate(this._displacement.x, this._displacement.y, this._displacement.z);
            if (this.body.getMotionState()) {
                var pos = this.entity.getPosition();
                var rot = this.entity.getRotation();

                ammoTransform.getOrigin().setValue(pos.x, pos.y, pos.z);
                ammoQuat.setValue(rot.x, rot.y, rot.z, rot.w);
                ammoTransform.setRotation(ammoQuat);
                this.body.getMotionState().setWorldTransform(ammoTransform);
            }
        },

        onSetEnabled: function (name, oldValue, newValue) {
            if (oldValue !== newValue) {
                if (newValue) {
                    this.enableSimulation();
                } else {
                    this.disableSimulation();
                }
            }
        },

        onSetMass: function (name, oldValue, newValue) {
            var body = this.data.body;
            if (body) {
                if (this.enabled) {
                    this.disableSimulation();
                }

                var mass = newValue;
                var localInertia = new Ammo.btVector3(0, 0, 0);
                body.getCollisionShape().calculateLocalInertia(mass, localInertia);
                body.setMassProps(mass, localInertia);
                body.updateInertiaTensor();

                if (this.enabled) {
                    this.enableSimulation();
                }
            }
        },

        onSetLinearDamping: function (name, oldValue, newValue) {
            var body = this.data.body;
            if (body) {
                body.setDamping(newValue, this.data.angularDamping);
            }                
        },

        onSetAngularDamping: function (name, oldValue, newValue) {
            var body = this.data.body;
            if (body) {
                body.setDamping(this.data.linearDamping, newValue);
            }                
        },

        onSetLinearFactor: function (name, oldValue, newValue) {
            var body = this.data.body;
            if (body) {
                ammoVec1.setValue(newValue.x, newValue.y, newValue.z);
                body.setLinearFactor(ammoVec1);
            }                
        },

        onSetAngularFactor: function (name, oldValue, newValue) {
            var body = this.data.body;
            if (body) {
                ammoVec1.setValue(newValue.x, newValue.y, newValue.z);
                body.setAngularFactor(ammoVec1);
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

        onSetType: function (name, oldValue, newValue) {
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
            this.linearVelocity = pc.Vec3.ZERO;
            this.angularVelocity = pc.Vec3.ZERO;
        },

        onBeforeRemove: function(entity, component) {
            if (this === component) {
                entity.off('livelink:updatetransform', this.onLiveLinkUpdateTransform, this);
                this.system.off('beforeremove', this.onBeforeRemove, this);
            }
        }

    });

    return {
        RigidBodyComponent: RigidBodyComponent
    };
}());