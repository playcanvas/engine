pc.extend(pc.fw, function () {
    // Shared math variable to avoid excessive allocation
    var quat = pc.math.quat.create();
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
     * @property {pc.math.vec3} linearVelocity Defines the speed of the body in a given direction.
     * @property {pc.math.vec3} angularVelocity Defines the rotational speed of the body around each world axis.
     * @property {Number} linearDamping Controls the rate at which a body loses linear velocity over time.
     * @property {Number} angularDamping Controls the rate at which a body loses angular velocity over time.
     * @property {pc.math.vec3} linearFactor Scaling factor for linear movement of the body in each axis.
     * @property {pc.math.vec3} angularFactor Scaling factor for angular movement of the body in each axis.
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
        this._displacement = pc.math.vec3.create(0, 0, 0);
        this._linearVelocity = pc.math.vec3.create(0, 0, 0);
        this._angularVelocity = pc.math.vec3.create(0, 0, 0);
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
                    pc.math.vec3.set(this._linearVelocity, vel.x(), vel.y(), vel.z());
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
                    ammoVec1.setValue(lv[0], lv[1], lv[2]);
                    body.setLinearVelocity(ammoVec1);
                }                
            } else {
                pc.math.vec3.copy(lv, this._linearVelocity);
            }
        },
    });

    Object.defineProperty(RigidBodyComponent.prototype, "angularVelocity", {
        get: function() {
            if (!this.isKinematic()) {
                if (this.body) {
                    var vel = this.body.getAngularVelocity();
                    pc.math.vec3.set(this._angularVelocity, vel.x(), vel.y(), vel.z());
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
                    ammoVec1.setValue(av[0], av[1], av[2]);
                    body.setAngularVelocity(ammoVec1);
                }
            } else {
                pc.math.vec3.copy(av, this._angularVelocity);
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
                body.setDamping(this.linearDamping, this.angularDamping);

                var v;
                v = this.linearFactor;
                ammoVec1.setValue(v[0], v[1], v[2]);
                body.setLinearFactor(ammoVec1);
                v = this.angularFactor;
                ammoVec1.setValue(v[0], v[1], v[2]);
                body.setAngularFactor(ammoVec1);

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
         * @param {pc.math.vec3} force The torque to apply, in world space.
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
                    x = arguments[0][0];
                    y = arguments[0][1];
                    z = arguments[0][2];
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
         * @param {pc.math.vec3} torqueImpulse The torque impulse to apply, in world space.
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
                    x = arguments[0][0];
                    y = arguments[0][1];
                    z = arguments[0][2];
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
         * @private
         * @function
         * @name pc.fw.RigidBodyComponent#getLinearVelocity
         * @description Return the current linear velocity of the rigid body
         * @returns {pc.math.vec3} The linear velocity
         */
        getLinearVelocity: function () {
            console.warn("WARNING: getLinearVelocity: Function is deprecated. Query linearVelocity property instead.");
            return this.linearVelocity;
        },

        /**
         * @private
         * @function
         * @name pc.fw.RigidBodyComponent#getAngularVelocity
         * @description Return the current angular velocity of the rigid body
         * @returns {pc.math.vec3} The angular velocity
         */
        getAngularVelocity: function () {
            console.warn("WARNING: getAngularVelocity: Function is deprecated. Query angularVelocity property instead.");
            return this.angularVelocity;
        },

        /**
         * @private
         * @function
         * @name pc.fw.RigidBodyComponent#setLinearVelocity
         * @description Set the linear velocity of the body.
         * @param {Number} x The x value of the velocity
         * @param {Number} y The y value of the velocity
         * @param {Number} z The z value of the velocity
         */
        setLinearVelocity: function (x, y, z) {
            console.warn("WARNING: setLinearVelocity: Function is deprecated. Set linearVelocity property instead.");
            this.linearVelocity = pc.math.vec3.create(x, y, z);
        },

        /**
         * @private
         * @function
         * @name pc.fw.RigidBodyComponent#setAngularVelocity
         * @description Set the angular velocity of the body
         * @param {Number} x The x value of the angular velocity
         * @param {Number} y The y value of the angular velocity
         * @param {Number} z The z value of the angular velocity
         */
        setAngularVelocity: function (x, y, z) {
            console.warn("WARNING: setAngularVelocity: Function is deprecated. Set angularVelocity property instead.");
            this.angularVelocity = pc.math.vec3.create(x, y, z);
        },

        /**
         * @private
         * @function
         * @name pc.fw.RigidBodyComponent#setLinearFactor
         * @description Apply a scaling factor to linear motion in each axis. 
         * Use this to limit motion in one or more axes
         * @param {Number} x The factor to scale x-axis motion by. 0 means no linear motion, 1 means linear motion is unchanged.
         * @param {Number} y The factor to scale y-axis motion by. 0 means no linear motion, 1 means linear motion is unchanged.
         * @param {Number} z The factor to scale z-axis motion by. 0 means no linear motion, 1 means linear motion is unchanged.
         * @example
         * // Restrict motion to the vertical y-axis
         * entity.rigidbody.setLinearFactor(0, 1, 0);
         */
        setLinearFactor: function (x, y, z) {
            console.warn("WARNING: setLinearFactor: Function is deprecated. Set linearFactor property instead.");
            this.linearFactor = pc.math.vec3.create(x, y, z);
        },

        /**
         * @private
         * @function
         * @name pc.fw.RigidBodyComponent#setAngularFactor
         * @description Apply a scaling factor to angular motion.
         * @param {Number} x The factor to scale x-axis angular motion by. 0 means no angular motion, 1 means angular motion is unchanged.
         * @param {Number} y The factor to scale y-axis angular motion by. 0 means no angular motion, 1 means angular motion is unchanged.
         * @param {Number} z The factor to scale z-axis angular motion by. 0 means no angular motion, 1 means angular motion is unchanged.
         * @example
         * // Prevent an body from rotating
         * entity.rigidbody.setAngularFactor(0);
         */
        setAngularFactor: function () {
            console.warn("WARNING: setAngularFactor: Function is deprecated. Set linearFactor property instead.");
            switch (arguments.length) {
                case 1:
                    this.angularFactor = pc.math.vec3.create(arguments[0], arguments[0], arguments[0]);
                    break;
                case 3:
                    this.angularFactor = pc.math.vec3.create(arguments[0], arguments[1], arguments[2]);
                    break;
                default:
                    console.error('ERROR: setAngularFactor: function takes 1 or 3 arguments');
                    return;
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
            pc.math.vec3.scale(this._linearVelocity, dt, this._displacement);
            this.entity.translate(this._displacement);

            pc.math.vec3.scale(this._angularVelocity, dt, this._displacement);
            this.entity.rotate(this._displacement[0], this._displacement[1], this._displacement[2]);
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
                ammoVec1.setValue(newValue[0], newValue[1], newValue[2]);
                body.setLinearFactor(ammoVec1);
            }                
        },

        onSetAngularFactor: function (name, oldValue, newValue) {
            var body = this.data.body;
            if (body) {
                ammoVec1.setValue(newValue[0], newValue[1], newValue[2]);
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
            this.linearVelocity = pc.math.vec3.zero;
            this.angularVelocity = pc.math.vec3.zero;
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