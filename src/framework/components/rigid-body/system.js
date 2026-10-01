import { now } from '../../../core/time.js';
import { ObjectPool } from '../../../core/object-pool.js';
import { Debug } from '../../../core/debug.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { AmmoPhysicsWorld } from '../../physics/ammo/ammo-physics-world.js';
import { ComponentSystem } from '../system.js';
import {
    BODYGROUP_TRIGGER, BODYMASK_NOT_STATIC,
    BODYTYPE_DYNAMIC, BODYTYPE_KINEMATIC, BODYTYPE_STATIC
} from './constants.js';
import { RigidBodyComponent } from './component.js';
import { ContactPoint } from './contact-point.js';
import { ContactResult } from './contact-result.js';
import { SingleContactResult } from './single-contact-result.js';

/**
 * @import { AppBase } from '../../app-base.js'
 * @import { CollisionComponent } from '../collision/component.js'
 * @import { Entity } from '../../entity.js'
 * @import { PhysicsBody } from '../../physics/physics-body.js'
 * @import { PhysicsContactListener, PhysicsContactPair, PhysicsWorld } from '../../physics/physics-world.js'
 * @import { RaycastResult } from './raycast-result.js'
 * @import { Trigger } from '../collision/trigger.js'
 */

/**
 * Options of the `rigidbody` component accepted by {@link RigidBodyComponentSystem} that differ
 * from the properties of {@link RigidBodyComponent}. Each replaces the same-named property of the
 * options that {@link Entity#addComponent} derives from the component class; see
 * {@link ComponentOptionsOverrides}.
 *
 * @typedef {object} RigidBodyComponentOptionsOverrides
 * @property {Vec3 | number[]} [angularFactor] - Same as {@link RigidBodyComponent#angularFactor},
 * also accepting an `[x, y, z]` array.
 * @property {Vec3 | number[]} [linearFactor] - Same as {@link RigidBodyComponent#linearFactor},
 * also accepting an `[x, y, z]` array.
 * @ignore
 */

const _properties = [
    'mass',
    'linearDamping',
    'angularDamping',
    'linearFactor',
    'angularFactor',
    'friction',
    'rollingFriction',
    'gravityScale',
    'restitution',
    'type',
    'group',
    'mask'
];

/**
 * The RigidBodyComponentSystem manages the physics simulation for all rigid body components
 * in the application and is accessed as `app.systems.rigidbody`. It owns the physics world,
 * creates and destroys the bodies behind rigid body and collision components, steps the
 * simulation once per frame and writes the resulting transforms back to their entities. It also
 * holds global settings such as {@link RigidBodyComponentSystem#gravity}, performs raycasts
 * and reports collisions.
 *
 * The system is only functional once a physics backend is installed: either by supplying
 * {@link AppOptions#physicsWorld} when creating the application, or automatically when the
 * application has loaded the Ammo.js {@link WasmModule}. Use a recent Ammo.js build: mesh
 * colliders only follow entity scale with a build that exposes `btScaledBvhTriangleMeshShape`.
 *
 * Set {@link RigidBodyComponentSystem#timeScale} to slow the simulation down, speed it up or
 * pause it, for example while a pause menu is open, and call
 * {@link RigidBodyComponentSystem#step} to advance it manually.
 *
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

    /** @ignore */
    maxSubSteps = 10;

    /**
     * @type {number}
     * @ignore
     */
    fixedTimeStep = 1 / 60;

    /**
     * Scales the time the simulation is advanced by each frame. Defaults to 1. Values below 1
     * run physics in slow motion and values above 1 speed it up. 0 pauses the simulation: the
     * system stops advancing it, bodies freeze in place, entity transforms are no longer driven
     * by their bodies and no contact or trigger events fire. The rest of the application keeps
     * running, so this suits a pause menu or inventory screen that must stay interactive while
     * the game world stands still. Negative values are treated as 0.
     *
     * This scale is applied on top of {@link AppBase#timeScale}. The simulation can still be
     * advanced manually with {@link RigidBodyComponentSystem#step} while paused, for example to
     * drive it from a custom time source.
     *
     * How slow motion below one fixed substep per frame looks depends on the backend: the Ammo
     * backend interpolates body transforms between substeps so motion stays smooth, while other
     * backends may only move bodies on the frames in which a substep runs. Fast forward is
     * limited by the maximum number of substeps the simulation may take per frame, beyond which
     * it runs slower than requested.
     *
     * Forces applied with {@link RigidBodyComponent#applyForce} while paused accumulate on the
     * body and are applied together on the next step, because forces are only cleared when the
     * simulation steps. Impulses and velocity changes take effect immediately.
     *
     * @example
     * // Freeze the game world while the pause menu is open
     * app.systems.rigidbody.timeScale = 0;
     * @example
     * // Run physics at quarter speed for a slow motion effect
     * app.systems.rigidbody.timeScale = 0.25;
     */
    timeScale = 1;

    /**
     * The world space vector representing global gravity in the physics simulation. Defaults to
     * [0, -9.81, 0] which is an approximation of the gravitational force on Earth.
     *
     * The value is applied to the physics backend at the start of the next step, whether the
     * vector is modified in place or replaced with a new one.
     *
     * @example
     * // Set the gravity in the physics world to simulate a planet with low gravity
     * app.systems.rigidbody.gravity = new Vec3(0, -3.7, 0);
     */
    gravity = new Vec3(0, -9.81, 0);

    /**
     * The gravity most recently applied to the physics backend. Compared against gravity each
     * step so the backend is only updated when the value changes.
     *
     * @type {Vec3}
     * @private
     */
    _appliedGravity = new Vec3();

    /**
     * @type {PhysicsWorld|null}
     * @private
     */
    _world = null;

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
     * @type {Trigger[]}
     * @private
     */
    _triggers = [];

    /**
     * @type {CollisionComponent[]}
     * @private
     */
    _compounds = [];

    /**
     * The contact listener installed on the physics backend. It forwards each contact pass to
     * this system, which keeps the listener methods private.
     *
     * @type {PhysicsContactListener}
     * @private
     */
    _contactListener = {
        onContactsBegin: () => this.onContactsBegin(),
        onContactPair: pair => this.onContactPair(pair),
        onContactsEnd: () => this.onContactsEnd()
    };

    /**
     * The frame stats that record the duration of each physics step.
     *
     * @private
     */
    _stats;

    /**
     * @type {ObjectPool<typeof ContactPoint>|null}
     * @private
     */
    contactPointPool = null;

    /**
     * @type {ObjectPool<typeof ContactResult>|null}
     * @private
     */
    contactResultPool = null;

    /**
     * @type {ObjectPool<typeof SingleContactResult>|null}
     * @private
     */
    singleContactResultPool = null;

    /**
     * The entities touched by each entity with contact or trigger events as of the last contact
     * pass, keyed by the GUID of the entity.
     *
     * @type {Object<string, { entity: Entity, others: Entity[] }>}
     * @private
     */
    collisions = {};

    /**
     * The entities touched by each entity in the contact pass in progress, keyed like
     * collisions.
     *
     * @type {Object<string, { entity: Entity, others: Entity[] }>}
     * @private
     */
    frameCollisions = {};

    /**
     * Create a new RigidBodyComponentSystem.
     *
     * @param {AppBase} app - The Application.
     * @ignore
     */
    constructor(app) {
        super(app);

        this.id = 'rigidbody';
        this._stats = app.stats.frame;

        this.ComponentType = RigidBodyComponent;

        this.on('beforeremove', this.onBeforeRemove, this);
        this.on('remove', this.onRemove, this);
    }

    /**
     * Called once application libraries have loaded. Creates the Ammo backend when the Ammo
     * global is present and no backend was injected via {@link AppOptions#physicsWorld}.
     *
     * @ignore
     */
    onLibraryLoaded() {
        if (!this._world && typeof Ammo !== 'undefined') {
            this.setPhysicsWorld(new AmmoPhysicsWorld());
        }
    }

    /**
     * Installs a physics backend, applies the current gravity to it and registers the system's
     * contact listener with it. Called by
     * {@link AppBase#init} when {@link AppOptions#physicsWorld} is supplied, and internally by
     * Ammo auto-detection. A backend can be installed at most once.
     *
     * @param {PhysicsWorld} world - The physics backend.
     * @ignore
     */
    setPhysicsWorld(world) {
        Debug.assert(!this._world, 'RigidBodyComponentSystem#setPhysicsWorld: a physics world is already installed.');
        this._world = world;
        world.contactListener = this._contactListener;

        // give the backend the current gravity before any bodies are added; step() re-applies it
        // whenever the value changes
        this._appliedGravity.copy(this.gravity);
        world.setGravity(this.gravity);

        this.contactPointPool = new ObjectPool(ContactPoint, 1);
        this.contactResultPool = new ObjectPool(ContactResult, 1);
        this.singleContactResultPool = new ObjectPool(SingleContactResult, 1);

        this.app.systems.on('update', this.onUpdate, this);
    }

    /**
     * Gets the installed physics backend, or null when no backend is installed. Supply a
     * backend via {@link AppOptions#physicsWorld}, or load the Ammo.js library to have one
     * installed automatically.
     *
     * @type {PhysicsWorld|null}
     * @alpha
     */
    get physicsWorld() {
        return this._world;
    }

    /**
     * The physics backend's native world - a btDiscreteDynamicsWorld with the Ammo backend - or
     * null if no backend is installed or it has no native world. Same as
     * {@link PhysicsWorld#nativeWorld}. An unsupported escape hatch for native functionality the
     * engine does not expose: code that uses it only works with that physics backend.
     *
     * @type {*}
     * @ignore
     */
    get dynamicsWorld() {
        return this._world?.nativeWorld ?? null;
    }

    /**
     * The Ammo backend's native btDefaultCollisionConfiguration, or null with any other backend
     * or none. An unsupported escape hatch: code that uses it only works with the Ammo backend.
     *
     * @type {*}
     * @ignore
     */
    get collisionConfiguration() {
        return this._world?.collisionConfiguration ?? null;
    }

    /**
     * The Ammo backend's native btCollisionDispatcher, or null with any other backend or none.
     * An unsupported escape hatch: code that uses it only works with the Ammo backend.
     *
     * @type {*}
     * @ignore
     */
    get dispatcher() {
        return this._world?.dispatcher ?? null;
    }

    /**
     * The Ammo backend's native btDbvtBroadphase, or null with any other backend or none. An
     * unsupported escape hatch: code that uses it only works with the Ammo backend.
     *
     * @type {*}
     * @ignore
     */
    get overlappingPairCache() {
        return this._world?.overlappingPairCache ?? null;
    }

    /**
     * The Ammo backend's native btSequentialImpulseConstraintSolver, or null with any other
     * backend or none. An unsupported escape hatch: code that uses it only works with the Ammo
     * backend.
     *
     * @type {*}
     * @ignore
     */
    get solver() {
        return this._world?.solver ?? null;
    }

    initializeComponentData(component, data) {
        for (const property of _properties) {
            if (data.hasOwnProperty(property)) {
                const value = data[property];
                if (Array.isArray(value)) {
                    component[property] = new Vec3(value[0], value[1], value[2]);
                } else {
                    component[property] = value;
                }
            }
        }

        super.initializeComponentData(component, data);
    }

    cloneComponent(entity, clone) {
        const c = entity.rigidbody;

        const data = {
            enabled: c.enabled
        };

        for (const property of _properties) {
            data[property] = c[property];
        }

        return this.addComponent(clone, data);
    }

    /**
     * Disables a component that is being removed and destroys its body.
     *
     * @param {Entity} entity - The entity the component is being removed from.
     * @param {RigidBodyComponent} component - The component being removed.
     * @private
     */
    onBeforeRemove(entity, component) {
        if (component.enabled) {
            component.enabled = false;
        }

        if (component._body) {
            this._world.destroyBody(component._body);
            component.body = null;
        }
    }

    /**
     * Called once the component is gone from its entity. A collision component left behind
     * supplied the body's shape; without a body it is a trigger volume, or a child of an
     * enclosing compound, so it is rebuilt into that role. The pairs the body was touching are
     * forgotten first: they belong to the old role, and a trigger built over an overlap that is
     * still in progress has to report it as new. Nothing is rebuilt while the entity itself is
     * being destroyed, since the collision component is about to go as well.
     *
     * @param {Entity} entity - The entity the component was removed from.
     * @private
     */
    onRemove(entity) {
        if (entity._destroying || !this._world) {
            return;
        }

        const collision = entity.collision;
        if (collision) {
            this.clearEntityCollisions(entity);
            collision.system.recreatePhysicalShapes(collision);
        }
    }

    /**
     * Adds a body to the simulation with the given collision group and mask.
     *
     * @param {PhysicsBody} body - The body to add.
     * @param {number} group - The collision group bits.
     * @param {number} mask - The collision mask bits.
     * @private
     */
    addBody(body, group, mask) {
        this._world.addBody(body, group, mask);
    }

    /**
     * Removes a body from the simulation.
     *
     * @param {PhysicsBody} body - The body to remove.
     * @private
     */
    removeBody(body) {
        this._world.removeBody(body);
    }

    /**
     * Adds a component's body to the simulation and registers the component with the update
     * lists for its body type. Fires 'simulationenabled' on the component. No-op unless the
     * component has a body, an enabled collision component and is not already simulating.
     *
     * @param {RigidBodyComponent} component - The component to add to the simulation.
     * @ignore
     */
    enableSimulation(component) {
        const entity = component.entity;
        if (entity.collision && entity.collision.enabled && !component._simulationEnabled) {
            const body = component._body;
            if (body) {
                // addBody also applies the backend's per-type activation policy
                this.addBody(body, component._group, component._mask);

                switch (component._type) {
                    case BODYTYPE_DYNAMIC:
                        // adding a body to the world hands it the world gravity, so a scaled
                        // body takes its own value afterwards
                        if (component._gravityScale !== 1) {
                            body.setGravityScale(component._gravityScale);
                        }
                        this._dynamic.push(component);
                        component.syncEntityToBody();
                        break;
                    case BODYTYPE_KINEMATIC:
                        this._kinematic.push(component);
                        component.syncEntityToBody();
                        break;
                    case BODYTYPE_STATIC:
                        component.syncEntityToBody();
                        break;
                }

                // a static body's shape only changes when it is rebuilt, so its compound children
                // are not tracked per step
                if (entity.collision.type === 'compound' && component._type !== BODYTYPE_STATIC) {
                    this._compounds.push(entity.collision);
                }

                body.activate();

                component._simulationEnabled = true;

                // internal event consumed by the joint system to (re)create constraints
                // against bodies that are present in the dynamics world
                component.fire('simulationenabled');
            }
        }
    }

    /**
     * Removes a component's body from the simulation and unregisters the component from the
     * update lists. Fires 'simulationdisabled' on the component. No-op unless the component
     * has a body and is currently simulating.
     *
     * @param {RigidBodyComponent} component - The component to remove from the simulation.
     * @ignore
     */
    disableSimulation(component) {
        const body = component._body;
        if (body && component._simulationEnabled) {
            let idx = this._compounds.indexOf(component.entity.collision);
            if (idx > -1) {
                this._compounds.splice(idx, 1);
            }

            idx = this._dynamic.indexOf(component);
            if (idx > -1) {
                this._dynamic.splice(idx, 1);
            }

            idx = this._kinematic.indexOf(component);
            if (idx > -1) {
                this._kinematic.splice(idx, 1);
            }

            // removeBody also drops the body out of the active state so isActive() does not
            // return true even though it is no longer in the dynamics world
            this.removeBody(body);

            component._simulationEnabled = false;

            // internal event consumed by the joint system to destroy constraints that reference
            // this body. The body has just been removed from the dynamics world above and is now
            // inert, but is still a valid object - tearing the constraints down here keeps them
            // from referencing the body once it is later destroyed or rebuilt.
            component.fire('simulationdisabled');
        }
    }

    /**
     * Adds a trigger's body to the simulation and registers the trigger for per-frame
     * transform updates. No-op if the trigger is already registered.
     *
     * @param {Trigger} trigger - The trigger to add to the simulation.
     * @ignore
     */
    addTrigger(trigger) {
        if (this._triggers.indexOf(trigger) < 0) {
            // addBody also puts the body into the active state so that it is simulated
            // properly again
            this.addBody(trigger.body, BODYGROUP_TRIGGER, BODYMASK_NOT_STATIC ^ BODYGROUP_TRIGGER);
            this._triggers.push(trigger);
        }
    }

    /**
     * Removes a trigger's body from the simulation and unregisters the trigger. No-op if the
     * trigger is not registered.
     *
     * @param {Trigger} trigger - The trigger to remove from the simulation.
     * @ignore
     */
    removeTrigger(trigger) {
        const idx = this._triggers.indexOf(trigger);
        if (idx > -1) {
            // removeBody also drops the body out of the active state so that it properly
            // deactivates after being removed from the physics world
            this.removeBody(trigger.body);
            this._triggers.splice(idx, 1);
        }
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
     * @param {boolean} [options.hitBackFaces] - Whether the ray can hit the back faces of mesh
     * colliders, which face away from the ray: the far side of a closed mesh, or the first surface
     * met by a ray starting inside one. A back-face hit reports a normal flipped to face the start
     * of the ray. Other collision shapes never report back-face hits. Defaults to true.
     * @param {any[]} [options.filterTags] - Tags filters. Defined the same way as a {@link Tags#has}
     * query but within an array.
     * @param {Function} [options.filterCallback] - Custom function to use to filter entities.
     * Must return true to proceed with result. Takes one argument: the entity to evaluate.
     *
     * @returns {RaycastResult|null} The result of the raycasting, or null if there was no hit or
     * no physics backend is installed.
     */
    raycastFirst(start, end, options = {}) {
        const world = this._world;
        if (!world) {
            Debug.warnOnce('RigidBodyComponentSystem#raycastFirst: no physics backend is installed, so the ray cannot hit anything.');
            return null;
        }

        // Tags and custom callback can only be performed by looking at all results - keep the
        // closest one, without sorting them or writing a sort flag into the caller's options
        if (options.filterTags || options.filterCallback) {
            const results = this.raycastAll(start, end, options);

            let closest = null;
            for (let i = 0; i < results.length; i++) {
                const result = results[i];
                if (!closest || result.hitFraction < closest.hitFraction) {
                    closest = result;
                }
            }
            return closest;
        }

        return world.raycastFirst(start, end, options);
    }

    /**
     * Raycast the world and return all entities the ray hits. It returns an array of
     * {@link RaycastResult}, one for each hit. If no hits are detected, the returned array will be
     * of length 0. Results are returned in no particular order unless `options.sort` is true, in
     * which case they are sorted by distance with the closest first.
     *
     * @param {Vec3} start - The world space point where the ray starts.
     * @param {Vec3} end - The world space point where the ray ends.
     * @param {object} [options] - The additional options for the raycasting.
     * @param {boolean} [options.sort] - Whether to sort raycast results based on distance with closest
     * first. Defaults to false.
     * @param {number} [options.filterCollisionGroup] - Collision group to apply to the raycast.
     * @param {number} [options.filterCollisionMask] - Collision mask to apply to the raycast.
     * @param {boolean} [options.hitBackFaces] - Whether the ray can hit the back faces of mesh
     * colliders, which face away from the ray: the far side of a closed mesh, or the first surface
     * met by a ray starting inside one. A back-face hit reports a normal flipped to face the start
     * of the ray. Other collision shapes never report back-face hits. Defaults to true.
     * @param {any[]} [options.filterTags] - Tags filters. Defined the same way as a {@link Tags#has}
     * query but within an array.
     * @param {Function} [options.filterCallback] - Custom function to use to filter entities.
     * Must return true to proceed with result. Takes the entity to evaluate as argument.
     *
     * @returns {RaycastResult[]} An array of raycast hit results (0 length if there were no hits
     * or no physics backend is installed).
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
     * // Return all results of a raycast between 0, 2, 2 and 0, -2, -2, skipping the back faces
     * // of mesh colliders so a ray through a closed mesh hits it only where it enters
     * const hits = this.app.systems.rigidbody.raycastAll(new Vec3(0, 2, 2), new Vec3(0, -2, -2), {
     *     hitBackFaces: false
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
        const world = this._world;
        if (!world) {
            Debug.warnOnce('RigidBodyComponentSystem#raycastAll: no physics backend is installed, so the ray cannot hit anything.');
            return [];
        }

        const results = world.raycastAll(start, end, options);

        if (options.sort) {
            results.sort((a, b) => a.hitFraction - b.hitFraction);
        }

        return results;
    }

    /**
     * Stores a collision between the entity and other in the contacts map and returns true if it
     * is a new collision.
     *
     * @param {Entity} entity - The entity.
     * @param {Entity} other - The entity that collides with the first entity.
     * @returns {boolean} True if this is a new collision, false otherwise.
     * @private
     */
    _storeCollision(entity, other) {
        let isNewCollision = false;
        const guid = entity.guid;

        this.collisions[guid] = this.collisions[guid] || { others: [], entity: entity };

        if (this.collisions[guid].others.indexOf(other) < 0) {
            this.collisions[guid].others.push(other);
            isNewCollision = true;
        }

        this.frameCollisions[guid] = this.frameCollisions[guid] || { others: [], entity: entity };
        this.frameCollisions[guid].others.push(other);

        return isNewCollision;
    }

    /**
     * Allocates a pooled contact point that is the given one seen from the other body's
     * perspective: the points swap sides and the normal flips, so that it points away from body
     * A's surface just as the forward normal points away from body B's.
     *
     * @param {ContactPoint} forward - The contact point from body A's perspective.
     * @returns {ContactPoint} The reversed contact point.
     * @private
     */
    _createReverseContactPoint(forward) {
        const contact = this.contactPointPool.allocate();
        contact.localPoint.copy(forward.localPointOther);
        contact.localPointOther.copy(forward.localPoint);
        contact.point.copy(forward.pointOther);
        contact.pointOther.copy(forward.point);
        contact.normal.copy(forward.normal).mulScalar(-1);
        contact.impulse = forward.impulse;
        return contact;
    }

    /**
     * Allocates a pooled result for the global contact event from a contact point.
     *
     * @param {Entity} a - The first entity involved in the contact.
     * @param {Entity} b - The second entity involved in the contact.
     * @param {ContactPoint} contactPoint - The contact point, from the first entity's perspective.
     * @returns {SingleContactResult} The result.
     * @private
     */
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

    /**
     * Allocates a pooled result for the contact events of one entity.
     *
     * @param {Entity} other - The other entity involved in the contact.
     * @param {ContactPoint[]} contacts - The contact points, from the entity's perspective.
     * @returns {ContactResult} The result.
     * @private
     */
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
     * Removes any stored collision keyed to the given entity. Called when a collision component is
     * removed so the persistent collisions map does not retain a destroyed entity. A new entity
     * that later reuses the same GUID (for example after reloading the same scene) would otherwise
     * inherit the stale entry and never fire `triggerleave` / `collisionend`, because the cached
     * entity no longer has a trigger or body.
     *
     * @param {Entity} entity - The entity whose stored collision should be removed.
     * @ignore
     */
    clearEntityCollisions(entity) {
        delete this.collisions[entity.guid];
    }

    /**
     * Returns true if the entity has a contact event attached and false otherwise.
     *
     * @param {Entity} entity - Entity to test.
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
     * Called through the contact listener when the physics backend begins a contact pass.
     *
     * @private
     */
    onContactsBegin() {
        this.frameCollisions = {};
    }

    /**
     * Called through the contact listener for each contacting pair the physics backend reports.
     * Fires the trigger and collision events.
     *
     * @param {PhysicsContactPair} pair - The contacting pair. Only valid during the call.
     * @private
     */
    onContactPair(pair) {
        const e0 = pair.entityA;
        const e1 = pair.entityB;

        const forwardContacts = [];
        const reverseContacts = [];
        let newCollision;

        // don't fire contact events for triggers
        if (pair.triggerA || pair.triggerB) {
            const e0Events = e0.collision && (e0.collision.hasEvent('triggerenter') || e0.collision.hasEvent('triggerleave'));
            const e1Events = e1.collision && (e1.collision.hasEvent('triggerenter') || e1.collision.hasEvent('triggerleave'));
            const e0BodyEvents = e0.rigidbody && (e0.rigidbody.hasEvent('triggerenter') || e0.rigidbody.hasEvent('triggerleave'));
            const e1BodyEvents = e1.rigidbody && (e1.rigidbody.hasEvent('triggerenter') || e1.rigidbody.hasEvent('triggerleave'));

            // fire triggerenter events for triggers
            if (e0Events) {
                newCollision = this._storeCollision(e0, e1);
                if (newCollision && !pair.triggerB) {
                    e0.collision.fire('triggerenter', e1);
                }
            }

            if (e1Events) {
                newCollision = this._storeCollision(e1, e0);
                if (newCollision && !pair.triggerA) {
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
                const contactCount = pair.contactCount;
                for (let j = 0; j < contactCount; j++) {
                    const contactPoint = this.contactPointPool.allocate();
                    pair.readContact(j, contactPoint);

                    if (e0Events || e1Events) {
                        forwardContacts.push(contactPoint);
                        reverseContacts.push(this._createReverseContactPoint(contactPoint));
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

    /**
     * Called through the contact listener when the physics backend ends a contact pass. Fires
     * collisionend/triggerleave events for lost contacts and frees the pooled results.
     *
     * @private
     */
    onContactsEnd() {
        // check for collisions that no longer exist and fire events
        this._cleanOldCollisions();

        // Reset contact pools
        this.contactPointPool.freeAll();
        this.contactResultPool.freeAll();
        this.singleContactResultPool.freeAll();
    }

    /**
     * Advances the physics simulation by dt seconds. Synchronizes triggers, compound shapes and
     * kinematic bodies from their entities, steps the backend in fixed-length substeps (up to a
     * maximum number per call), writes the resulting transforms of dynamic bodies back to their
     * entities and fires contact and trigger events.
     *
     * The system calls this once per frame with the frame delta time multiplied by
     * {@link RigidBodyComponentSystem#timeScale}, unless that is 0. Call it directly to step the
     * simulation manually: to advance it while paused, to fast forward it by stepping several
     * times in one frame, or to drive it from a custom time source. Automatic stepping continues
     * while timeScale is above 0, so calling this every frame as well advances the simulation
     * twice per frame. Set timeScale to 0 first when taking over stepping entirely. The delta is
     * used as given, without applying timeScale. Does nothing when no physics backend is
     * installed.
     *
     * @param {number} dt - The amount of time to advance the simulation by, in seconds.
     * @example
     * // Pause automatic stepping and advance the simulation by 1/60 s per key press
     * const physics = app.systems.rigidbody;
     * physics.timeScale = 0;
     * app.keyboard.on('keydown', (event) => {
     *     if (event.key === KEY_SPACE) {
     *         physics.step(1 / 60);
     *     }
     * });
     */
    step(dt) {
        const world = this._world;
        if (!world) return;

        let i, len;

        this._stats.physicsStart = now();

        // apply gravity to the backend only when it has changed since it was last applied, so
        // in-place edits of the vector are picked up without a backend call every step
        const gravity = this.gravity;
        if (!this._appliedGravity.equals(gravity)) {
            this._appliedGravity.copy(gravity);
            world.setGravity(gravity);

            // bodies with a gravity scale hold their own copy of the world gravity
            const dynamic = this._dynamic;
            for (i = 0, len = dynamic.length; i < len; i++) {
                const component = dynamic[i];
                if (component._gravityScale !== 1) {
                    component._body.setGravityScale(component._gravityScale);
                }
            }
        }

        // rebuild the mesh collision shapes whose entity world scale changed since they were
        // built, before the trigger and body loops below capture their list lengths
        this.app.systems.collision?._updateMeshScales();

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
        world.step(dt, this.maxSubSteps, this.fixedTimeStep);

        // Update the transforms of all entities referencing a dynamic body
        const dynamic = this._dynamic;
        for (i = 0, len = dynamic.length; i < len; i++) {
            dynamic[i]._updateDynamic();
        }

        // no-op on backends that report contacts from inside step()
        world.flushContacts();

        this._stats.physicsTime = now() - this._stats.physicsStart;
    }

    /**
     * Steps the simulation by the frame delta time scaled by
     * {@link RigidBodyComponentSystem#timeScale}, or skips the frame entirely when the scale is
     * 0. Registered on the application's update event when a physics backend is installed.
     *
     * @param {number} dt - The frame delta time in seconds.
     * @private
     */
    onUpdate(dt) {
        const timeScale = this.timeScale;
        if (!(timeScale > 0)) {
            // paused: nothing was simulated this frame
            this._stats.physicsTime = 0;
            return;
        }

        this.step(dt * timeScale);
    }

    destroy() {
        super.destroy();

        this.app.systems.off('update', this.onUpdate, this);

        if (this._world) {
            this._world.destroy();
            this._world = null;
        }
    }

    /**
     * Sets the world space gravity. Accepts either a Vec3 or three numbers.
     *
     * @param {number|Vec3} x - A Vec3 holding the gravity, or the x-component of the gravity.
     * @param {number} [y] - The y-component of the gravity.
     * @param {number} [z] - The z-component of the gravity.
     * @ignore
     * @deprecated Use {@link RigidBodyComponentSystem#gravity} instead.
     */
    setGravity(x, y, z) {
        Debug.deprecated('RigidBodyComponentSystem#setGravity is deprecated. Use RigidBodyComponentSystem#gravity instead.');

        if (y === undefined) {
            this.gravity.copy(x);
        } else {
            this.gravity.set(x, y, z);
        }
    }
}

export { RigidBodyComponentSystem };
