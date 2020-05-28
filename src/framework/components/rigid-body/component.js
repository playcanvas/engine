Object.assign(pc, function () {
    // Shared math variable to avoid excessive allocation
    var ammoTransform;
    var ammoVec1, ammoVec2, ammoQuat, ammoOrigin;

    /**
     * @component
     * @class
     * @name pc.RigidBodyComponent
     * @augments pc.Component
     * @classdesc The rigidbody component, when combined with a {@link pc.CollisionComponent}, allows your
     * entities to be simulated using realistic physics.
     * A rigidbody component will fall under gravity and collide with other rigid bodies. Using scripts, you
     * can apply forces and impulses to rigid bodies.
     * @description Create a new RigidBodyComponent.
     * @param {pc.RigidBodyComponentSystem} system - The ComponentSystem that created this component.
     * @param {pc.Entity} entity - The entity this component is attached to.
     * @property {number} mass The mass of the body. This is only relevant for {@link pc.BODYTYPE_DYNAMIC}
     * bodies, other types have infinite mass. Defaults to 1.
     * @property {pc.Vec3} linearVelocity Defines the speed of the body in a given direction.
     * @property {pc.Vec3} angularVelocity Defines the rotational speed of the body around each world axis.
     * @property {number} linearDamping Controls the rate at which a body loses linear velocity over time.
     * Defaults to 0.
     * @property {number} angularDamping Controls the rate at which a body loses angular velocity over time.
     * Defaults to 0.
     * @property {pc.Vec3} linearFactor Scaling factor for linear movement of the body in each axis. Only
     * valid for rigid bodies of type pc.BODYTYPE_DYNAMIC. Defaults to 1 in all axes.
     * @property {pc.Vec3} angularFactor Scaling factor for angular movement of the body in each axis. Only
     * valid for rigid bodies of type pc.BODYTYPE_DYNAMIC. Defaults to 1 in all axes.
     * @property {number} friction The friction value used when contacts occur between two bodies. A higher
     * value indicates more friction. Should be set in the range 0 to 1. Defaults to 0.5.
     * @property {number} restitution Influences the amount of energy lost when two rigid bodies collide. The
     * calculation multiplies the restitution values for both colliding bodies. A multiplied value of 0 means
     * that all energy is lost in the collision while a value of 1 means that no energy is lost. Should be
     * set in the range 0 to 1. Defaults to 0.
     * @property {number} group The collision group this body belongs to. Combine the group and the mask to
     * prevent bodies colliding with each other. Defaults to 1.
     * @property {number} mask The collision mask sets which groups this body collides with. It is a bitfield
     * of 16 bits, the first 8 bits are reserved for engine use. Defaults to 65535.
     * @property {string} type The rigid body type determines how the body is simulated. Can be:
     *
     * * {@link pc.BODYTYPE_STATIC}: infinite mass and cannot move.
     * * {@link pc.BODYTYPE_DYNAMIC}: simulated according to applied forces.
     * * {@link pc.BODYTYPE_KINEMATIC}: infinite mass and does not respond to forces but can still be moved
     * by setting their velocity or position.
     *
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

        this._linearVelocity = new pc.Vec3(0, 0, 0);
        this._angularVelocity = new pc.Vec3(0, 0, 0);
    };
    RigidBodyComponent.prototype = Object.create(pc.Component.prototype);
    RigidBodyComponent.prototype.constructor = RigidBodyComponent;

    // Events Documentation
    /**
     * @event
     * @name pc.RigidBodyComponent#contact
     * @description The 'contact' event is fired when a contact occurs between two rigid bodies.
     * @param {pc.ContactResult} result - Details of the contact between the two rigid bodies.
     */

    /**
     * @event
     * @name pc.RigidBodyComponent#collisionstart
     * @description The 'collisionstart' event is fired when two rigid bodies start touching.
     * @param {pc.ContactResult} result - Details of the contact between the two rigid bodies.
     */

    /**
     * @event
     * @name pc.RigidBodyComponent#collisionend
     * @description The 'collisionend' event is fired two rigid-bodies stop touching.
     * @param {pc.Entity} other - The {@link pc.Entity} that stopped touching this rigid body.
     */

    /**
     * @event
     * @name pc.RigidBodyComponent#triggerenter
     * @description The 'triggerenter' event is fired when a rigid body enters a trigger volume.
     * @param {pc.Entity} other - The {@link pc.Entity} with trigger volume that this rigidbody entered.
     */

    /**
     * @event
     * @name pc.RigidBodyComponent#triggerleave
     * @description The 'triggerleave' event is fired when a rigid body exits a trigger volume.
     * @param {pc.Entity} other - The {@link pc.Entity} with trigger volume that this rigidbody exited.
     */

    Object.defineProperty(RigidBodyComponent.prototype, "linearVelocity", {
        get: function () {
            var body = this.body;
            if (body && this.type === pc.BODYTYPE_DYNAMIC) {
                var vel = body.getLinearVelocity();
                this._linearVelocity.set(vel.x(), vel.y(), vel.z());
            }
            return this._linearVelocity;
        },
        set: function (lv) {
            var body = this.body;
            if (body && this.type === pc.BODYTYPE_DYNAMIC) {
                body.activate();

                ammoVec1.setValue(lv.x, lv.y, lv.z);
                body.setLinearVelocity(ammoVec1);

                this._linearVelocity.copy(lv);
            }
        }
    });

    Object.defineProperty(RigidBodyComponent.prototype, "angularVelocity", {
        get: function () {
            var body = this.body;
            if (body && this.type === pc.BODYTYPE_DYNAMIC) {
                var vel = body.getAngularVelocity();
                this._angularVelocity.set(vel.x(), vel.y(), vel.z());
            }
            return this._angularVelocity;
        },
        set: function (av) {
            var body = this.body;
            if (body && this.type === pc.BODYTYPE_DYNAMIC) {
                body.activate();

                ammoVec1.setValue(av.x, av.y, av.z);
                body.setAngularVelocity(ammoVec1);

                this._angularVelocity.copy(av);
            }
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
                if (this.body)
                    this.system.onRemove(this.entity, this);

                var mass = this.type === pc.BODYTYPE_DYNAMIC ? this.mass : 0;

                this._getEntityTransform(ammoTransform);

                var body = this.system.createBody(mass, shape, ammoTransform);

                body.setRestitution(this.restitution);
                body.setFriction(this.friction);
                body.setDamping(this.linearDamping, this.angularDamping);

                if (this.type === pc.BODYTYPE_DYNAMIC) {
                    var linearFactor = this.linearFactor;
                    ammoVec1.setValue(linearFactor.x, linearFactor.y, linearFactor.z);
                    body.setLinearFactor(ammoVec1);

                    var angularFactor = this.angularFactor;
                    ammoVec1.setValue(angularFactor.x, angularFactor.y, angularFactor.z);
                    body.setAngularFactor(ammoVec1);
                } else if (this.type === pc.BODYTYPE_KINEMATIC) {
                    body.setCollisionFlags(body.getCollisionFlags() | pc.BODYFLAG_KINEMATIC_OBJECT);
                    body.setActivationState(pc.BODYSTATE_DISABLE_DEACTIVATION);
                }

                body.entity = entity;

                entity.rigidbody.body = body;

                if (this.enabled && this.entity.enabled) {
                    this.enableSimulation();
                }
            }
        },

        /**
         * @function
         * @name pc.RigidBodyComponent#isActive
         * @description Returns true if the rigid body is currently actively being simulated. I.e. Not 'sleeping'.
         * @returns {boolean} True if the body is active.
         */
        isActive: function () {
            var body = this.body;
            return body ? body.isActive() : false;
        },

        /**
         * @function
         * @name pc.RigidBodyComponent#activate
         * @description Forcibly activate the rigid body simulation. Only affects rigid bodies of
         * type pc.BODYTYPE_DYNAMIC.
         */
        activate: function () {
            var body = this.body;
            if (body) {
                body.activate();
            }
        },

        enableSimulation: function () {
            if (this.entity.collision && this.entity.collision.enabled && !this.data.simulationEnabled) {
                var body = this.body;
                if (body) {
                    this.system.addBody(body, this.group, this.mask);

                    switch (this.type) {
                        case pc.BODYTYPE_DYNAMIC:
                            this.system._dynamic.push(this);
                            body.forceActivationState(pc.BODYFLAG_ACTIVE_TAG);
                            this.syncEntityToBody();
                            break;
                        case pc.BODYTYPE_KINEMATIC:
                            this.system._kinematic.push(this);
                            body.forceActivationState(pc.BODYSTATE_DISABLE_DEACTIVATION);
                            break;
                        case pc.BODYTYPE_STATIC:
                            body.forceActivationState(pc.BODYFLAG_ACTIVE_TAG);
                            break;
                    }

                    if (this.entity.collision.type === 'compound') {
                        this.system._compounds.push(this.entity.collision);
                    }

                    body.activate();

                    this.data.simulationEnabled = true;
                }
            }
        },

        disableSimulation: function () {
            var body = this.body;
            if (body && this.data.simulationEnabled) {
                var idx;

                idx = this.system._compounds.indexOf(this.entity.collision);
                if (idx > -1) {
                    this.system._compounds.splice(idx, 1);
                }

                idx = this.system._dynamic.indexOf(this);
                if (idx > -1) {
                    this.system._dynamic.splice(idx, 1);
                }

                idx = this.system._kinematic.indexOf(this);
                if (idx > -1) {
                    this.system._kinematic.splice(idx, 1);
                }

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
         * @param {pc.Vec3|number} x - A 3-dimensional vector representing the force in world-space or
         * the x-component of the force in world-space.
         * @param {pc.Vec3|number} [y] - An optional 3-dimensional vector representing the relative point at
         * which to apply the impulse in world-space or the y-component of the force in world-space.
         * @param {number} [z] - The z-component of the force in world-space.
         * @param {number} [px] - The x-component of a world-space offset from the body's position where the force is applied.
         * @param {number} [py] - The y-component of a world-space offset from the body's position where the force is applied.
         * @param {number} [pz] - The z-component of a world-space offset from the body's position where the force is applied.
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
         * @param {pc.Vec3|number} x - A 3-dimensional vector representing the torque force in world-space or
         * the x-component of the torque force in world-space.
         * @param {number} [y] - The y-component of the torque force in world-space.
         * @param {number} [z] - The z-component of the torque force in world-space.
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
         * @param {pc.Vec3|number} x - A 3-dimensional vector representing the impulse in world-space or
         * the x-component of the impulse in world-space.
         * @param {pc.Vec3|number} [y] - An optional 3-dimensional vector representing the relative point at
         * which to apply the impulse in the local-space of the entity or the y-component of the impulse to
         * apply in world-space.
         * @param {number} [z] - The z-component of the impulse to apply in world-space.
         * @param {number} [px=0] - The x-component of the point at which to apply the impulse in the local-space of the entity.
         * @param {number} [py=0] - The y-component of the point at which to apply the impulse in the local-space of the entity.
         * @param {number} [pz=0] - The z-component of the point at which to apply the impulse in the local-space of the entity.
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
         * @param {pc.Vec3|number} x - A 3-dimensional vector representing the torque impulse in world-space or
         * the x-component of the torque impulse in world-space.
         * @param {number} [y] - The y-component of the torque impulse in world-space.
         * @param {number} [z] - The z-component of the torque impulse in world-space.
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
         * @description Returns true if the rigid body is of type {@link pc.BODYTYPE_STATIC}.
         * @returns {boolean} True if static.
         */
        isStatic: function () {
            return (this.type === pc.BODYTYPE_STATIC);
        },

        /**
         * @function
         * @name pc.RigidBodyComponent#isStaticOrKinematic
         * @description Returns true if the rigid body is of type {@link pc.BODYTYPE_STATIC} or {@link pc.BODYTYPE_KINEMATIC}.
         * @returns {boolean} True if static or kinematic.
         */
        isStaticOrKinematic: function () {
            return (this.type === pc.BODYTYPE_STATIC || this.type === pc.BODYTYPE_KINEMATIC);
        },

        /**
         * @function
         * @name pc.RigidBodyComponent#isKinematic
         * @description Returns true if the rigid body is of type {@link pc.BODYTYPE_KINEMATIC}.
         * @returns {boolean} True if kinematic.
         */
        isKinematic: function () {
            return (this.type === pc.BODYTYPE_KINEMATIC);
        },

        /**
         * @private
         * @function
         * @name pc.RigidBodyComponent#_getEntityTransform
         * @description Writes an entity transform into an Ammo.btTransform but ignoring scale.
         * @param {object} transform - The ammo transform to write the entity transform to.
         */
        _getEntityTransform: function (transform) {
            var pos = this.entity.getPosition();
            var rot = this.entity.getRotation();

            ammoVec1.setValue(pos.x, pos.y, pos.z);
            ammoQuat.setValue(rot.x, rot.y, rot.z, rot.w);

            transform.setOrigin(ammoVec1);
            transform.setRotation(ammoQuat);
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
            var body = this.data.body;
            if (body) {
                this._getEntityTransform(ammoTransform);

                body.setWorldTransform(ammoTransform);

                if (this.type === pc.BODYTYPE_KINEMATIC) {
                    var motionState = body.getMotionState();
                    if (motionState) {
                        motionState.setWorldTransform(ammoTransform);
                    }
                }
                body.activate();
            }
        },

        /**
         * @private
         * @function
         * @name pc.RigidBodyComponent#_updateDynamic
         * @description Sets an entity's transform to match that of the world transformation
         * matrix of a dynamic rigid body's motion state.
         */
        _updateDynamic: function () {
            var body = this.data.body;

            // If a dynamic body is frozen, we can assume its motion state transform is
            // the same is the entity world transform
            if (body.isActive()) {
                // Update the motion state. Note that the test for the presence of the motion
                // state is technically redundant since the engine creates one for all bodies.
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
         * @private
         * @function
         * @name pc.RigidBodyComponent#_updateKinematic
         * @description Writes the entity's world transformation matrix into the motion state
         * of a kinematic body.
         */
        _updateKinematic: function () {
            var body = this.data.body;
            var motionState = body.getMotionState();
            if (motionState) {
                this._getEntityTransform(ammoTransform);
                motionState.setWorldTransform(ammoTransform);
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
         * @param {pc.Vec3|number} x - A 3-dimensional vector holding the new position or the new position x-coordinate.
         * @param {pc.Vec3|pc.Quat|number} y - A 3-dimensional vector or quaternion holding the new rotation or the new
         * position y-coordinate.
         * @param {number} [z] - The new position z-coordinate.
         * @param {number} [rx] - The new Euler x-angle value.
         * @param {number} [ry] - The new Euler y-angle value.
         * @param {number} [rz] - The new Euler z-angle value.
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
            if (body && this.type === pc.BODYTYPE_DYNAMIC) {
                var enabled = this.enabled && this.entity.enabled;
                if (enabled) {
                    this.disableSimulation();
                }

                // calculateLocalInertia writes local inertia to ammoVec1 here...
                body.getCollisionShape().calculateLocalInertia(newValue, ammoVec1);
                // ...and then writes the calculated local inertia to the body
                body.setMassProps(newValue, ammoVec1);
                body.updateInertiaTensor();

                if (enabled) {
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
            if (body && this.type === pc.BODYTYPE_DYNAMIC) {
                ammoVec1.setValue(newValue.x, newValue.y, newValue.z);
                body.setLinearFactor(ammoVec1);
            }
        },

        onSetAngularFactor: function (name, oldValue, newValue) {
            var body = this.data.body;
            if (body && this.type === pc.BODYTYPE_DYNAMIC) {
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
