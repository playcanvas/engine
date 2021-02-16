import { now } from '../../../core/time.js';
import { ObjectPool } from '../../../core/object-pool.js';

import { Vec3 } from '../../../math/vec3.js';

import { Component } from '../component.js';
import { ComponentSystem } from '../system.js';

import { BODYFLAG_NORESPONSE_OBJECT } from './constants.js';
import { RigidBodyComponent } from './component.js';
import { RigidBodyComponentData } from './data.js';

var ammoRayStart, ammoRayEnd;

var collisions = {};
var frameCollisions = {};

/**
 * @class
 * @name RaycastResult
 * @classdesc Object holding the result of a successful raycast hit.
 * @description Create a new RaycastResult.
 * @param {Entity} entity - The entity that was hit.
 * @param {Vec3} point - The point at which the ray hit the entity in world space.
 * @param {Vec3} normal - The normal vector of the surface where the ray hit in world space.
 * @property {pc.Entity} entity The entity that was hit.
 * @property {pc.Vec3} point The point at which the ray hit the entity in world space.
 * @property {pc.Vec3} normal The normal vector of the surface where the ray hit in world space.
 */
class RaycastResult {
    constructor(entity, point, normal) {
        this.entity = entity;
        this.point = point;
        this.normal = normal;
    }
}

/**
 * @class
 * @name SingleContactResult
 * @classdesc Object holding the result of a contact between two rigid bodies.
 * @description Create a new SingleContactResult.
 * @param {Entity} a - The first entity involved in the contact.
 * @param {Entity} b - The second entity involved in the contact.
 * @param {ContactPoint} contactPoint - The contact point between the two entities.
 * @property {pc.Entity} a The first entity involved in the contact.
 * @property {pc.Entity} b The second entity involved in the contact.
 * @property {pc.Vec3} localPointA The point on Entity A where the contact occurred, relative to A.
 * @property {pc.Vec3} localPointB The point on Entity B where the contact occurred, relative to B.
 * @property {pc.Vec3} pointA The point on Entity A where the contact occurred, in world space.
 * @property {pc.Vec3} pointB The point on Entity B where the contact occurred, in world space.
 * @property {pc.Vec3} normal The normal vector of the contact on Entity B, in world space.
 */
class SingleContactResult {
    constructor(a, b, contactPoint) {
        if (arguments.length === 0) {
            this.a = null;
            this.b = null;
            this.localPointA = new Vec3();
            this.localPointB = new Vec3();
            this.pointA = new Vec3();
            this.pointB = new Vec3();
            this.normal = new Vec3();
        } else {
            this.a = a;
            this.b = b;
            this.localPointA = contactPoint.localPoint;
            this.localPointB = contactPoint.localPointOther;
            this.pointA = contactPoint.point;
            this.pointB = contactPoint.pointOther;
            this.normal = contactPoint.normal;
        }
    }
}

/**
 * @class
 * @name ContactPoint
 * @classdesc Object holding the result of a contact between two Entities.
 * @description Create a new ContactPoint.
 * @param {Vec3} localPoint - The point on the entity where the contact occurred, relative to the entity.
 * @param {Vec3} localPointOther - The point on the other entity where the contact occurred, relative to the other entity.
 * @param {Vec3} point - The point on the entity where the contact occurred, in world space.
 * @param {Vec3} pointOther - The point on the other entity where the contact occurred, in world space.
 * @param {Vec3} normal - The normal vector of the contact on the other entity, in world space.
 * @property {pc.Vec3} localPoint The point on the entity where the contact occurred, relative to the entity.
 * @property {pc.Vec3} localPointOther The point on the other entity where the contact occurred, relative to the other entity.
 * @property {pc.Vec3} point The point on the entity where the contact occurred, in world space.
 * @property {pc.Vec3} pointOther The point on the other entity where the contact occurred, in world space.
 * @property {pc.Vec3} normal The normal vector of the contact on the other entity, in world space.
 */
class ContactPoint {
    constructor(localPoint, localPointOther, point, pointOther, normal) {
        if (arguments.length === 0) {
            this.localPoint = new Vec3();
            this.localPointOther = new Vec3();
            this.point = new Vec3();
            this.pointOther = new Vec3();
            this.normal = new Vec3();
        } else {
            this.localPoint = localPoint;
            this.localPointOther = localPointOther;
            this.point = point;
            this.pointOther = pointOther;
            this.normal = normal;
        }
    }
}

/**
 * @class
 * @name ContactResult
 * @classdesc Object holding the result of a contact between two Entities.
 * @description Create a new ContactResult.
 * @param {Entity} other - The entity that was involved in the contact with this entity.
 * @param {ContactPoint[]} contacts - An array of ContactPoints with the other entity.
 * @property {pc.Entity} other The entity that was involved in the contact with this entity.
 * @property {pc.ContactPoint[]} contacts An array of ContactPoints with the other entity.
 */
class ContactResult {
    constructor(other, contacts) {
        this.other = other;
        this.contacts = contacts;
    }
}

// Events Documentation
/**
 * @event
 * @name RigidBodyComponentSystem#contact
 * @description Fired when a contact occurs between two rigid bodies.
 * @param {SingleContactResult} result - Details of the contact between the two bodies.
 */

const _schema = [
    'enabled',
    'type',
    'mass',
    'linearDamping',
    'angularDamping',
    'linearFactor',
    'angularFactor',
    'friction',
    'rollingFriction',
    'restitution',
    'group',
    'mask',
    'body'
];

/**
 * @class
 * @name RigidBodyComponentSystem
 * @augments ComponentSystem
 * @classdesc The RigidBodyComponentSystem maintains the dynamics world for simulating rigid bodies,
 * it also controls global values for the world such as gravity. Note: The RigidBodyComponentSystem
 * is only valid if 3D Physics is enabled in your application. You can enable this in the application
 * settings for your project.
 * @description Create a new RigidBodyComponentSystem.
 * @param {Application} app - The Application.
 * @property {pc.Vec3} gravity The world space vector representing global gravity in the physics simulation.
 * Defaults to [0, -9.81, 0] which is an approximation of the gravitational force on Earth.
 */
class RigidBodyComponentSystem extends ComponentSystem {
    constructor(app) {
        super(app);

        this.id = 'rigidbody';
        this._stats = app.stats.frame;

        this.ComponentType = RigidBodyComponent;
        this.DataType = RigidBodyComponentData;

        this.contactPointPool = null;
        this.contactResultPool = null;
        this.singleContactResultPool = null;

        this.schema = _schema;

        this.maxSubSteps = 10;
        this.fixedTimeStep = 1 / 60;
        this.gravity = new Vec3(0, -9.81, 0);

        // Arrays of pc.RigidBodyComponents filtered on body type
        this._dynamic = [];
        this._kinematic = [];
        this._triggers = [];
        this._compounds = [];

        this.on('beforeremove', this.onBeforeRemove, this);
        this.on('remove', this.onRemove, this);
    }

    onLibraryLoaded() {
        // Create the Ammo physics world
        if (typeof Ammo !== 'undefined') {
            this.collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
            this.dispatcher = new Ammo.btCollisionDispatcher(this.collisionConfiguration);
            this.overlappingPairCache = new Ammo.btDbvtBroadphase();
            this.solver = new Ammo.btSequentialImpulseConstraintSolver();
            this.dynamicsWorld = new Ammo.btDiscreteDynamicsWorld(this.dispatcher, this.overlappingPairCache, this.solver, this.collisionConfiguration);

            if (this.dynamicsWorld.setInternalTickCallback) {
                var checkForCollisionsPointer = Ammo.addFunction(this._checkForCollisions.bind(this), 'vif');
                this.dynamicsWorld.setInternalTickCallback(checkForCollisionsPointer);
            } else {
                // #ifdef DEBUG
                console.warn("WARNING: This version of ammo.js can potentially fail to report contacts. Please update it to the latest version.");
                // #endif
            }

            // Lazily create temp vars
            ammoRayStart = new Ammo.btVector3();
            ammoRayEnd = new Ammo.btVector3();

            this.contactPointPool = new ObjectPool(ContactPoint, 1);
            this.contactResultPool = new ObjectPool(ContactResult, 1);
            this.singleContactResultPool = new ObjectPool(SingleContactResult, 1);

            ComponentSystem.bind('update', this.onUpdate, this);
        } else {
            // Unbind the update function if we haven't loaded Ammo by now
            ComponentSystem.unbind('update', this.onUpdate, this);
        }
    }

    initializeComponentData(component, _data, properties) {
        properties = ['enabled', 'mass', 'linearDamping', 'angularDamping', 'linearFactor', 'angularFactor', 'friction', 'rollingFriction', 'restitution', 'type', 'group', 'mask'];

        // duplicate the input data because we are modifying it
        var data = {};
        for (var i = 0, len = properties.length; i < len; i++) {
            var property = properties[i];
            data[property] = _data[property];
        }

        // backwards compatibility
        if (_data.bodyType) {
            data.type = _data.bodyType;
            // #ifdef DEBUG
            console.warn('DEPRECATED: pc.RigidBodyComponent#bodyType is deprecated. Use pc.RigidBodyComponent#type instead.');
            // #endif
        }

        if (data.linearFactor && Array.isArray(data.linearFactor)) {
            data.linearFactor = new Vec3(data.linearFactor[0], data.linearFactor[1], data.linearFactor[2]);
        }
        if (data.angularFactor && Array.isArray(data.angularFactor)) {
            data.angularFactor = new Vec3(data.angularFactor[0], data.angularFactor[1], data.angularFactor[2]);
        }

        super.initializeComponentData(component, data, properties);
    }

    cloneComponent(entity, clone) {
        // create new data block for clone
        var data = {
            enabled: entity.rigidbody.enabled,
            mass: entity.rigidbody.mass,
            linearDamping: entity.rigidbody.linearDamping,
            angularDamping: entity.rigidbody.angularDamping,
            linearFactor: [entity.rigidbody.linearFactor.x, entity.rigidbody.linearFactor.y, entity.rigidbody.linearFactor.z],
            angularFactor: [entity.rigidbody.angularFactor.x, entity.rigidbody.angularFactor.y, entity.rigidbody.angularFactor.z],
            friction: entity.rigidbody.friction,
            rollingFriction: entity.rigidbody.rollingFriction,
            restitution: entity.rigidbody.restitution,
            type: entity.rigidbody.type,
            group: entity.rigidbody.group,
            mask: entity.rigidbody.mask
        };

        this.addComponent(clone, data);
    }

    onBeforeRemove(entity, component) {
        if (component.enabled) {
            component.enabled = false;
        }
    }

    onRemove(entity, data) {
        var body = data.body;
        if (body) {
            this.removeBody(body);
            this.destroyBody(body);

            data.body = null;
        }
    }

    addBody(body, group, mask) {
        if (group !== undefined && mask !== undefined) {
            this.dynamicsWorld.addRigidBody(body, group, mask);
        } else {
            this.dynamicsWorld.addRigidBody(body);
        }
    }

    removeBody(body) {
        this.dynamicsWorld.removeRigidBody(body);
    }

    createBody(mass, shape, transform) {
        var localInertia = new Ammo.btVector3(0, 0, 0);
        if (mass !== 0) {
            shape.calculateLocalInertia(mass, localInertia);
        }

        var motionState = new Ammo.btDefaultMotionState(transform);
        var bodyInfo = new Ammo.btRigidBodyConstructionInfo(mass, motionState, shape, localInertia);
        var body = new Ammo.btRigidBody(bodyInfo);
        Ammo.destroy(bodyInfo);
        Ammo.destroy(localInertia);

        return body;
    }

    destroyBody(body) {
        // The motion state needs to be destroyed explicitly (if present)
        var motionState = body.getMotionState();
        if (motionState) {
            Ammo.destroy(motionState);
        }
        Ammo.destroy(body);
    }

    /**
     * @function
     * @name RigidBodyComponentSystem#raycastFirst
     * @description Raycast the world and return the first entity the ray hits. Fire a ray into the world from start to end,
     * if the ray hits an entity with a collision component, it returns a {@link RaycastResult}, otherwise returns null.
     * @param {Vec3} start - The world space point where the ray starts.
     * @param {Vec3} end - The world space point where the ray ends.
     * @returns {RaycastResult} The result of the raycasting or null if there was no hit.
     */
    raycastFirst(start, end) {
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
                    new Vec3(point.x(), point.y(), point.z()),
                    new Vec3(normal.x(), normal.y(), normal.z())
                );

                // keeping for backwards compatibility
                if (arguments.length > 2) {
                    // #ifdef DEBUG
                    console.warn('DEPRECATED: pc.RigidBodyComponentSystem#rayCastFirst no longer requires a callback. The result of the raycast is returned by the function instead.');
                    // #endif

                    var callback = arguments[2];
                    callback(result);
                }
            }
        }

        Ammo.destroy(rayCallback);

        return result;
    }

    /**
     * @function
     * @name RigidBodyComponentSystem#raycastAll
     * @description Raycast the world and return all entities the ray hits. It returns an array
     * of {@link RaycastResult}, one for each hit. If no hits are detected, the returned
     * array will be of length 0.
     * @param {Vec3} start - The world space point where the ray starts.
     * @param {Vec3} end - The world space point where the ray ends.
     * @returns {RaycastResult[]} An array of raycast hit results (0 length if there were no hits).
     */
    raycastAll(start, end) {
        // #ifdef DEBUG
        if (!Ammo.AllHitsRayResultCallback) {
            console.error("pc.RigidBodyComponentSystem#raycastAll: Your version of ammo.js does not expose Ammo.AllHitsRayResultCallback. Update it to latest.");
        }
        // #endif

        var results = [];

        ammoRayStart.setValue(start.x, start.y, start.z);
        ammoRayEnd.setValue(end.x, end.y, end.z);
        var rayCallback = new Ammo.AllHitsRayResultCallback(ammoRayStart, ammoRayEnd);

        this.dynamicsWorld.rayTest(ammoRayStart, ammoRayEnd, rayCallback);
        if (rayCallback.hasHit()) {
            var collisionObjs = rayCallback.get_m_collisionObjects();
            var points = rayCallback.get_m_hitPointWorld();
            var normals = rayCallback.get_m_hitNormalWorld();

            var numHits = collisionObjs.size();
            for (var i = 0; i < numHits; i++) {
                var body = Ammo.castObject(collisionObjs.at(i), Ammo.btRigidBody);
                if (body) {
                    var point = points.at(i);
                    var normal = normals.at(i);
                    var result = new RaycastResult(
                        body.entity,
                        new Vec3(point.x(), point.y(), point.z()),
                        new Vec3(normal.x(), normal.y(), normal.z())
                    );
                    results.push(result);
                }
            }
        }

        Ammo.destroy(rayCallback);

        return results;
    }

    /**
     * @private
     * @function
     * @name RigidBodyComponentSystem#_storeCollision
     * @description Stores a collision between the entity and other in the contacts map and returns true if it is a new collision.
     * @param {Entity} entity - The entity.
     * @param {Entity} other - The entity that collides with the first entity.
     * @returns {boolean} True if this is a new collision, false otherwise.
     */
    _storeCollision(entity, other) {
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
    }

    _createContactPointFromAmmo(contactPoint) {
        var localPointA = contactPoint.get_m_localPointA();
        var localPointB = contactPoint.get_m_localPointB();
        var positionWorldOnA = contactPoint.getPositionWorldOnA();
        var positionWorldOnB = contactPoint.getPositionWorldOnB();
        var normalWorldOnB = contactPoint.get_m_normalWorldOnB();

        var contact = this.contactPointPool.allocate();
        contact.localPoint.set(localPointA.x(), localPointA.y(), localPointA.z());
        contact.localPointOther.set(localPointB.x(), localPointB.y(), localPointB.z());
        contact.point.set(positionWorldOnA.x(), positionWorldOnA.y(), positionWorldOnA.z());
        contact.pointOther.set(positionWorldOnB.x(), positionWorldOnB.y(), positionWorldOnB.z());
        contact.normal.set(normalWorldOnB.x(), normalWorldOnB.y(), normalWorldOnB.z());
        return contact;
    }

    _createReverseContactPointFromAmmo(contactPoint) {
        var localPointA = contactPoint.get_m_localPointA();
        var localPointB = contactPoint.get_m_localPointB();
        var positionWorldOnA = contactPoint.getPositionWorldOnA();
        var positionWorldOnB = contactPoint.getPositionWorldOnB();
        var normalWorldOnB = contactPoint.get_m_normalWorldOnB();

        var contact = this.contactPointPool.allocate();
        contact.localPointOther.set(localPointA.x(), localPointA.y(), localPointA.z());
        contact.localPoint.set(localPointB.x(), localPointB.y(), localPointB.z());
        contact.pointOther.set(positionWorldOnA.x(), positionWorldOnA.y(), positionWorldOnA.z());
        contact.point.set(positionWorldOnB.x(), positionWorldOnB.y(), positionWorldOnB.z());
        contact.normal.set(normalWorldOnB.x(), normalWorldOnB.y(), normalWorldOnB.z());
        return contact;
    }

    _createSingleContactResult(a, b, contactPoint) {
        var result = this.singleContactResultPool.allocate();

        result.a = a;
        result.b = b;
        result.localPointA = contactPoint.localPoint;
        result.localPointB = contactPoint.localPointOther;
        result.pointA = contactPoint.point;
        result.pointB = contactPoint.pointOther;
        result.normal = contactPoint.normal;

        return result;
    }

    _createContactResult(other, contacts) {
        var result = this.contactResultPool.allocate();
        result.other = other;
        result.contacts = contacts;
        return result;
    }

    /**
     * @private
     * @function
     * @name RigidBodyComponentSystem#_cleanOldCollisions
     * @description Removes collisions that no longer exist from the collisions list and fires collisionend events to the
     * related entities.
     */
    _cleanOldCollisions() {
        for (var guid in collisions) {
            if (collisions.hasOwnProperty(guid)) {
                var frameCollision = frameCollisions[guid];
                var collision = collisions[guid];
                var entity = collision.entity;
                var entityCollision = entity.collision;
                var entityRigidbody = entity.rigidbody;
                var others = collision.others;
                var length = others.length;
                var i = length;
                while (i--) {
                    var other = others[i];
                    // if the contact does not exist in the current frame collisions then fire event
                    if (!frameCollision || frameCollision.others.indexOf(other) < 0) {
                        // remove from others list
                        others.splice(i, 1);

                        if (entity.trigger) {
                            // handle a trigger entity
                            if (entityCollision) {
                                entityCollision.fire("triggerleave", other);
                            }
                            if (other.rigidbody) {
                                other.rigidbody.fire('triggerleave', entity);
                            }
                        } else if (!other.trigger) {
                            // suppress events if the other entity is a trigger
                            if (entityRigidbody) {
                                entityRigidbody.fire("collisionend", other);
                            }
                            if (entityCollision) {
                                entityCollision.fire("collisionend", other);
                            }
                        }
                    }
                }

                if (others.length === 0) {
                    delete collisions[guid];
                }
            }
        }
    }

    /**
     * @private
     * @function
     * @name RigidBodyComponentSystem#_hasContactEvent
     * @description Returns true if the entity has a contact event attached and false otherwise.
     * @param {object} entity - Entity to test.
     * @returns {boolean} True if the entity has a contact and false otherwise.
     */
    _hasContactEvent(entity) {
        var c = entity.collision;
        if (c && (c.hasEvent("collisionstart") || c.hasEvent("collisionend") || c.hasEvent("contact"))) {
            return true;
        }

        var r = entity.rigidbody;
        return r && (r.hasEvent("collisionstart") || r.hasEvent("collisionend") || r.hasEvent("contact"));
    }

    /**
     * @private
     * @function
     * @name RigidBodyComponentSystem#_checkForCollisions
     * @description Checks for collisions and fires collision events
     * @param {number} world - The pointer to the dynamics world that invoked this callback.
     * @param {number} timeStep - The amount of simulation time processed in the last simulation tick.
     */
    _checkForCollisions(world, timeStep) {
        var dynamicsWorld = Ammo.wrapPointer(world, Ammo.btDynamicsWorld);

        // Check for collisions and fire callbacks
        var dispatcher = dynamicsWorld.getDispatcher();
        var numManifolds = dispatcher.getNumManifolds();

        frameCollisions = {};

        // loop through the all contacts and fire events
        for (var i = 0; i < numManifolds; i++) {
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

            var flags0 = wb0.getCollisionFlags();
            var flags1 = wb1.getCollisionFlags();

            var numContacts = manifold.getNumContacts();
            var forwardContacts = [];
            var reverseContacts = [];
            var newCollision, e0Events, e1Events, e0BodyEvents, e1BodyEvents;

            if (numContacts > 0) {
                // don't fire contact events for triggers
                if ((flags0 & BODYFLAG_NORESPONSE_OBJECT) ||
                    (flags1 & BODYFLAG_NORESPONSE_OBJECT)) {

                    e0Events = e0.collision && (e0.collision.hasEvent("triggerenter") || e0.collision.hasEvent("triggerleave"));
                    e1Events = e1.collision && (e1.collision.hasEvent("triggerenter") || e1.collision.hasEvent("triggerleave"));
                    e0BodyEvents = e0.rigidbody && (e0.rigidbody.hasEvent("triggerenter") || e0.rigidbody.hasEvent("triggerleave"));
                    e1BodyEvents = e1.rigidbody && (e1.rigidbody.hasEvent("triggerenter") || e1.rigidbody.hasEvent("triggerleave"));

                    // fire triggerenter events for triggers
                    if (e0Events) {
                        newCollision = this._storeCollision(e0, e1);
                        if (newCollision && !(flags1 & BODYFLAG_NORESPONSE_OBJECT)) {
                            e0.collision.fire("triggerenter", e1);
                        }
                    }

                    if (e1Events) {
                        newCollision = this._storeCollision(e1, e0);
                        if (newCollision && !(flags0 & BODYFLAG_NORESPONSE_OBJECT)) {
                            e1.collision.fire("triggerenter", e0);
                        }
                    }

                    // fire triggerenter events for rigidbodies
                    if (e0BodyEvents) {
                        if (! newCollision) {
                            newCollision = this._storeCollision(e1, e0);
                        }

                        if (newCollision) {
                            e0.rigidbody.fire("triggerenter", e1);
                        }
                    }

                    if (e1BodyEvents) {
                        if (! newCollision) {
                            newCollision = this._storeCollision(e0, e1);
                        }

                        if (newCollision) {
                            e1.rigidbody.fire("triggerenter", e0);
                        }
                    }
                } else {
                    e0Events = this._hasContactEvent(e0);
                    e1Events = this._hasContactEvent(e1);
                    var globalEvents = this.hasEvent("contact");

                    if (globalEvents || e0Events || e1Events) {
                        for (var j = 0; j < numContacts; j++) {
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
                            newCollision = this._storeCollision(e0, e1);

                            if (e0.collision) {
                                e0.collision.fire("contact", forwardResult);
                                if (newCollision) {
                                    e0.collision.fire("collisionstart", forwardResult);
                                }
                            }

                            if (e0.rigidbody) {
                                e0.rigidbody.fire("contact", forwardResult);
                                if (newCollision) {
                                    e0.rigidbody.fire("collisionstart", forwardResult);
                                }
                            }
                        }

                        if (e1Events) {
                            var reverseResult = this._createContactResult(e0, reverseContacts);
                            newCollision = this._storeCollision(e1, e0);

                            if (e1.collision) {
                                e1.collision.fire("contact", reverseResult);
                                if (newCollision) {
                                    e1.collision.fire("collisionstart", reverseResult);
                                }
                            }

                            if (e1.rigidbody) {
                                e1.rigidbody.fire("contact", reverseResult);
                                if (newCollision) {
                                    e1.rigidbody.fire("collisionstart", reverseResult);
                                }
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
    }

    onUpdate(dt) {
        var i, len;

        // #ifdef PROFILER
        this._stats.physicsStart = now();
        // #endif

        // Check to see whether we need to update gravity on the dynamics world
        var gravity = this.dynamicsWorld.getGravity();
        if (gravity.x() !== this.gravity.x || gravity.y() !== this.gravity.y || gravity.z() !== this.gravity.z) {
            gravity.setValue(this.gravity.x, this.gravity.y, this.gravity.z);
            this.dynamicsWorld.setGravity(gravity);
        }

        var triggers = this._triggers;
        for (i = 0, len = triggers.length; i < len; i++) {
            triggers[i].updateTransform();
        }

        var compounds = this._compounds;
        for (i = 0, len = compounds.length; i < len; i++) {
            compounds[i]._updateCompound();
        }

        // Update all kinematic bodies based on their current entity transform
        var kinematic = this._kinematic;
        for (i = 0, len = kinematic.length; i < len; i++) {
            kinematic[i]._updateKinematic();
        }

        // Step the physics simulation
        this.dynamicsWorld.stepSimulation(dt, this.maxSubSteps, this.fixedTimeStep);

        // Update the transforms of all entities referencing a dynamic body
        var dynamic = this._dynamic;
        for (i = 0, len = dynamic.length; i < len; i++) {
            dynamic[i]._updateDynamic();
        }

        if (!this.dynamicsWorld.setInternalTickCallback)
            this._checkForCollisions(Ammo.getPointer(this.dynamicsWorld), dt);

        // #ifdef PROFILER
        this._stats.physicsTime = now() - this._stats.physicsStart;
        // #endif
    }

    destroy() {
        if (typeof Ammo !== 'undefined') {
            Ammo.destroy(this.dynamicsWorld);
            Ammo.destroy(this.solver);
            Ammo.destroy(this.overlappingPairCache);
            Ammo.destroy(this.dispatcher);
            Ammo.destroy(this.collisionConfiguration);
            this.dynamicsWorld = null;
            this.solver = null;
            this.overlappingPairCache = null;
            this.dispatcher = null;
            this.collisionConfiguration = null;
        }
    }
}

Component._buildAccessors(RigidBodyComponent.prototype, _schema);

export { ContactPoint, ContactResult, RaycastResult, RigidBodyComponentSystem, SingleContactResult };
