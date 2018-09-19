Object.assign(pc, function () {
    // Shared math variable to avoid excessive allocation
    var ammoTransform;
    var ammoVec1, ammoVec2, ammoQuat, ammoOrigin;

    /**
     * @component
     * @constructor
     * @name pc.RigidBodyComponent
     * @classdesc The rigidbody component, when combined with a {@link pc.CollisionComponent}, allows your
     * entities to be simulated using realistic physics.
     * A rigidbody component will fall under gravity and collide with other rigid bodies. Using scripts, you
     * can apply forces and impulses to rigid bodies.
     * @description Create a new RigidBodyComponent
     * @param {pc.RigidBodyComponentSystem} system The ComponentSystem that created this component
     * @param {pc.Entity} entity The entity this component is attached to
     * @extends pc.Component
     * @property {Number} mass The mass of the body. This is only relevant for {@link pc.BODYTYPE_DYNAMIC}
     * bodies, other types have infinite mass. Defaults to 1.
     * @property {pc.Vec3} linearVelocity Defines the speed of the body in a given direction.
     * @property {pc.Vec3} angularVelocity Defines the rotational speed of the body around each world axis.
     * @property {Number} linearDamping Controls the rate at which a body loses linear velocity over time.
     * Defaults to 0.
     * @property {Number} angularDamping Controls the rate at which a body loses angular velocity over time.
     * Defaults to 0.
     * @property {pc.Vec3} linearFactor Scaling factor for linear movement of the body in each axis.
     * Defaults to 1 in all axes.
     * @property {pc.Vec3} angularFactor Scaling factor for angular movement of the body in each axis.
     * Defaults to 1 in all axes.
     * @property {Number} friction The friction value used when contacts occur between two bodies. A higher
     * value indicates more friction. Should be set in the range 0 to 1. Defaults to 0.5.
     * @property {Number} restitution Influences the amount of energy lost when two rigid bodies collide. The
     * calculation multiplies the restitution values for both colliding bodies. A multiplied value of 0 means
     * that all energy is lost in the collision while a value of 1 means that no energy is lost. Should be
     * set in the range 0 to 1. Defaults to 0.
     * @property {Number} group The collision group this body belongs to. Combine the group and the mask to
     * prevent bodies colliding with each other. Defaults to 1.
     * @property {Number} mask The collision mask sets which groups this body collides with. It is a bitfield
     * of 16 bits, the first 8 bits are reserved for engine use. Defaults to 65535.
     * @property {String} type The rigid body type determines how the body is simulated. Can be:
     * <ul>
     *     <li>pc.BODYTYPE_STATIC: infinite mass and cannot move.</li>
     *     <li>pc.BODYTYPE_DYNAMIC: simulated according to applied forces.</li>
     *     <li>pc.BODYTYPE_KINEMATIC: infinite mass and does not respond to forces but can still be moved by setting their velocity or position.</li>
     * </ul>
     * Defaults to pc.BODYTYPE_STATIC.
     */
    var RigidBodyComponent = function RigidBodyComponent(system, entity) {
        pc.Component.call(this, system, entity);

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
    RigidBodyComponent.prototype = Object.create(pc.Component.prototype);
    RigidBodyComponent.prototype.constructor = RigidBodyComponent;

    Object.defineProperty(RigidBodyComponent.prototype, "bodyType", {
        get: function () {
            console.warn("WARNING: bodyType: Function is deprecated. Query type property instead.");
            return this.type;
        },
        set: function (type) {
            console.warn("WARNING: bodyType: Function is deprecated. Set type property instead.");
            this.type = type;
        }
    });

    Object.defineProperty(RigidBodyComponent.prototype, "linearVelocity", {
        get: function () {
            if (!this.isKinematic()) {
                if (this.body) {
                    var vel = this.body.getLinearVelocity();
                    this._linearVelocity.set(vel.x(), vel.y(), vel.z());
                }
            }
            return this._linearVelocity;
        },
        set: function (lv) {
            this.activate();
            if (!this.isKinematic()) {
                if (this.body) {
                    ammoVec1.setValue(lv.x, lv.y, lv.z);
                    this.body.setLinearVelocity(ammoVec1);
                }
            }
            this._linearVelocity.copy(lv);
        }
    });

    Object.defineProperty(RigidBodyComponent.prototype, "angularVelocity", {
        get: function () {
            if (!this.isKinematic()) {
                if (this.body) {
                    var vel = this.body.getAngularVelocity();
                    this._angularVelocity.set(vel.x(), vel.y(), vel.z());
                }
            }
            return this._angularVelocity;
        },
        set: function (av) {
            this.activate();
            if (!this.isKinematic()) {
                if (this.body) {
                    ammoVec1.setValue(av.x, av.y, av.z);
                    this.body.setAngularVelocity(ammoVec1);
                }
            }
            this._angularVelocity.copy(av);
        }
    });

    Object.assign(RigidBodyComponent.prototype, {
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
         * @description Forcibly activate the rigid body simulation
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
         * the body's origin to the point of application. This function has two valid signatures. You can either
         * specify the force (and optional relative point) via 3D-vector or numbers.
         * @param {pc.Vec3|Number} x - A 3-dimensional vector representing the force in world-space or
         * the x-component of the force in world-space.
         * @param {pc.Vec3|Number} [y] - An optional 3-dimensional vector representing the relative point at
         * which to apply the impulse in world-space or the y-component of the force in world-space.
         * @param {Number} [z] - The z-component of the force in world-space.
         * @param {Number} [px] - The x-component of a world-space offset from the body's position where the force is applied.
         * @param {Number} [py] - The y-component of a world-space offset from the body's position where the force is applied.
         * @param {Number} [pz] - The z-component of a world-space offset from the body's position where the force is applied.
         * @example
         * // Apply an approximation of gravity at the body's center
         * this.entity.rigidbody.applyForce(0, -10, 0);
         * @example
         * // Apply an approximation of gravity at 1 unit down the world Z from the center of the body
         * this.entity.rigidbody.applyForce(0, -10, 0, 0, 0, 1);
         * @example
         * // Apply a force at the body's center
         * // Calculate a force vector pointing in the world space direction of the entity
         * var force = this.entity.forward.clone().scale(100);
         *
         * // Apply the force
         * this.entity.rigidbody.applyForce(force);
         * @example
         * // Apply a force at some relative offset from the body's center
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
            var px, py, pz;
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
         * @description Apply torque (rotational force) to the body. This function has two valid signatures.
         * You can either specify the torque force with a 3D-vector or with 3 numbers.
         * @param {pc.Vec3|Number} x - A 3-dimensional vector representing the torque force in world-space or
         * the x-component of the torque force in world-space.
         * @param {Number} [y] - The y-component of the torque force in world-space.
         * @param {Number} [z] - The z-component of the torque force in world-space.
         * @example
         * // Apply via vector
         * var torque = new pc.Vec3(0, 10, 0);
         * entity.rigidbody.applyTorque(torque);
         * @example
         * // Apply via numbers
         * entity.rigidbody.applyTorque(0, 10, 0);
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
                    // #ifdef DEBUG
                    console.error('ERROR: applyTorque: function takes 1 or 3 arguments');
                    // #endif
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
         * This function has two valid signatures. You can either specify the impulse (and optional relative
         * point) via 3D-vector or numbers.
         * @param {pc.Vec3|Number} x - A 3-dimensional vector representing the impulse in world-space or
         * the x-component of the impulse in world-space.
         * @param {pc.Vec3|Number} [y] - An optional 3-dimensional vector representing the relative point at
         * which to apply the impulse in the local-space of the entity or the y-component of the impulse to
         * apply in world-space.
         * @param {Number} [z] - The z-component of the impulse to apply in world-space.
         * @param {Number} [px=0] - The x-component of the point at which to apply the impulse in the local-space of the entity.
         * @param {Number} [py=0] - The y-component of the point at which to apply the impulse in the local-space of the entity.
         * @param {Number} [pz=0] - The z-component of the point at which to apply the impulse in the local-space of the entity.
         * @example
         * // Apply an impulse along the world-space positive y-axis at the entity's position.
         * var impulse = new pc.Vec3(0, 10, 0);
         * entity.rigidbody.applyImpulse(impulse);
         * @example
         * // Apply an impulse along the world-space positive y-axis at 1 unit down the positive
         * // z-axis of the entity's local-space.
         * var impulse = new pc.Vec3(0, 10, 0);
         * var relativePoint = new pc.Vec3(0, 0, 1);
         * entity.rigidbody.applyImpulse(impulse, relativePoint);
         * @example
         * // Apply an impulse along the world-space positive y-axis at the entity's position.
         * entity.rigidbody.applyImpulse(0, 10, 0);
         * @example
         * // Apply an impulse along the world-space positive y-axis at 1 unit down the positive
         * // z-axis of the entity's local-space.
         * entity.rigidbody.applyImpulse(0, 10, 0, 0, 0, 1);
         */
        applyImpulse: function () {
            var x, y, z;
            var px, py, pz;
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
                default:
                    // #ifdef DEBUG
                    console.error('ERROR: applyImpulse: function takes 1, 2, 3 or 6 arguments');
                    // #endif
                    return;
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
         * This function has two valid signatures. You can either specify the torque force with a 3D-vector
         * or with 3 numbers.
         * @param {pc.Vec3|Number} x - A 3-dimensional vector representing the torque impulse in world-space or
         * the x-component of the torque impulse in world-space.
         * @param {Number} [y] - The y-component of the torque impulse in world-space.
         * @param {Number} [z] - The z-component of the torque impulse in world-space.
         * @example
         * // Apply via vector
         * var torque = new pc.Vec3(0, 10, 0);
         * entity.rigidbody.applyTorqueImpulse(torque);
         * @example
         * // Apply via numbers
         * entity.rigidbody.applyTorqueImpulse(0, 10, 0);
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
                    // #ifdef DEBUG
                    console.error('ERROR: applyTorqueImpulse: function takes 1 or 3 arguments');
                    // #endif
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
         * @description Set the rigid body transform to be the same as the Entity transform.
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
         * @description Teleport an entity to a new world-space position, optionally setting orientation. This function
         * should only be called for rigid bodies that are dynamic. This function has three valid signatures.
         * The first takes a 3-dimensional vector for the position and an optional 3-dimensional vector for Euler rotation.
         * The second takes a 3-dimensional vector for the position and an optional quaternion for rotation.
         * The third takes 3 numbers for the position and an optional 3 numbers for Euler rotation.
         * @param {pc.Vec3|Number} x - A 3-dimensional vector holding the new position or the new position x-coordinate.
         * @param {pc.Vec3|pc.Quat|Number} y - A 3-dimensional vector or quaternion holding the new rotation or the new
         * position y-coordinate.
         * @param {Number} [z] - The new position z-coordinate.
         * @param {Number} [rx] - The new Euler x-angle value.
         * @param {Number} [ry] - The new Euler y-angle value.
         * @param {Number} [rz] - The new Euler z-angle value.
         * @example
         * // Teleport the entity to the origin
         * entity.rigidbody.teleport(pc.Vec3.ZERO);
         * @example
         * // Teleport the entity to the origin
         * entity.rigidbody.teleport(0, 0, 0);
         * @example
         * // Teleport the entity to world-space coordinate [1, 2, 3] and reset orientation
         * var position = new pc.Vec3(1, 2, 3);
         * entity.rigidbody.teleport(position, pc.Vec3.ZERO);
         * @example
         * // Teleport the entity to world-space coordinate [1, 2, 3] and reset orientation
         * entity.rigidbody.teleport(1, 2, 3, 0, 0, 0);
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
         * @param {Number} dt Delta time for the current frame.
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
            if (!this.body) {
                this.createBody();
            }

            this.enableSimulation();
        },

        onDisable: function () {
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
