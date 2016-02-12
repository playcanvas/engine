pc.extend(pc, function () {
    // Shared math variable to avoid excessive allocation
    var ammoTransform;
    var ammoVec1, ammoVec2, ammoQuat, ammoOrigin;

    /**
     * @component
     * @name pc.RigidBodyComponent
     * @description Create a new RigidBodyComponent
     * @class The rigidbody Component, when combined with a {@link pc.CollisionComponent}, allows your Entities to be simulated using realistic physics.
     * A rigidbody Component will fall under gravity and collide with other rigid bodies, using scripts you can apply forces to the body.
     * @param {pc.RigidBodyComponentSystem} system The ComponentSystem that created this Component
     * @param {pc.Entity} entity The Entity this Component is attached to
     * @extends pc.Component
     * @property {Number} mass The mass of the body. This is only relevant for {@link pc.BODYTYPE_DYNAMIC} bodies, other types have infinite mass.
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
     * @property {Number} group The collision group this body belongs to. Combine the group and the mask to prevent bodies colliding with each other.
     * @property {Number} mask The collision mask sets which groups this body collides with. It is a bitfield of 16 bits, the first 8 bits are reserved for engine use.
     * @property {String} type The rigid body type determines how the body is simulated. Can be:
     * <ul>
     *     <li>pc.BODYTYPE_STATIC: infinite mass and cannot move.</li>
     *     <li>pc.BODYTYPE_DYNAMIC: simulated according to applied forces.</li>
     *     <li>pc.BODYTYPE_KINEMATIC: infinite mass and does not respond to forces but can still be moved by setting their velocity or position.</li>
     * </ul>
     */
    var RigidBodyComponent = function RigidBodyComponent (system, entity) {
        // Lazily create shared variable
        if (typeof Ammo !== 'undefined' && !ammoTransform) {
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
        this.on('set_group', this.onSetGroupOrMask, this);
        this.on('set_mask', this.onSetGroupOrMask, this);

        this.on('set_body', this.onSetBody, this);

        // For kinematic
        this._displacement = new pc.Vec3(0, 0, 0);
        this._linearVelocity = new pc.Vec3(0, 0, 0);
        this._angularVelocity = new pc.Vec3(0, 0, 0);
    };
    RigidBodyComponent = pc.inherits(RigidBodyComponent, pc.Component);

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
        * @name pc.RigidBodyComponent#createBody
        * @description If the Entity has a Collision shape attached then create a rigid body using this shape. This method destroys the existing body.
        */
        createBody: function () {
            var entity = this.entity;
            var shape;

            if (entity.collision) {
                shape = entity.collision.shape;

                // if a trigger was already created from the collision system
                // destroy it
                if (entity.trigger) {
                    entity.trigger.destroy();
                    delete entity.trigger;
                }
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
                    body.setCollisionFlags(body.getCollisionFlags() | pc.BODYFLAG_KINEMATIC_OBJECT);
                    body.setActivationState(pc.BODYSTATE_DISABLE_DEACTIVATION);
                }

                entity.rigidbody.body = body;

                if (this.enabled && this.entity.enabled) {
                    this.enableSimulation();
                }
            }
        },

        /**
        * @function
        * @name pc.RigidBodyComponent#isActive
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
        * @name pc.RigidBodyComponent#activate
        * @description Forceably activate the rigid body simulation
        */
        activate: function () {
            if (this.body) {
                this.body.activate();
            }
        },

        enableSimulation: function () {
            if (this.entity.collision && this.entity.collision.enabled && !this.data.simulationEnabled) {
                var body = this.body;
                if (body) {
                    this.system.addBody(body, this.group, this.mask);

                    // set activation state so that the body goes back to normal simulation
                    if (this.isKinematic()) {
                        body.forceActivationState(pc.BODYSTATE_DISABLE_DEACTIVATION);
                        body.activate();
                    } else {
                        body.forceActivationState(pc.BODYFLAG_ACTIVE_TAG);
                        this.syncEntityToBody();
                    }

                    this.data.simulationEnabled = true;
                }
            }
        },

        disableSimulation: function () {
            var body = this.body;
            if (body && this.data.simulationEnabled) {
                this.system.removeBody(body);
                // set activation state to disable simulation to avoid body.isActive() to return
                // true even if it's not in the dynamics world
                body.forceActivationState(pc.BODYSTATE_DISABLE_SIMULATION);

                this.data.simulationEnabled = false;
            }
        },

        /**
         * @function
         * @name pc.RigidBodyComponent#applyForce
         * @description Apply an force to the body at a point. By default, the force is applied at the origin of the
         * body. However, the force can be applied at an offset this point by specifying a world space vector from
         * the body's origin to the point of application.
         * @param {Number} x The x component of the force to apply, in world space.
         * @param {Number} y The y component of the force to apply, in world space.
         * @param {Number} z The z component of the force to apply, in world space.
         * @param {Number} [px] The x component of a world space offset from the body's position where the force is applied.
         * @param {Number} [py] The y component of a world space offset from the body's position where the force is applied.
         * @param {Number} [pz] The z component of a world space offset from the body's position where the force is applied.
         * @example
         * // EXAMPLE 1: Apply an approximation of gravity at the body's center
         * this.entity.rigidbody.applyForce(0, -10, 0);
         *
         * // EXAMPLE 2: Apply an approximation of gravity at 1 unit down the world Z from the center of the body
         * this.entity.rigidbody.applyForce(0, -10, 0, 0, 0, 1);
         */
        /**
         * @function
         * @name pc.RigidBodyComponent#applyForce^2
         * @description Apply an force to the body at a point. By default, the force is applied at the origin of the
         * body. However, the force can be applied at an offset this point by specifying a world space vector from
         * the body's origin to the point of application.
         * @param {pc.Vec3} force The force to apply, in world space.
         * @param {pc.Vec3} [relativePoint] A world space offset from the body's position where the force is applied.
         * @example
         * // EXAMPLE 1: Apply a force at the body's center
         * // Calculate a force vector pointing in the world space direction of the entity
         * var force = this.entity.forward.clone().scale(100);
         *
         * // Apply the force
         * this.entity.rigidbody.applyForce(force);
         *
         * // EXAMPLE 2: Apply a force at some relative offset from the body's center
         * // Calculate a force vector pointing in the world space direction of the entity
         * var force = this.entity.forward.clone().scale(100);
         *
         * // Calculate the world space relative offset
         * var relativePos = new pc.Vec3();
         * var childEntity = this.entity.findByName('Engine');
         * relativePos.sub2(childEntity.getPosition(), this.entity.getPosition());
         *
         * // Apply the force
         * this.entity.rigidbody.applyForce(force, relativePos);
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
                    px = arguments[3];
                    py = arguments[4];
                    pz = arguments[5];
                    break;
            }
            var body = this.body;
            if (body) {
                body.activate();
                ammoVec1.setValue(x, y, z);
                if (px !== undefined) {
                    ammoVec2.setValue(px, py, pz);
                    body.applyForce(ammoVec1, ammoVec2);
                } else {
                    body.applyForce(ammoVec1, ammoOrigin);
                }

            }
        },

        /**
         * @function
         * @name pc.RigidBodyComponent#applyTorque
         * @description Apply torque (rotational force) to the body.
         * @param {Number} x The x component of the torque to apply, in world space.
         * @param {Number} y The y component of the torque to apply, in world space.
         * @param {Number} z The z component of the torque to apply, in world space.
         */
        /**
         * @function
         * @name pc.RigidBodyComponent#applyTorque^2
         * @description Apply torque (rotational force) to the body.
         * @param {pc.Vec3} force The torque to apply, in world space.
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
         * @name pc.RigidBodyComponent#applyImpulse
         * @description Apply an impulse (instantaneous change of velocity) to the body at a point.
         * @param {Number} x The x component of the impulse to apply, in world space.
         * @param {Number} y The y component of the impulse to apply, in world space.
         * @param {Number} z The z component of the impulse to apply, in world space.
         * @param {Number} [px] The x component of the point at which to apply the impulse, in local space (relative to the Entity).
         * @param {Number} [py] The y component of the point at which to apply the impulse, in local space (relative to the Entity).
         * @param {Number} [pz] The z component of the point at which to apply the impulse, in local space (relative to the Entity).
        */
        /**
         * @function
         * @name pc.RigidBodyComponent#applyImpulse^2
         * @description Apply an impulse (instantaneous change of velocity) to the body at a point.
         * @param {pc.Vec3} impulse The impulse to apply, in world space.
         * @param {pc.Vec3} [relativePoint] The point at which to apply the impulse, in local space (relative to the entity).
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
                if (px !== undefined) {
                    ammoVec2.setValue(px, py, pz);
                    body.applyImpulse(ammoVec1, ammoVec2);
                } else {
                    body.applyImpulse(ammoVec1, ammoOrigin);
                }
            }
        },

        /**
         * @function
         * @name pc.RigidBodyComponent#applyTorqueImpulse
         * @description Apply a torque impulse (rotational force applied instantaneously) to the body.
         * @param {Number} x The x component of the torque impulse to apply, in world space.
         * @param {Number} y The y component of the torque impulse to apply, in world space.
         * @param {Number} z The z component of the torque impulse to apply, in world space.
        */
        /**
         * @function
         * @name pc.RigidBodyComponent#applyTorqueImpulse^2
         * @description Apply a torque impulse (rotational force applied instantaneously) to the body.
         * @param {pc.Vec3} torqueImpulse The torque impulse to apply, in world space.
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
         * @name pc.RigidBodyComponent#isStatic
         * @description Returns true if the rigid body is of type {@link pc.BODYTYPE_STATIC}
         * @returns {Boolean} True if static
         */
        isStatic: function () {
            return (this.type === pc.BODYTYPE_STATIC);
        },

        /**
         * @function
         * @name pc.RigidBodyComponent#isStaticOrKinematic
         * @description Returns true if the rigid body is of type {@link pc.BODYTYPE_STATIC} or {@link pc.BODYTYPE_KINEMATIC}
         * @returns {Boolean} True if static or kinematic
         */
        isStaticOrKinematic: function () {
            return (this.type === pc.BODYTYPE_STATIC || this.type === pc.BODYTYPE_KINEMATIC);
        },

        /**
         * @function
         * @name pc.RigidBodyComponent#isKinematic
         * @description Returns true if the rigid body is of type {@link pc.BODYTYPE_KINEMATIC}
         * @returns {Boolean} True if kinematic
         */
        isKinematic: function () {
            return (this.type === pc.BODYTYPE_KINEMATIC);
        },


        /**
         * @private
         * @function
         * @name pc.RigidBodyComponent#syncEntityToBody
         * @description Set the rigid body transform to to be the same as the Entity transform.
         * This must be called after any Entity transformation functions (e.g. {@link pc.Entity#setPosition}) are called
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

                // update the motion state for kinematic bodies
                if (this.isKinematic()) {
                    var motionState = this.body.getMotionState();
                    if (motionState) {
                        motionState.setWorldTransform(transform);
                    }
                }

                body.activate();
            }
        },

        /**
         * @private
         * @function
         * @name pc.RigidBodyComponent#syncBodyToEntity
         * @description Update the Entity transform from the rigid body.
         * This is called internally after the simulation is stepped, to keep the Entity transform in sync with the rigid body transform.
         */
        syncBodyToEntity: function () {
            var body = this.body;
            if (body.isActive()) {
                var motionState = body.getMotionState();
                if (motionState) {
                    motionState.getWorldTransform(ammoTransform);

                    var p = ammoTransform.getOrigin();
                    var q = ammoTransform.getRotation();
                    this.entity.setPosition(p.x(), p.y(), p.z());
                    this.entity.setRotation(q.x(), q.y(), q.z(), q.w());
                }
            }
        },

        /**
        * @function
        * @name pc.RigidBodyComponent#teleport
        * @description Teleport an entity to a new position and/or orientation
        * @param {pc.Vec3} position The new position
        * @param {pc.Vec3} [angles] THe new set of Euler angles
        */
        /**
        * @function
        * @name pc.RigidBodyComponent#teleport^2
        * @description Teleport an entity to a new position and/or orientation
        * @param {pc.Vec3} position The new position
        * @param {pc.Quat} [rotation] The new rotation
        */
        /**
        * @function
        * @name pc.RigidBodyComponent#teleport^3
        * @description Teleport an entity to a new position and/or orientation
        * @param {Number} x The new position x value
        * @param {Number} y The new position y value
        * @param {Number} z The new position z value
        * @param {Number} [x] The new x angle value
        * @param {Number} [y] The new y angle value
        * @param {Number} [z] The new z angle value
        */
        teleport: function () {
            if (arguments.length < 3) {
                if (arguments[0]) {
                    this.entity.setPosition(arguments[0]);
                }
                if (arguments[1]) {
                    if (arguments[1] instanceof pc.Quat) {
                        this.entity.setRotation(arguments[1]);
                    } else {
                        this.entity.setEulerAngles(arguments[1]);
                    }

                }
            } else {
                if (arguments.length === 6) {
                    this.entity.setEulerAngles(arguments[3], arguments[4], arguments[5]);
                }
                this.entity.setPosition(arguments[0], arguments[1], arguments[2]);
            }
            this.syncEntityToBody();
        },

        /**
         * @private
         * @function
         * @name pc.RigidBodyComponent#_updateKinematic
         * @description Kinematic objects maintain their own linear and angular velocities. This method updates their transform
         * based on their current velocity. It is called in every frame in the main physics update loop, after the simulation is stepped.
         */
        _updateKinematic: function (dt) {
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



        onEnable: function () {
            RigidBodyComponent._super.onEnable.call(this);
            if (!this.body) {
                this.createBody();
            }

            this.enableSimulation();
        },

        onDisable: function () {
            RigidBodyComponent._super.onDisable.call(this);
            this.disableSimulation();
        },

        onSetMass: function (name, oldValue, newValue) {
            var body = this.data.body;
            if (body) {
                var isEnabled = this.enabled && this.entity.enabled;
                if (isEnabled) {
                    this.disableSimulation();
                }

                var mass = newValue;
                var localInertia = new Ammo.btVector3(0, 0, 0);
                body.getCollisionShape().calculateLocalInertia(mass, localInertia);
                body.setMassProps(mass, localInertia);
                body.updateInertiaTensor();

                if (isEnabled) {
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
                this.disableSimulation();

                // set group and mask to defaults for type
                if (newValue === pc.BODYTYPE_DYNAMIC) {
                    this.data.group = pc.BODYGROUP_DYNAMIC;
                    this.data.mask = pc.BODYMASK_ALL;
                } else if (newValue === pc.BODYTYPE_KINEMATIC) {
                    this.data.group = pc.BODYGROUP_KINEMATIC;
                    this.data.mask = pc.BODYMASK_ALL;
                } else {
                    this.data.group = pc.BODYGROUP_STATIC;
                    this.data.mask = pc.BODYMASK_NOT_STATIC;
                }

                // Create a new body
                this.createBody();
            }
        },

        onSetGroupOrMask: function (name, oldValue, newValue) {
            if (newValue !== oldValue) {
                // re-enabling simulation adds rigidbody back into world with new masks
                var isEnabled = this.enabled && this.entity.enabled;
                if (isEnabled) {
                    this.disableSimulation();
                    this.enableSimulation();
                }
            }
        },

        onSetBody: function (name, oldValue, newValue) {
            if (this.body && this.data.simulationEnabled) {
                this.body.activate();
            }
        }

    });

    return {
        RigidBodyComponent: RigidBodyComponent
    };
}());
