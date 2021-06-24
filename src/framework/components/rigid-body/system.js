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
 * @property {Entity} entity The entity that was hit.
 * @property {Vec3} point The point at which the ray hit the entity in world space.
 * @property {Vec3} normal The normal vector of the surface where the ray hit in world space.
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
 * @property {Entity} a The first entity involved in the contact.
 * @property {Entity} b The second entity involved in the contact.
 * @property {Vec3} localPointA The point on Entity A where the contact occurred, relative to A.
 * @property {Vec3} localPointB The point on Entity B where the contact occurred, relative to B.
 * @property {Vec3} pointA The point on Entity A where the contact occurred, in world space.
 * @property {Vec3} pointB The point on Entity B where the contact occurred, in world space.
 * @property {Vec3} normal The normal vector of the contact on Entity B, in world space.
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
 * @param {Vec3} [localPoint] - The point on the entity where the contact occurred, relative to the entity.
 * @param {Vec3} [localPointOther] - The point on the other entity where the contact occurred, relative to the other entity.
 * @param {Vec3} [point] - The point on the entity where the contact occurred, in world space.
 * @param {Vec3} [pointOther] - The point on the other entity where the contact occurred, in world space.
 * @param {Vec3} [normal] - The normal vector of the contact on the other entity, in world space.
 * @property {Vec3} localPoint The point on the entity where the contact occurred, relative to the entity.
 * @property {Vec3} localPointOther The point on the other entity where the contact occurred, relative to the other entity.
 * @property {Vec3} point The point on the entity where the contact occurred, in world space.
 * @property {Vec3} pointOther The point on the other entity where the contact occurred, in world space.
 * @property {Vec3} normal The normal vector of the contact on the other entity, in world space.
 */
class ContactPoint {
    constructor(localPoint = new Vec3(), localPointOther = new Vec3(), point = new Vec3(), pointOther = new Vec3(), normal = new Vec3()) {
        this.localPoint = localPoint;
        this.localPointOther = localPointOther;
        this.point = point;
        this.pointOther = pointOther;
        this.normal = normal;
    }
}

/**
 * @class
 * @name ContactResult
 * @classdesc Object holding the result of a contact between two Entities.
 * @description Create a new ContactResult.
 * @param {Entity} other - The entity that was involved in the contact with this entity.
 * @param {ContactPoint[]} contacts - An array of ContactPoints with the other entity.
 * @property {Entity} other The entity that was involved in the contact with this entity.
 * @property {ContactPoint[]} contacts An array of ContactPoints with the other entity.
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

const _schema = ['enabled'];

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
 * @property {Vec3} gravity The world space vector representing global gravity in the physics simulation.
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
                const checkForCollisionsPointer = Ammo.addFunction(this._checkForCollisions.bind(this), 'vif');
                this.dynamicsWorld.setInternalTickCallback(checkForCollisionsPointer);
            } else {
                // #if _DEBUG
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

    initializeComponentData(component, data, properties) {
        const props = [
            'mass',
            'linearDamping',
            'angularDamping',
            'linearFactor',
            'angularFactor',
            'friction',
            'rollingFriction',
            'restitution',
            'type',
            'group',
            'mask'
        ];

        for (const property of props) {
            if (data.hasOwnProperty(property)) {
                const value = data[property];
                if (Array.isArray(value)) {
                    component[property] = new Vec3(value[0], value[1], value[2]);
                } else {
                    component[property] = value;
                }
            }
        }

        super.initializeComponentData(component, data, ['enabled']);
    }

    cloneComponent(entity, clone) {
        // create new data block for clone
        const rigidbody = entity.rigidbody;
        const data = {
            enabled: rigidbody.enabled,
            mass: rigidbody.mass,
            linearDamping: rigidbody.linearDamping,
            angularDamping: rigidbody.angularDamping,
            linearFactor: [rigidbody.linearFactor.x, rigidbody.linearFactor.y, rigidbody.linearFactor.z],
            angularFactor: [rigidbody.angularFactor.x, rigidbody.angularFactor.y, rigidbody.angularFactor.z],
            friction: rigidbody.friction,
            rollingFriction: rigidbody.rollingFriction,
            restitution: rigidbody.restitution,
            type: rigidbody.type,
            group: rigidbody.group,
            mask: rigidbody.mask
        };

        this.addComponent(clone, data);
    }

    onBeforeRemove(entity, component) {
        if (component.enabled) {
            component.enabled = false;
        }
    }

    onRemove(entity, component) {
        const body = component.body;
        if (body) {
            this.removeBody(body);
            this.destroyBody(body);

            component.body = null;
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
        const localInertia = new Ammo.btVector3(0, 0, 0);
        if (mass !== 0) {
            shape.calculateLocalInertia(mass, localInertia);
        }

        const motionState = new Ammo.btDefaultMotionState(transform);
        const bodyInfo = new Ammo.btRigidBodyConstructionInfo(mass, motionState, shape, localInertia);
        const body = new Ammo.btRigidBody(bodyInfo);
        Ammo.destroy(bodyInfo);
        Ammo.destroy(localInertia);

        return body;
    }

    destroyBody(body) {
        // The motion state needs to be destroyed explicitly (if present)
        const motionState = body.getMotionState();
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
        let result = null;

        ammoRayStart.setValue(start.x, start.y, start.z);
        ammoRayEnd.setValue(end.x, end.y, end.z);
        const rayCallback = new Ammo.ClosestRayResultCallback(ammoRayStart, ammoRayEnd);

        this.dynamicsWorld.rayTest(ammoRayStart, ammoRayEnd, rayCallback);
        if (rayCallback.hasHit()) {
            const collisionObj = rayCallback.get_m_collisionObject();
            const body = Ammo.castObject(collisionObj, Ammo.btRigidBody);
            if (body) {
                const point = rayCallback.get_m_hitPointWorld();
                const normal = rayCallback.get_m_hitNormalWorld();

                result = new RaycastResult(
                    body.entity,
                    new Vec3(point.x(), point.y(), point.z()),
                    new Vec3(normal.x(), normal.y(), normal.z())
                );

                // keeping for backwards compatibility
                if (arguments.length > 2) {
                    // #if _DEBUG
                    console.warn('DEPRECATED: pc.RigidBodyComponentSystem#rayCastFirst no longer requires a callback. The result of the raycast is returned by the function instead.');
                    // #endif

                    const callback = arguments[2];
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
        // #if _DEBUG
        if (!Ammo.AllHitsRayResultCallback) {
            console.error("pc.RigidBodyComponentSystem#raycastAll: Your version of ammo.js does not expose Ammo.AllHitsRayResultCallback. Update it to latest.");
        }
        // #endif

        const results = [];

        ammoRayStart.setValue(start.x, start.y, start.z);
        ammoRayEnd.setValue(end.x, end.y, end.z);
        const rayCallback = new Ammo.AllHitsRayResultCallback(ammoRayStart, ammoRayEnd);

        this.dynamicsWorld.rayTest(ammoRayStart, ammoRayEnd, rayCallback);
        if (rayCallback.hasHit()) {
            const collisionObjs = rayCallback.get_m_collisionObjects();
            const points = rayCallback.get_m_hitPointWorld();
            const normals = rayCallback.get_m_hitNormalWorld();

            const numHits = collisionObjs.size();
            for (let i = 0; i < numHits; i++) {
                const body = Ammo.castObject(collisionObjs.at(i), Ammo.btRigidBody);
                if (body) {
                    const point = points.at(i);
                    const normal = normals.at(i);
                    const result = new RaycastResult(
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
        let isNewCollision = false;
        const guid = entity.getGuid();

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
        const localPointA = contactPoint.get_m_localPointA();
        const localPointB = contactPoint.get_m_localPointB();
        const positionWorldOnA = contactPoint.getPositionWorldOnA();
        const positionWorldOnB = contactPoint.getPositionWorldOnB();
        const normalWorldOnB = contactPoint.get_m_normalWorldOnB();

        const contact = this.contactPointPool.allocate();
        contact.localPoint.set(localPointA.x(), localPointA.y(), localPointA.z());
        contact.localPointOther.set(localPointB.x(), localPointB.y(), localPointB.z());
        contact.point.set(positionWorldOnA.x(), positionWorldOnA.y(), positionWorldOnA.z());
        contact.pointOther.set(positionWorldOnB.x(), positionWorldOnB.y(), positionWorldOnB.z());
        contact.normal.set(normalWorldOnB.x(), normalWorldOnB.y(), normalWorldOnB.z());
        return contact;
    }

    _createReverseContactPointFromAmmo(contactPoint) {
        const localPointA = contactPoint.get_m_localPointA();
        const localPointB = contactPoint.get_m_localPointB();
        const positionWorldOnA = contactPoint.getPositionWorldOnA();
        const positionWorldOnB = contactPoint.getPositionWorldOnB();
        const normalWorldOnB = contactPoint.get_m_normalWorldOnB();

        const contact = this.contactPointPool.allocate();
        contact.localPointOther.set(localPointA.x(), localPointA.y(), localPointA.z());
        contact.localPoint.set(localPointB.x(), localPointB.y(), localPointB.z());
        contact.pointOther.set(positionWorldOnA.x(), positionWorldOnA.y(), positionWorldOnA.z());
        contact.point.set(positionWorldOnB.x(), positionWorldOnB.y(), positionWorldOnB.z());
        contact.normal.set(normalWorldOnB.x(), normalWorldOnB.y(), normalWorldOnB.z());
        return contact;
    }

    _createSingleContactResult(a, b, contactPoint) {
        const result = this.singleContactResultPool.allocate();

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
        const result = this.contactResultPool.allocate();
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
        for (const guid in collisions) {
            if (collisions.hasOwnProperty(guid)) {
                const frameCollision = frameCollisions[guid];
                const collision = collisions[guid];
                const entity = collision.entity;
                const entityCollision = entity.collision;
                const entityRigidbody = entity.rigidbody;
                const others = collision.others;
                const length = others.length;
                let i = length;
                while (i--) {
                    const other = others[i];
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
        const c = entity.collision;
        if (c && (c.hasEvent("collisionstart") || c.hasEvent("collisionend") || c.hasEvent("contact"))) {
            return true;
        }

        const r = entity.rigidbody;
        return r && (r.hasEvent("collisionstart") || r.hasEvent("collisionend") || r.hasEvent("contact"));
    }

    /**
     * @private
     * @function
     * @name RigidBodyComponentSystem#_checkForCollisions
     * @description Checks for collisions and fires collision events.
     * @param {number} world - The pointer to the dynamics world that invoked this callback.
     * @param {number} timeStep - The amount of simulation time processed in the last simulation tick.
     */
    _checkForCollisions(world, timeStep) {
        const dynamicsWorld = Ammo.wrapPointer(world, Ammo.btDynamicsWorld);

        // Check for collisions and fire callbacks
        const dispatcher = dynamicsWorld.getDispatcher();
        const numManifolds = dispatcher.getNumManifolds();

        frameCollisions = {};

        // loop through the all contacts and fire events
        for (let i = 0; i < numManifolds; i++) {
            const manifold = dispatcher.getManifoldByIndexInternal(i);

            const body0 = manifold.getBody0();
            const body1 = manifold.getBody1();

            const wb0 = Ammo.castObject(body0, Ammo.btRigidBody);
            const wb1 = Ammo.castObject(body1, Ammo.btRigidBody);

            const e0 = wb0.entity;
            const e1 = wb1.entity;

            // check if entity is null - TODO: investigate when this happens
            if (!e0 || !e1) {
                continue;
            }

            const flags0 = wb0.getCollisionFlags();
            const flags1 = wb1.getCollisionFlags();

            const numContacts = manifold.getNumContacts();
            const forwardContacts = [];
            const reverseContacts = [];
            let newCollision;

            if (numContacts > 0) {
                // don't fire contact events for triggers
                if ((flags0 & BODYFLAG_NORESPONSE_OBJECT) ||
                    (flags1 & BODYFLAG_NORESPONSE_OBJECT)) {

                    const e0Events = e0.collision && (e0.collision.hasEvent("triggerenter") || e0.collision.hasEvent("triggerleave"));
                    const e1Events = e1.collision && (e1.collision.hasEvent("triggerenter") || e1.collision.hasEvent("triggerleave"));
                    const e0BodyEvents = e0.rigidbody && (e0.rigidbody.hasEvent("triggerenter") || e0.rigidbody.hasEvent("triggerleave"));
                    const e1BodyEvents = e1.rigidbody && (e1.rigidbody.hasEvent("triggerenter") || e1.rigidbody.hasEvent("triggerleave"));

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
                    const e0Events = this._hasContactEvent(e0);
                    const e1Events = this._hasContactEvent(e1);
                    const globalEvents = this.hasEvent("contact");

                    if (globalEvents || e0Events || e1Events) {
                        for (let j = 0; j < numContacts; j++) {
                            const btContactPoint = manifold.getContactPoint(j);
                            const contactPoint = this._createContactPointFromAmmo(btContactPoint);

                            if (e0Events || e1Events) {
                                forwardContacts.push(contactPoint);
                                const reverseContactPoint = this._createReverseContactPointFromAmmo(btContactPoint);
                                reverseContacts.push(reverseContactPoint);
                            }

                            if (globalEvents) {
                                // fire global contact event for every contact
                                const result = this._createSingleContactResult(e0, e1, contactPoint);
                                this.fire("contact", result);
                            }
                        }

                        if (e0Events) {
                            const forwardResult = this._createContactResult(e1, forwardContacts);
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
                            const reverseResult = this._createContactResult(e0, reverseContacts);
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
        let i, len;

        // #if _PROFILER
        this._stats.physicsStart = now();
        // #endif

        // Check to see whether we need to update gravity on the dynamics world
        const gravity = this.dynamicsWorld.getGravity();
        if (gravity.x() !== this.gravity.x || gravity.y() !== this.gravity.y || gravity.z() !== this.gravity.z) {
            gravity.setValue(this.gravity.x, this.gravity.y, this.gravity.z);
            this.dynamicsWorld.setGravity(gravity);
        }

        const triggers = this._triggers;
        for (i = 0, len = triggers.length; i < len; i++) {
            triggers[i].updateTransform();
        }

        const compounds = this._compounds;
        for (i = 0, len = compounds.length; i < len; i++) {
            compounds[i]._updateCompound();
        }

        // Update all kinematic bodies based on their current entity transform
        const kinematic = this._kinematic;
        for (i = 0, len = kinematic.length; i < len; i++) {
            kinematic[i]._updateKinematic();
        }

        // Step the physics simulation
        this.dynamicsWorld.stepSimulation(dt, this.maxSubSteps, this.fixedTimeStep);

        // Update the transforms of all entities referencing a dynamic body
        const dynamic = this._dynamic;
        for (i = 0, len = dynamic.length; i < len; i++) {
            dynamic[i]._updateDynamic();
        }

        if (!this.dynamicsWorld.setInternalTickCallback)
            this._checkForCollisions(Ammo.getPointer(this.dynamicsWorld), dt);

        // #if _PROFILER
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
