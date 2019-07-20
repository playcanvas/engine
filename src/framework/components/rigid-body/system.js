Object.assign(pc, function () {
    var ammoRayStart, ammoRayEnd;

    var collisions = {};
    var frameCollisions = {};


    // DEPRECATED WARNINGS
    var WARNED_RAYCAST_CALLBACK = false;

    /**
     * @constructor
     * @name pc.RaycastResult
     * @classdesc Object holding the result of a successful raycast hit
     * @description Create a new RaycastResult
     * @param {pc.Entity} entity The entity that was hit
     * @param {pc.Vec3} point The point at which the ray hit the entity in world space
     * @param {pc.Vec3} normal The normal vector of the surface where the ray hit in world space.
     * @property {pc.Entity} entity The entity that was hit
     * @property {pc.Vec3} point The point at which the ray hit the entity in world space
     * @property {pc.Vec3} normal The normal vector of the surface where the ray hit in world space.
     */
    var RaycastResult = function RaycastResult(entity, point, normal) {
        this.entity = entity;
        this.point = point;
        this.normal = normal;
    };

    /**
     * @constructor
     * @name pc.SingleContactResult
     * @classdesc Object holding the result of a contact between two rigid bodies
     * @description Create a new SingleContactResult
     * @param {pc.Entity} a The first entity involved in the contact
     * @param {pc.Entity} b The second entity involved in the contact
     * @param {pc.ContactPoint} contactPoint The contact point between the two entities
     * @property {pc.Entity} a The first entity involved in the contact
     * @property {pc.Entity} b The second entity involved in the contact
     * @property {pc.Vec3} localPointA The point on Entity A where the contact occurred, relative to A
     * @property {pc.Vec3} localPointB The point on Entity B where the contact occurred, relative to B
     * @property {pc.Vec3} pointA The point on Entity A where the contact occurred, in world space
     * @property {pc.Vec3} pointB The point on Entity B where the contact occurred, in world space
     * @property {pc.Vec3} normal The normal vector of the contact on Entity B, in world space
     */
    var SingleContactResult = function SingleContactResult(a, b, contactPoint) {
        if (arguments.length === 0) {
            this.a = null;
            this.b = null;
            this.localPointA = new pc.Vec3();
            this.localPointB = new pc.Vec3();
            this.pointA = new pc.Vec3();
            this.pointB = new pc.Vec3();
            this.normal = new pc.Vec3();
        } else {
            this.a = a;
            this.b = b;
            this.localPointA = contactPoint.localPoint;
            this.localPointB = contactPoint.localPointOther;
            this.pointA = contactPoint.point;
            this.pointB = contactPoint.pointOther;
            this.normal = contactPoint.normal;
        }
    };

    /**
     * @constructor
     * @name pc.ContactPoint
     * @classdesc Object holding the result of a contact between two Entities.
     * @description Create a new ContactPoint
     * @param {pc.Vec3} localPoint The point on the entity where the contact occurred, relative to the entity
     * @param {pc.Vec3} localPointOther The point on the other entity where the contact occurred, relative to the other entity
     * @param {pc.Vec3} point The point on the entity where the contact occurred, in world space
     * @param {pc.Vec3} pointOther The point on the other entity where the contact occurred, in world space
     * @param {pc.Vec3} normal The normal vector of the contact on the other entity, in world space
     * @property {pc.Vec3} localPoint The point on the entity where the contact occurred, relative to the entity
     * @property {pc.Vec3} localPointOther The point on the other entity where the contact occurred, relative to the other entity
     * @property {pc.Vec3} point The point on the entity where the contact occurred, in world space
     * @property {pc.Vec3} pointOther The point on the other entity where the contact occurred, in world space
     * @property {pc.Vec3} normal The normal vector of the contact on the other entity, in world space
     */
    var ContactPoint = function ContactPoint(localPoint, localPointOther, point, pointOther, normal) {
        if (arguments.length === 0) {
            this.localPoint = new pc.Vec3();
            this.localPointOther = new pc.Vec3();
            this.point = new pc.Vec3();
            this.pointOther = new pc.Vec3();
            this.normal = new pc.Vec3();
        } else {
            this.localPoint = localPoint;
            this.localPointOther = localPointOther;
            this.point = point;
            this.pointOther = pointOther;
            this.normal = normal;
        }
    };

    /**
     * @constructor
     * @name pc.ContactResult
     * @classdesc Object holding the result of a contact between two Entities
     * @description Create a new ContactResult
     * @param {pc.Entity} other The entity that was involved in the contact with this entity
     * @param {pc.ContactPoint[]} contacts An array of ContactPoints with the other entity
     * @property {pc.Entity} other The entity that was involved in the contact with this entity
     * @property {pc.ContactPoint[]} contacts An array of ContactPoints with the other entity
     */
    var ContactResult = function ContactResult(other, contacts) {
        this.other = other;
        this.contacts = contacts;
    };

    // Events Documentation
    /**
     * @event
     * @name pc.RigidBodyComponentSystem#contact
     * @description Fired when a contact occurs between two rigid bodies
     * @param {pc.SingleContactResult} result Details of the contact between the two bodies
     */

    var _schema = [
        'enabled',
        'type',
        'mass',
        'linearDamping',
        'angularDamping',
        'linearFactor',
        'angularFactor',
        'friction',
        'restitution',
        'group',
        'mask',
        'body'
    ];

    /**
     * @constructor
     * @name pc.RigidBodyComponentSystem
     * @classdesc The RigidBodyComponentSystem maintains the dynamics world for simulating rigid bodies, it also controls global values for the world such as gravity.
     * Note: The RigidBodyComponentSystem is only valid if 3D Physics is enabled in your application. You can enable this in the application settings for your Depot.
     * @description Create a new RigidBodyComponentSystem
     * @param {pc.Application} app The Application
     * @extends pc.ComponentSystem
     */
    var RigidBodyComponentSystem = function RigidBodyComponentSystem(app) {
        pc.ComponentSystem.call(this, app);

        this.id = 'rigidbody';
        this.description = "Adds the entity to the scene's physical simulation.";
        this._stats = app.stats.frame;

        this.ComponentType = pc.RigidBodyComponent;
        this.DataType = pc.RigidBodyComponentData;

        this.contactPointPool = new pc.AllocatePool(ContactPoint, 1);
        this.contactResultPool = new pc.AllocatePool(ContactResult, 1);
        this.singleContactResultPool = new pc.AllocatePool(SingleContactResult, 1);

        this.schema = _schema;

        this.maxSubSteps = 10;
        this.fixedTimeStep = 1 / 60;

        this.on('remove', this.onRemove, this);
    };
    RigidBodyComponentSystem.prototype = Object.create(pc.ComponentSystem.prototype);
    RigidBodyComponentSystem.prototype.constructor = RigidBodyComponentSystem;

    pc.Component._buildAccessors(pc.RigidBodyComponent.prototype, _schema);

    Object.assign(RigidBodyComponentSystem.prototype, {
        onLibraryLoaded: function () {
            // Create the Ammo physics world
            if (typeof Ammo !== 'undefined') {
                var collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
                var dispatcher = new Ammo.btCollisionDispatcher(collisionConfiguration);
                var overlappingPairCache = new Ammo.btDbvtBroadphase();
                var solver = new Ammo.btSequentialImpulseConstraintSolver();
                this.dynamicsWorld = new Ammo.btDiscreteDynamicsWorld(dispatcher, overlappingPairCache, solver, collisionConfiguration);

                this._ammoGravity = new Ammo.btVector3(0, -9.82, 0);
                this.dynamicsWorld.setGravity(this._ammoGravity);

                // Lazily create temp vars
                ammoRayStart = new Ammo.btVector3();
                ammoRayEnd = new Ammo.btVector3();
                pc.ComponentSystem.bind('update', this.onUpdate, this);
            } else {
                // Unbind the update function if we haven't loaded Ammo by now
                pc.ComponentSystem.unbind('update', this.onUpdate, this);
            }
        },

        initializeComponentData: function (component, _data, properties) {
            properties = ['enabled', 'mass', 'linearDamping', 'angularDamping', 'linearFactor', 'angularFactor', 'friction', 'restitution', 'type', 'group', 'mask'];

            // duplicate the input data because we are modifying it
            var data = {};
            for (var i = 0, len = properties.length; i < len; i++) {
                var property = properties[i];
                data[property] = _data[property];
            }

            // backwards compatibility
            if (_data.bodyType) {
                data.type = _data.bodyType;
                console.warn("WARNING: rigidbody.bodyType: Property is deprecated. Use type instead.");
            }

            if (data.linearFactor && pc.type(data.linearFactor) === 'array') {
                data.linearFactor = new pc.Vec3(data.linearFactor[0], data.linearFactor[1], data.linearFactor[2]);
            }
            if (data.angularFactor && pc.type(data.angularFactor) === 'array') {
                data.angularFactor = new pc.Vec3(data.angularFactor[0], data.angularFactor[1], data.angularFactor[2]);
            }

            pc.ComponentSystem.prototype.initializeComponentData.call(this, component, data, properties);
        },

        cloneComponent: function (entity, clone) {
            // create new data block for clone
            var data = {
                enabled: entity.rigidbody.enabled,
                mass: entity.rigidbody.mass,
                linearDamping: entity.rigidbody.linearDamping,
                angularDamping: entity.rigidbody.angularDamping,
                linearFactor: [entity.rigidbody.linearFactor.x, entity.rigidbody.linearFactor.y, entity.rigidbody.linearFactor.z],
                angularFactor: [entity.rigidbody.angularFactor.x, entity.rigidbody.angularFactor.y, entity.rigidbody.angularFactor.z],
                friction: entity.rigidbody.friction,
                restitution: entity.rigidbody.restitution,
                type: entity.rigidbody.type,
                group: entity.rigidbody.group,
                mask: entity.rigidbody.mask
            };

            this.addComponent(clone, data);
        },

        onRemove: function (entity, data) {
            if (data.body) {
                this.removeBody(data.body);
                Ammo.destroy(data.body);
            }

            data.body = null;
        },

        addBody: function (body, group, mask) {
            if (group !== undefined && mask !== undefined) {
                this.dynamicsWorld.addRigidBody(body, group, mask);
            } else {
                this.dynamicsWorld.addRigidBody(body);
            }

            return body;
        },

        removeBody: function (body) {
            this.dynamicsWorld.removeRigidBody(body);
        },

        addConstraint: function (constraint) {
            this.dynamicsWorld.addConstraint(constraint);
            return constraint;
        },

        removeConstraint: function (constraint) {
            this.dynamicsWorld.removeConstraint(constraint);
        },

        /**
         * @function
         * @name pc.RigidBodyComponentSystem#setGravity
         * @description Set the gravity vector for the 3D physics world. This function has two valid signatures.
         * You can either specify the gravity with a 3D-vector or 3 numbers.
         * @param {pc.Vec3|Number} x The x-component of the gravity vector
         * @param {Number} [y] The y-component of the gravity vector
         * @param {Number} [z] The z-component of the gravity vector
         * @example
         * // Set via vector
         * var gravity = new pc.Vec3(0, -9.81, 0);
         * this.app.systems.rigidbody.setGravity(gravity);
         * @example
         * // Set via numbers
         * this.app.systems.rigidbody.setGravity(0, -9.81, 0);
         */
        setGravity: function () {
            var x, y, z;
            if (arguments.length === 1) {
                x = arguments[0].x;
                y = arguments[0].y;
                z = arguments[0].z;
            } else {
                x = arguments[0];
                y = arguments[1];
                z = arguments[2];
            }
            this._ammoGravity.setValue(x, y, z);
            this.dynamicsWorld.setGravity(this._ammoGravity);
        },

        /**
         * @function
         * @name pc.RigidBodyComponentSystem#raycastFirst
         * @description Raycast the world and return the first entity the ray hits. Fire a ray into the world from start to end,
         * if the ray hits an entity with a collision component, it returns a {@link pc.RaycastResult}, otherwise returns null.
         * @param {pc.Vec3} start The world space point where the ray starts
         * @param {pc.Vec3} end The world space point where the ray ends
         * @returns {pc.RaycastResult} The result of the raycasting or null if there was no hit.
         */
        raycastFirst: function (start, end) {
            var result = null;

            ammoRayStart.setValue(start.x, start.y, start.z);
            ammoRayEnd.setValue(end.x, end.y, end.z);
            var rayCallback = new Ammo.ClosestRayResultCallback(ammoRayStart, ammoRayEnd);

            this.dynamicsWorld.rayTest(ammoRayStart, ammoRayEnd, rayCallback);
            if (rayCallback.hasHit()) {
                var collisionObj = rayCallback.get_m_collisionObject();
                var body = Ammo.castObject(collisionObj, Ammo.btRigidBody);
                if (body) {
                    var point = rayCallback.get_m_hitPointWorld();
                    var normal = rayCallback.get_m_hitNormalWorld();

                    result = new RaycastResult(
                        body.entity,
                        new pc.Vec3(point.x(), point.y(), point.z()),
                        new pc.Vec3(normal.x(), normal.y(), normal.z())
                    );

                    // keeping for backwards compatibility
                    if (arguments.length > 2) {
                        var callback = arguments[2];
                        callback(result);

                        if (!WARNED_RAYCAST_CALLBACK) {
                            console.warn('[DEPRECATED]: pc.RigidBodyComponentSystem#rayCastFirst no longer requires a callback. The result of the raycast is returned by the function instead.');
                            WARNED_RAYCAST_CALLBACK = true;
                        }
                    }
                }
            }

            Ammo.destroy(rayCallback);

            return result;
        },

        /**
         * @private
         * @function
         * @name pc.RigidBodyComponentSystem#_storeCollision
         * @description Stores a collision between the entity and other in the contacts map and returns true if it is a new collision
         * @param {pc.Entity} entity The entity
         * @param {pc.Entity} other The entity that collides with the first entity
         * @returns {Boolean} true if this is a new collision, false otherwise.
         */
        _storeCollision: function (entity, other) {
            var isNewCollision = false;
            var guid = entity.getGuid();

            collisions[guid] = collisions[guid] || { others: [], entity: entity };

            if (collisions[guid].others.indexOf(other) < 0) {
                collisions[guid].others.push(other);
                isNewCollision = true;
            }

            frameCollisions[guid] = frameCollisions[guid] || { others: [], entity: entity };
            frameCollisions[guid].others.push(other);

            return isNewCollision;
        },

        _createContactPointFromAmmo: function (contactPoint) {
            var contact = this.contactPointPool.allocate();

            contact.localPoint.set(contactPoint.get_m_localPointA().x(), contactPoint.get_m_localPointA().y(), contactPoint.get_m_localPointA().z());
            contact.localPointOther.set(contactPoint.get_m_localPointB().x(), contactPoint.get_m_localPointB().y(), contactPoint.get_m_localPointB().z());
            contact.point.set(contactPoint.getPositionWorldOnA().x(), contactPoint.getPositionWorldOnA().y(), contactPoint.getPositionWorldOnA().z());
            contact.pointOther.set(contactPoint.getPositionWorldOnB().x(), contactPoint.getPositionWorldOnB().y(), contactPoint.getPositionWorldOnB().z());
            contact.normal.set(contactPoint.get_m_normalWorldOnB().x(), contactPoint.get_m_normalWorldOnB().y(), contactPoint.get_m_normalWorldOnB().z());

            return contact;
        },

        _createReverseContactPointFromAmmo: function (contactPoint) {
            var contact = this.contactPointPool.allocate();

            contact.localPointOther.set(contactPoint.get_m_localPointA().x(), contactPoint.get_m_localPointA().y(), contactPoint.get_m_localPointA().z());
            contact.localPoint.set(contactPoint.get_m_localPointB().x(), contactPoint.get_m_localPointB().y(), contactPoint.get_m_localPointB().z());
            contact.pointOther.set(contactPoint.getPositionWorldOnA().x(), contactPoint.getPositionWorldOnA().y(), contactPoint.getPositionWorldOnA().z());
            contact.point.set(contactPoint.getPositionWorldOnB().x(), contactPoint.getPositionWorldOnB().y(), contactPoint.getPositionWorldOnB().z());
            contact.normal.set(contactPoint.get_m_normalWorldOnB().x(), contactPoint.get_m_normalWorldOnB().y(), contactPoint.get_m_normalWorldOnB().z());
            return contact;
        },

        _createSingleContactResult: function (a, b, contactPoint) {
            var result = this.singleContactResultPool.allocate();

            result.a = a;
            result.b = b;
            result.localPointA = contactPoint.localPoint;
            result.localPointB = contactPoint.localPointOther;
            result.pointA = contactPoint.point;
            result.pointB = contactPoint.pointOther;
            result.normal = contactPoint.normal;

            return result;
        },

        _createContactResult: function (other, contacts) {
            var result = this.contactResultPool.allocate();
            result.other = other;
            result.contacts = contacts;
            return result;
        },

        /**
         * @private
         * @function
         * @name pc.RigidBodyComponentSystem#_cleanOldCollisions
         * @description Removes collisions that no longer exist from the collisions list and fires collisionend events to the
         * related entities.
         */
        _cleanOldCollisions: function () {
            for (var guid in collisions) {
                if (collisions.hasOwnProperty(guid)) {
                    var entity = collisions[guid].entity;
                    var entityCollision = entity.collision;
                    var others = collisions[guid].others;
                    var length = others.length;
                    var i = length;
                    while (i--) {
                        var other = others[i];
                        // if the contact does not exist in the current frame collisions then fire event
                        if (!frameCollisions[guid] || frameCollisions[guid].others.indexOf(other) < 0) {
                            // remove from others list
                            others.splice(i, 1);

                            if (entityCollision && other.collision) {
                                if (entity.rigidbody && other.rigidbody) {
                                    // if both are rigidbodies fire collision end
                                    entityCollision.fire("collisionend", other);
                                } else if (entity.trigger) {
                                    // if entity is a trigger
                                    entityCollision.fire("triggerleave", other);
                                }
                            }
                        }
                    }

                    if (others.length === 0) {
                        delete collisions[guid];
                    }
                }
            }
        },

        onUpdate: function (dt) {
            // #ifdef PROFILER
            this._stats.physicsStart = pc.now();
            // #endif

            // Update the transforms of all bodies
            this.dynamicsWorld.stepSimulation(dt, this.maxSubSteps, this.fixedTimeStep);

            // Update the transforms of all entities referencing a body
            var components = this.store;
            for (var id in components) {
                if (components.hasOwnProperty(id)) {
                    var entity = components[id].entity;
                    var componentData = components[id].data;
                    if (componentData.body && componentData.body.isActive() && componentData.enabled && entity.enabled) {
                        if (componentData.type === pc.BODYTYPE_DYNAMIC) {
                            entity.rigidbody.syncBodyToEntity();
                        } else if (componentData.type === pc.BODYTYPE_KINEMATIC) {
                            entity.rigidbody._updateKinematic(dt);
                        }
                    }

                }
            }

            // Check for collisions and fire callbacks
            var dispatcher = this.dynamicsWorld.getDispatcher();
            var numManifolds = dispatcher.getNumManifolds();
            var i, j;

            frameCollisions = {};

            // loop through the all contacts and fire events
            for (i = 0; i < numManifolds; i++) {
                var manifold = dispatcher.getManifoldByIndexInternal(i);
                var body0 = manifold.getBody0();
                var body1 = manifold.getBody1();
                var wb0 = Ammo.castObject(body0, Ammo.btRigidBody);
                var wb1 = Ammo.castObject(body1, Ammo.btRigidBody);
                var e0 = wb0.entity;
                var e1 = wb1.entity;

                // check if entity is null - TODO: investigate when this happens
                if (!e0 || !e1) {
                    continue;
                }

                var flags0 = body0.getCollisionFlags();
                var flags1 = body1.getCollisionFlags();

                var numContacts = manifold.getNumContacts();
                var forwardContacts = [];
                var reverseContacts = [];
                var newCollision, e0Events, e1Events;

                if (numContacts > 0) {
                    // don't fire contact events for triggers
                    if ((flags0 & pc.BODYFLAG_NORESPONSE_OBJECT) ||
                        (flags1 & pc.BODYFLAG_NORESPONSE_OBJECT)) {

                        e0Events = e0.collision ? e0.collision.hasEvent("triggerenter") || e0.collision.hasEvent("triggerleave") : false;
                        e1Events = e1.collision ? e1.collision.hasEvent("triggerenter") || e1.collision.hasEvent("triggerleave") : false;

                        if (e0Events) {
                            // fire triggerenter events
                            newCollision = this._storeCollision(e0, e1);
                            if (newCollision) {
                                if (e0.collision && !(flags1 & pc.BODYFLAG_NORESPONSE_OBJECT)) {
                                    e0.collision.fire("triggerenter", e1);
                                }
                            }
                        }

                        if (e1Events) {
                            newCollision = this._storeCollision(e1, e0);
                            if (newCollision) {
                                if (e1.collision && !(flags0 & pc.BODYFLAG_NORESPONSE_OBJECT)) {
                                    e1.collision.fire("triggerenter", e0);
                                }
                            }
                        }
                    } else {
                        e0Events = e0.collision ? e0.collision.hasEvent("collisionstart")  || e0.collision.hasEvent("collisionend") || e0.collision.hasEvent("contact") : false;
                        e1Events = e1.collision ? e1.collision.hasEvent("collisionstart") || e1.collision.hasEvent("collisionend") || e1.collision.hasEvent("contact") : false;
                        var globalEvents = this.hasEvent("contact");

                        if (globalEvents || e0Events || e1Events) {
                            for (j = 0; j < numContacts; j++) {
                                var btContactPoint = manifold.getContactPoint(j);

                                var contactPoint = this._createContactPointFromAmmo(btContactPoint);
                                var reverseContactPoint = null;
                                if (e0Events || e1Events) {
                                    reverseContactPoint = this._createReverseContactPointFromAmmo(btContactPoint);
                                    forwardContacts.push(contactPoint);
                                    reverseContacts.push(reverseContactPoint);
                                }

                                if (globalEvents) {
                                    // fire global contact event for every contact
                                    var result = this._createSingleContactResult(e0, e1, contactPoint);
                                    this.fire("contact", result);
                                }
                            }

                            if (e0Events) {
                                var forwardResult = this._createContactResult(e1, forwardContacts);

                                // fire contact events on collision volume
                                if (e0.collision) {
                                    e0.collision.fire("contact", forwardResult);
                                }

                                // fire collisionstart events
                                newCollision = this._storeCollision(e0, e1);
                                if (newCollision && e0.collision) {
                                    e0.collision.fire("collisionstart", forwardResult);
                                }
                            }

                            if (e1Events) {
                                var reverseResult = this._createContactResult(e0, reverseContacts);

                                if (e1.collision) {
                                    e1.collision.fire("contact", reverseResult);
                                }

                                newCollision = this._storeCollision(e1, e0);
                                if (newCollision && e1.collision) {
                                    e1.collision.fire("collisionstart", reverseResult);
                                }
                            }
                        }
                    }

                }
            }

            // check for collisions that no longer exist and fire events
            this._cleanOldCollisions();

            // Reset contact pools
            this.contactPointPool.freeAll();
            this.contactResultPool.freeAll();
            this.singleContactResultPool.freeAll();

            // #ifdef PROFILER
            this._stats.physicsTime = pc.now() - this._stats.physicsStart;
            // #endif
        }


    });

    return {
        // DEPRECATED ENUMS - see rigidbody_constants.js
        RIGIDBODY_TYPE_STATIC: 'static',
        RIGIDBODY_TYPE_DYNAMIC: 'dynamic',
        RIGIDBODY_TYPE_KINEMATIC: 'kinematic',
        RIGIDBODY_CF_STATIC_OBJECT: 1,
        RIGIDBODY_CF_KINEMATIC_OBJECT: 2,
        RIGIDBODY_CF_NORESPONSE_OBJECT: 4,
        RIGIDBODY_ACTIVE_TAG: 1,
        RIGIDBODY_ISLAND_SLEEPING: 2,
        RIGIDBODY_WANTS_DEACTIVATION: 3,
        RIGIDBODY_DISABLE_DEACTIVATION: 4,
        RIGIDBODY_DISABLE_SIMULATION: 5,

        RigidBodyComponentSystem: RigidBodyComponentSystem
    };
}());
