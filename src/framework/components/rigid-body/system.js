import { now } from '../../../core/time.js';
import { ObjectPool } from '../../../core/object-pool.js';
import { Debug } from '../../../core/debug.js';

import { Vec3 } from '../../../core/math/vec3.js';

import { Component } from '../component.js';
import { ComponentSystem } from '../system.js';

import { BODYFLAG_NORESPONSE_OBJECT } from './constants.js';
import { RigidBodyComponent } from './component.js';
import { RigidBodyComponentData } from './data.js';

let ammoRayStart, ammoRayEnd;

/**
 * Object holding the result of a successful raycast hit.
 *
 * @category Physics
 */
class RaycastResult {
    /**
     * Create a new RaycastResult instance.
     *
     * @param {import('../../entity.js').Entity} entity - The entity that was hit.
     * @param {Vec3} point - The point at which the ray hit the entity in world space.
     * @param {Vec3} normal - The normal vector of the surface where the ray hit in world space.
     * @param {number} hitFraction - The normalized distance (between 0 and 1) at which the ray hit
     * occurred from the starting point.
     * @hideconstructor
     */
    constructor(entity, point, normal, hitFraction) {
        /**
         * The entity that was hit.
         *
         * @type {import('../../entity.js').Entity}
         */
        this.entity = entity;

        /**
         * The point at which the ray hit the entity in world space.
         *
         * @type {Vec3}
         */
        this.point = point;

        /**
         * The normal vector of the surface where the ray hit in world space.
         *
         * @type {Vec3}
         */
        this.normal = normal;

        /**
         * The normalized distance (between 0 and 1) at which the ray hit occurred from the
         * starting point.
         *
         * @type {number}
         */
        this.hitFraction = hitFraction;
    }
}

/**
 * Object holding the result of a contact between two rigid bodies.
 *
 * @category Physics
 */
class SingleContactResult {
    /**
     * Create a new SingleContactResult instance.
     *
     * @param {import('../../entity.js').Entity} a - The first entity involved in the contact.
     * @param {import('../../entity.js').Entity} b - The second entity involved in the contact.
     * @param {ContactPoint} contactPoint - The contact point between the two entities.
     * @hideconstructor
     */
    constructor(a, b, contactPoint) {
        if (arguments.length === 0) {
            /**
             * The first entity involved in the contact.
             *
             * @type {import('../../entity.js').Entity}
             */
            this.a = null;

            /**
             * The second entity involved in the contact.
             *
             * @type {import('../../entity.js').Entity}
             */
            this.b = null;

            /**
             * The total accumulated impulse applied by the constraint solver during the last
             * sub-step. Describes how hard two bodies collided.
             *
             * @type {number}
             */
            this.impulse = 0;

            /**
             * The point on Entity A where the contact occurred, relative to A.
             *
             * @type {Vec3}
             */
            this.localPointA = new Vec3();

            /**
             * The point on Entity B where the contact occurred, relative to B.
             *
             * @type {Vec3}
             */
            this.localPointB = new Vec3();

            /**
             * The point on Entity A where the contact occurred, in world space.
             *
             * @type {Vec3}
             */
            this.pointA = new Vec3();

            /**
             * The point on Entity B where the contact occurred, in world space.
             *
             * @type {Vec3}
             */
            this.pointB = new Vec3();

            /**
             * The normal vector of the contact on Entity B, in world space.
             *
             * @type {Vec3}
             */
            this.normal = new Vec3();
        } else {
            this.a = a;
            this.b = b;
            this.impulse = contactPoint.impulse;
            this.localPointA = contactPoint.localPoint;
            this.localPointB = contactPoint.localPointOther;
            this.pointA = contactPoint.point;
            this.pointB = contactPoint.pointOther;
            this.normal = contactPoint.normal;
        }
    }
}

/**
 * Object holding the result of a contact between two Entities.
 *
 * @category Physics
 */
class ContactPoint {
    /**
     * Create a new ContactPoint instance.
     *
     * @param {Vec3} [localPoint] - The point on the entity where the contact occurred, relative to
     * the entity.
     * @param {Vec3} [localPointOther] - The point on the other entity where the contact occurred,
     * relative to the other entity.
     * @param {Vec3} [point] - The point on the entity where the contact occurred, in world space.
     * @param {Vec3} [pointOther] - The point on the other entity where the contact occurred, in
     * world space.
     * @param {Vec3} [normal] - The normal vector of the contact on the other entity, in world
     * space.
     * @param {number} [impulse] - The total accumulated impulse applied by the constraint solver
     * during the last sub-step. Describes how hard two objects collide. Defaults to 0.
     * @hideconstructor
     */
    constructor(localPoint = new Vec3(), localPointOther = new Vec3(), point = new Vec3(), pointOther = new Vec3(), normal = new Vec3(), impulse = 0) {
        /**
         * The point on the entity where the contact occurred, relative to the entity.
         *
         * @type {Vec3}
         */
        this.localPoint = localPoint;

        /**
         * The point on the other entity where the contact occurred, relative to the other entity.
         *
         * @type {Vec3}
         */
        this.localPointOther = localPointOther;

        /**
         * The point on the entity where the contact occurred, in world space.
         *
         * @type {Vec3}
         */
        this.point = point;

        /**
         * The point on the other entity where the contact occurred, in world space.
         *
         * @type {Vec3}
         */
        this.pointOther = pointOther;

        /**
         * The normal vector of the contact on the other entity, in world space.
         *
         * @type {Vec3}
         */
        this.normal = normal;

        /**
         * The total accumulated impulse applied by the constraint solver during the last sub-step.
         * Describes how hard two objects collide.
         *
         * @type {number}
         */
        this.impulse = impulse;
    }
}

/**
 * Object holding the result of a contact between two Entities.
 *
 * @category Physics
 */
class ContactResult {
    /**
     * Create a new ContactResult instance.
     *
     * @param {import('../../entity.js').Entity} other - The entity that was involved in the
     * contact with this entity.
     * @param {ContactPoint[]} contacts - An array of ContactPoints with the other entity.
     * @hideconstructor
     */
    constructor(other, contacts) {
        /**
         * The entity that was involved in the contact with this entity.
         *
         * @type {import('../../entity.js').Entity}
         */
        this.other = other;

        /**
         * An array of ContactPoints with the other entity.
         *
         * @type {ContactPoint[]}
         */
        this.contacts = contacts;
    }
}

const _schema = ['enabled'];

/**
 * The RigidBodyComponentSystem maintains the dynamics world for simulating rigid bodies, it also
 * controls global values for the world such as gravity. Note: The RigidBodyComponentSystem is only
 * valid if 3D Physics is enabled in your application. You can enable this in the application
 * settings for your project.
 *
 * @augments ComponentSystem
 * @category Physics
 */
class RigidBodyComponentSystem extends ComponentSystem {
    /**
     * Fired when a contact occurs between two rigid bodies. The handler is passed a
     * {@link SingleContactResult} object containing details of the contact between the two bodies.
     *
     * @event
     * @example
     * app.systems.rigidbody.on('contact', (result) => {
     *     console.log(`Contact between ${result.a.name} and ${result.b.name}`);
     * });
     */
    static EVENT_CONTACT = 'contact';

    /**
     * @type {number}
     * @ignore
     */
    maxSubSteps = 10;

    /**
     * @type {number}
     * @ignore
     */
    fixedTimeStep = 1 / 60;

    /**
     * The world space vector representing global gravity in the physics simulation. Defaults to
     * [0, -9.81, 0] which is an approximation of the gravitational force on Earth.
     *
     * @type {Vec3}
     */
    gravity = new Vec3(0, -9.81, 0);

    /**
     * @type {Float32Array}
     * @private
     */
    _gravityFloat32 = new Float32Array(3);

    /**
     * @type {RigidBodyComponent[]}
     * @private
     */
    _dynamic = [];

    /**
     * @type {RigidBodyComponent[]}
     * @private
     */
    _kinematic = [];

    /**
     * @type {RigidBodyComponent[]}
     * @private
     */
    _triggers = [];

    /**
     * @type {RigidBodyComponent[]}
     * @private
     */
    _compounds = [];

    /**
     * Create a new RigidBodyComponentSystem.
     *
     * @param {import('../../app-base.js').AppBase} app - The Application.
     * @hideconstructor
     */
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

        this.collisions = {};
        this.frameCollisions = {};

        this.on('beforeremove', this.onBeforeRemove, this);
    }

    /**
     * Called once Ammo has been loaded. Responsible for creating the physics world.
     *
     * @ignore
     */
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
                Debug.warn('WARNING: This version of ammo.js can potentially fail to report contacts. Please update it to the latest version.');
            }

            // Lazily create temp vars
            ammoRayStart = new Ammo.btVector3();
            ammoRayEnd = new Ammo.btVector3();
            RigidBodyComponent.onLibraryLoaded();

            this.contactPointPool = new ObjectPool(ContactPoint, 1);
            this.contactResultPool = new ObjectPool(ContactResult, 1);
            this.singleContactResultPool = new ObjectPool(SingleContactResult, 1);

            this.app.systems.on('update', this.onUpdate, this);
        } else {
            // Unbind the update function if we haven't loaded Ammo by now
            this.app.systems.off('update', this.onUpdate, this);
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

        return this.addComponent(clone, data);
    }

    onBeforeRemove(entity, component) {
        if (component.enabled) {
            component.enabled = false;
        }

        if (component.body) {
            this.destroyBody(component.body);
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
     * Raycast the world and return the first entity the ray hits. Fire a ray into the world from
     * start to end, if the ray hits an entity with a collision component, it returns a
     * {@link RaycastResult}, otherwise returns null.
     *
     * @param {Vec3} start - The world space point where the ray starts.
     * @param {Vec3} end - The world space point where the ray ends.
     * @param {object} [options] - The additional options for the raycasting.
     * @param {number} [options.filterCollisionGroup] - Collision group to apply to the raycast.
     * @param {number} [options.filterCollisionMask] - Collision mask to apply to the raycast.
     * @param {any[]} [options.filterTags] - Tags filters. Defined the same way as a {@link Tags#has}
     * query but within an array.
     * @param {Function} [options.filterCallback] - Custom function to use to filter entities.
     * Must return true to proceed with result. Takes one argument: the entity to evaluate.
     *
     * @returns {RaycastResult|null} The result of the raycasting or null if there was no hit.
     */
    raycastFirst(start, end, options = {}) {
        // Tags and custom callback can only be performed by looking at all results.
        if (options.filterTags || options.filterCallback) {
            options.sort = true;
            return this.raycastAll(start, end, options)[0] || null;
        }

        let result = null;

        ammoRayStart.setValue(start.x, start.y, start.z);
        ammoRayEnd.setValue(end.x, end.y, end.z);
        const rayCallback = new Ammo.ClosestRayResultCallback(ammoRayStart, ammoRayEnd);

        if (typeof options.filterCollisionGroup === 'number') {
            rayCallback.set_m_collisionFilterGroup(options.filterCollisionGroup);
        }

        if (typeof options.filterCollisionMask === 'number') {
            rayCallback.set_m_collisionFilterMask(options.filterCollisionMask);
        }

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
                    new Vec3(normal.x(), normal.y(), normal.z()),
                    rayCallback.get_m_closestHitFraction()
                );
            }
        }

        Ammo.destroy(rayCallback);

        return result;
    }

    /**
     * Raycast the world and return all entities the ray hits. It returns an array of
     * {@link RaycastResult}, one for each hit. If no hits are detected, the returned array will be
     * of length 0. Results are sorted by distance with closest first.
     *
     * @param {Vec3} start - The world space point where the ray starts.
     * @param {Vec3} end - The world space point where the ray ends.
     * @param {object} [options] - The additional options for the raycasting.
     * @param {boolean} [options.sort] - Whether to sort raycast results based on distance with closest
     * first. Defaults to false.
     * @param {number} [options.filterCollisionGroup] - Collision group to apply to the raycast.
     * @param {number} [options.filterCollisionMask] - Collision mask to apply to the raycast.
     * @param {any[]} [options.filterTags] - Tags filters. Defined the same way as a {@link Tags#has}
     * query but within an array.
     * @param {Function} [options.filterCallback] - Custom function to use to filter entities.
     * Must return true to proceed with result. Takes the entity to evaluate as argument.
     *
     * @returns {RaycastResult[]} An array of raycast hit results (0 length if there were no hits).
     *
     * @example
     * // Return all results of a raycast between 0, 2, 2 and 0, -2, -2
     * const hits = this.app.systems.rigidbody.raycastAll(new Vec3(0, 2, 2), new Vec3(0, -2, -2));
     * @example
     * // Return all results of a raycast between 0, 2, 2 and 0, -2, -2
     * // where hit entity is tagged with `bird` OR `mammal`
     * const hits = this.app.systems.rigidbody.raycastAll(new Vec3(0, 2, 2), new Vec3(0, -2, -2), {
     *     filterTags: [ "bird", "mammal" ]
     * });
     * @example
     * // Return all results of a raycast between 0, 2, 2 and 0, -2, -2
     * // where hit entity has a `camera` component
     * const hits = this.app.systems.rigidbody.raycastAll(new Vec3(0, 2, 2), new Vec3(0, -2, -2), {
     *     filterCallback: (entity) => entity && entity.camera
     * });
     * @example
     * // Return all results of a raycast between 0, 2, 2 and 0, -2, -2
     * // where hit entity is tagged with (`carnivore` AND `mammal`) OR (`carnivore` AND `reptile`)
     * // and the entity has an `anim` component
     * const hits = this.app.systems.rigidbody.raycastAll(new Vec3(0, 2, 2), new Vec3(0, -2, -2), {
     *     filterTags: [
     *         [ "carnivore", "mammal" ],
     *         [ "carnivore", "reptile" ]
     *     ],
     *     filterCallback: (entity) => entity && entity.anim
     * });
     */
    raycastAll(start, end, options = {}) {
        Debug.assert(Ammo.AllHitsRayResultCallback, 'pc.RigidBodyComponentSystem#raycastAll: Your version of ammo.js does not expose Ammo.AllHitsRayResultCallback. Update it to latest.');

        const results = [];

        ammoRayStart.setValue(start.x, start.y, start.z);
        ammoRayEnd.setValue(end.x, end.y, end.z);
        const rayCallback = new Ammo.AllHitsRayResultCallback(ammoRayStart, ammoRayEnd);

        if (typeof options.filterCollisionGroup === 'number') {
            rayCallback.set_m_collisionFilterGroup(options.filterCollisionGroup);
        }

        if (typeof options.filterCollisionMask === 'number') {
            rayCallback.set_m_collisionFilterMask(options.filterCollisionMask);
        }

        this.dynamicsWorld.rayTest(ammoRayStart, ammoRayEnd, rayCallback);
        if (rayCallback.hasHit()) {
            const collisionObjs = rayCallback.get_m_collisionObjects();
            const points = rayCallback.get_m_hitPointWorld();
            const normals = rayCallback.get_m_hitNormalWorld();
            const hitFractions = rayCallback.get_m_hitFractions();

            const numHits = collisionObjs.size();
            for (let i = 0; i < numHits; i++) {
                const body = Ammo.castObject(collisionObjs.at(i), Ammo.btRigidBody);

                if (body && body.entity) {
                    if (options.filterTags && !body.entity.tags.has(...options.filterTags) || options.filterCallback && !options.filterCallback(body.entity)) {
                        continue;
                    }

                    const point = points.at(i);
                    const normal = normals.at(i);
                    const result = new RaycastResult(
                        body.entity,
                        new Vec3(point.x(), point.y(), point.z()),
                        new Vec3(normal.x(), normal.y(), normal.z()),
                        hitFractions.at(i)
                    );

                    results.push(result);
                }
            }

            if (options.sort) {
                results.sort((a, b) => a.hitFraction - b.hitFraction);
            }
        }

        Ammo.destroy(rayCallback);

        return results;
    }

    /**
     * Stores a collision between the entity and other in the contacts map and returns true if it
     * is a new collision.
     *
     * @param {import('../../entity.js').Entity} entity - The entity.
     * @param {import('../../entity.js').Entity} other - The entity that collides with the first
     * entity.
     * @returns {boolean} True if this is a new collision, false otherwise.
     * @private
     */
    _storeCollision(entity, other) {
        let isNewCollision = false;
        const guid = entity.getGuid();

        this.collisions[guid] = this.collisions[guid] || { others: [], entity: entity };

        if (this.collisions[guid].others.indexOf(other) < 0) {
            this.collisions[guid].others.push(other);
            isNewCollision = true;
        }

        this.frameCollisions[guid] = this.frameCollisions[guid] || { others: [], entity: entity };
        this.frameCollisions[guid].others.push(other);

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
        contact.impulse = contactPoint.getAppliedImpulse();
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
        contact.impulse = contactPoint.getAppliedImpulse();
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
        result.impulse = contactPoint.impulse;

        return result;
    }

    _createContactResult(other, contacts) {
        const result = this.contactResultPool.allocate();
        result.other = other;
        result.contacts = contacts;
        return result;
    }

    /**
     * Removes collisions that no longer exist from the collisions list and fires collisionend
     * events to the related entities.
     *
     * @private
     */
    _cleanOldCollisions() {
        for (const guid in this.collisions) {
            if (this.collisions.hasOwnProperty(guid)) {
                const frameCollision = this.frameCollisions[guid];
                const collision = this.collisions[guid];
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
                                entityCollision.fire('triggerleave', other);
                            }
                            if (other.rigidbody) {
                                other.rigidbody.fire('triggerleave', entity);
                            }
                        } else if (!other.trigger) {
                            // suppress events if the other entity is a trigger
                            if (entityRigidbody) {
                                entityRigidbody.fire('collisionend', other);
                            }
                            if (entityCollision) {
                                entityCollision.fire('collisionend', other);
                            }
                        }
                    }
                }

                if (others.length === 0) {
                    delete this.collisions[guid];
                }
            }
        }
    }

    /**
     * Returns true if the entity has a contact event attached and false otherwise.
     *
     * @param {import('../../entity.js').Entity} entity - Entity to test.
     * @returns {boolean} True if the entity has a contact and false otherwise.
     * @private
     */
    _hasContactEvent(entity) {
        const c = entity.collision;
        if (c && (c.hasEvent('collisionstart') || c.hasEvent('collisionend') || c.hasEvent('contact'))) {
            return true;
        }

        const r = entity.rigidbody;
        return r && (r.hasEvent('collisionstart') || r.hasEvent('collisionend') || r.hasEvent('contact'));
    }

    /**
     * Checks for collisions and fires collision events.
     *
     * @param {number} world - The pointer to the dynamics world that invoked this callback.
     * @param {number} timeStep - The amount of simulation time processed in the last simulation tick.
     * @private
     */
    _checkForCollisions(world, timeStep) {
        const dynamicsWorld = Ammo.wrapPointer(world, Ammo.btDynamicsWorld);

        // Check for collisions and fire callbacks
        const dispatcher = dynamicsWorld.getDispatcher();
        const numManifolds = dispatcher.getNumManifolds();

        this.frameCollisions = {};

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

                    const e0Events = e0.collision && (e0.collision.hasEvent('triggerenter') || e0.collision.hasEvent('triggerleave'));
                    const e1Events = e1.collision && (e1.collision.hasEvent('triggerenter') || e1.collision.hasEvent('triggerleave'));
                    const e0BodyEvents = e0.rigidbody && (e0.rigidbody.hasEvent('triggerenter') || e0.rigidbody.hasEvent('triggerleave'));
                    const e1BodyEvents = e1.rigidbody && (e1.rigidbody.hasEvent('triggerenter') || e1.rigidbody.hasEvent('triggerleave'));

                    // fire triggerenter events for triggers
                    if (e0Events) {
                        newCollision = this._storeCollision(e0, e1);
                        if (newCollision && !(flags1 & BODYFLAG_NORESPONSE_OBJECT)) {
                            e0.collision.fire('triggerenter', e1);
                        }
                    }

                    if (e1Events) {
                        newCollision = this._storeCollision(e1, e0);
                        if (newCollision && !(flags0 & BODYFLAG_NORESPONSE_OBJECT)) {
                            e1.collision.fire('triggerenter', e0);
                        }
                    }

                    // fire triggerenter events for rigidbodies
                    if (e0BodyEvents) {
                        if (!newCollision) {
                            newCollision = this._storeCollision(e1, e0);
                        }

                        if (newCollision) {
                            e0.rigidbody.fire('triggerenter', e1);
                        }
                    }

                    if (e1BodyEvents) {
                        if (!newCollision) {
                            newCollision = this._storeCollision(e0, e1);
                        }

                        if (newCollision) {
                            e1.rigidbody.fire('triggerenter', e0);
                        }
                    }
                } else {
                    const e0Events = this._hasContactEvent(e0);
                    const e1Events = this._hasContactEvent(e1);
                    const globalEvents = this.hasEvent('contact');

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
                                this.fire('contact', result);
                            }
                        }

                        if (e0Events) {
                            const forwardResult = this._createContactResult(e1, forwardContacts);
                            newCollision = this._storeCollision(e0, e1);

                            if (e0.collision) {
                                e0.collision.fire('contact', forwardResult);
                                if (newCollision) {
                                    e0.collision.fire('collisionstart', forwardResult);
                                }
                            }

                            if (e0.rigidbody) {
                                e0.rigidbody.fire('contact', forwardResult);
                                if (newCollision) {
                                    e0.rigidbody.fire('collisionstart', forwardResult);
                                }
                            }
                        }

                        if (e1Events) {
                            const reverseResult = this._createContactResult(e0, reverseContacts);
                            newCollision = this._storeCollision(e1, e0);

                            if (e1.collision) {
                                e1.collision.fire('contact', reverseResult);
                                if (newCollision) {
                                    e1.collision.fire('collisionstart', reverseResult);
                                }
                            }

                            if (e1.rigidbody) {
                                e1.rigidbody.fire('contact', reverseResult);
                                if (newCollision) {
                                    e1.rigidbody.fire('collisionstart', reverseResult);
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

        // downcast gravity to float32 so we can accurately compare with existing
        // gravity set in ammo.
        this._gravityFloat32[0] = this.gravity.x;
        this._gravityFloat32[1] = this.gravity.y;
        this._gravityFloat32[2] = this.gravity.z;

        // Check to see whether we need to update gravity on the dynamics world
        const gravity = this.dynamicsWorld.getGravity();
        if (gravity.x() !== this._gravityFloat32[0] ||
            gravity.y() !== this._gravityFloat32[1] ||
            gravity.z() !== this._gravityFloat32[2]) {
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
        super.destroy();

        this.app.systems.off('update', this.onUpdate, this);

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
