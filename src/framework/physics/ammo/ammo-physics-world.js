import { Debug } from '../../../core/debug.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { BODYTYPE_KINEMATIC } from '../../components/rigid-body/constants.js';
import { RaycastResult } from '../../components/rigid-body/raycast-result.js';
import { PhysicsWorld } from '../physics-world.js';
import { AmmoPhysicsBody } from './ammo-physics-body.js';
import { createJoint, destroyJoint, destroyFixedBody } from './ammo-physics-joint.js';
import {
    ACTIVE_TAG, CF_KINEMATIC_OBJECT, CF_NO_CONTACT_RESPONSE, DISABLE_DEACTIVATION,
    DISABLE_SIMULATION
} from './constants.js';

/**
 * @import { AmmoPhysicsJoint } from './ammo-physics-joint.js'
 */
import {
    createShape, destroyShape, releaseUnusedTriMeshShapes, addCompoundChild, updateCompoundChild,
    removeCompoundChild
} from './ammo-physics-shape.js';

/**
 * @import { ContactPoint } from '../../components/rigid-body/contact-point.js'
 * @import { PhysicsBodyDesc, PhysicsJointDesc, PhysicsShapeDesc } from '../physics-world.js'
 */

// btTriangleRaycastCallback::kF_FilterBackfaces
const RAYFLAG_FILTER_BACKFACES = 1;

/**
 * Applies the raycast options shared by all ray queries to a native ray result callback.
 *
 * @param {object} rayCallback - The native ray result callback.
 * @param {object} options - The raycast options.
 */
function applyRayOptions(rayCallback, options) {
    if (typeof options.filterCollisionGroup === 'number') {
        rayCallback.set_m_collisionFilterGroup(options.filterCollisionGroup);
    }

    if (typeof options.filterCollisionMask === 'number') {
        rayCallback.set_m_collisionFilterMask(options.filterCollisionMask);
    }

    if (options.hitBackFaces === false) {
        if (typeof rayCallback.set_m_flags === 'function') {
            rayCallback.set_m_flags(RAYFLAG_FILTER_BACKFACES);
        } else {
            Debug.warnOnce('AmmoPhysicsWorld: this Ammo.js build does not expose ray callback ' +
                'flags, so the hitBackFaces raycast option is ignored. Update Ammo.js.');
        }
    }
}

/**
 * The reused contact pair reported to the contact listener. Reads contact point data straight
 * from the current native manifold - nothing is allocated.
 *
 * @ignore
 */
class AmmoContactPair {
    entityA = null;

    entityB = null;

    triggerA = false;

    triggerB = false;

    contactCount = 0;

    /**
     * The native btPersistentManifold currently being reported.
     *
     * @private
     */
    _manifold = null;

    /**
     * @param {number} index - The contact point index.
     * @param {ContactPoint} out - The contact point to fill, from body A's perspective.
     */
    readContact(index, out) {
        const contactPoint = this._manifold.getContactPoint(index);

        const localPointA = contactPoint.get_m_localPointA();
        const localPointB = contactPoint.get_m_localPointB();
        const positionWorldOnA = contactPoint.getPositionWorldOnA();
        const positionWorldOnB = contactPoint.getPositionWorldOnB();
        const normalWorldOnB = contactPoint.get_m_normalWorldOnB();

        out.localPoint.set(localPointA.x(), localPointA.y(), localPointA.z());
        out.localPointOther.set(localPointB.x(), localPointB.y(), localPointB.z());
        out.point.set(positionWorldOnA.x(), positionWorldOnA.y(), positionWorldOnA.z());
        out.pointOther.set(positionWorldOnB.x(), positionWorldOnB.y(), positionWorldOnB.z());
        out.normal.set(normalWorldOnB.x(), normalWorldOnB.y(), normalWorldOnB.z());
        out.impulse = contactPoint.getAppliedImpulse();
    }
}

/**
 * The internal tick callback registered with each Ammo module instance, and the worlds it routes
 * to by the native world pointer Bullet passes as the callback's first argument.
 *
 * Emscripten's addFunction hands out a function table slot that is never released (removeFunction
 * is not exported by the shipped builds) and it identity-caches the function it is given. A
 * closure per world would therefore keep the world, its contact listener and through that the
 * whole application reachable for the life of the page. One dispatcher per module captures
 * nothing but this registry, so an entry lives exactly as long as its world and the table grows
 * by a single slot however many worlds come and go.
 *
 * @type {WeakMap<object, { pointer: number, worlds: Map<number, AmmoPhysicsWorld> }>}
 */
const tickDispatchers = new WeakMap();

/**
 * Returns the tick dispatcher for an Ammo module instance, registering it on first use.
 *
 * @param {object} ammo - The Ammo module.
 * @returns {{ pointer: number, worlds: Map<number, AmmoPhysicsWorld> }} The dispatcher.
 */
function getTickDispatcher(ammo) {
    let dispatcher = tickDispatchers.get(ammo);
    if (!dispatcher) {
        const worlds = new Map();
        const pointer = ammo.addFunction((worldPointer) => {
            const world = worlds.get(worldPointer);
            if (world) {
                world._walkContacts();
            } else {
                // only the miss builds a message: this runs every substep in debug builds
                Debug.assert(false, `AmmoPhysicsWorld: internal tick callback for an unknown world ${worldPointer}.`);
            }
        }, 'vif');
        dispatcher = { pointer, worlds };
        tickDispatchers.set(ammo, dispatcher);
    }
    return dispatcher;
}

/**
 * The Ammo.js (Bullet) physics backend. The `Ammo` global must be available when the world is
 * constructed - load the library first, then supply the backend to the application:
 *
 * ```javascript
 * WasmModule.setConfig('Ammo', {
 *     glueUrl: 'ammo.wasm.js',
 *     wasmUrl: 'ammo.wasm.wasm',
 *     fallbackUrl: 'ammo.js'
 * });
 * await new Promise((resolve) => {
 *     WasmModule.getInstance('Ammo', () => resolve());
 * });
 *
 * const options = new AppOptions();
 * options.physicsWorld = new AmmoPhysicsWorld();
 * ```
 *
 * When {@link AppOptions#physicsWorld} is omitted, the engine creates this backend
 * automatically once application libraries have loaded, if the Ammo global is present.
 *
 * @category Physics
 * @alpha
 */
class AmmoPhysicsWorld extends PhysicsWorld {
    /**
     * Built triangle data cached per geometry source id, shared by all mesh shapes created
     * from the same geometry. Each entry holds the btTriangleMesh, which lives until the world
     * is destroyed, and the unit-scale btBvhTriangleMeshShape that every instance wraps in its
     * own btScaledBvhTriangleMeshShape, reference counted by those wrappers and released at the
     * end of a step once none is left.
     *
     * @type {Map<number, { triMesh: object, bvhShape: object|null, refCount: number }>}
     * @ignore
     */
    _triMeshCache = new Map();

    /**
     * Cache entries whose reference count dropped to zero since the last step. Their BVH shapes
     * are released at the end of the step if still unused.
     *
     * @type {Set<object>}
     * @ignore
     */
    _unusedTriMeshEntries = new Set();

    /**
     * Whether this Ammo build exposes btScaledBvhTriangleMeshShape, which lets mesh shape
     * instances share one BVH while carrying their own scale. Older builds fall back to baking
     * the scale into the shared triangle data.
     *
     * @type {boolean}
     * @ignore
     */
    _hasScaledTriMesh = false;

    /**
     * The shared static body world-pinned joints attach to, lazily created.
     *
     * @type {object|null}
     * @ignore
     */
    _fixedBody = null;

    /**
     * The fixed timestep of the last simulation step, used by joint motor conversions.
     *
     * @ignore
     */
    _fixedTimeStep = 1 / 60;

    /**
     * The native btDefaultCollisionConfiguration.
     *
     * @ignore
     */
    collisionConfiguration = null;

    /**
     * The native btCollisionDispatcher.
     *
     * @ignore
     */
    dispatcher = null;

    /**
     * The native btDbvtBroadphase.
     *
     * @ignore
     */
    overlappingPairCache = null;

    /**
     * The native btSequentialImpulseConstraintSolver.
     *
     * @ignore
     */
    solver = null;

    /**
     * Whether contacts are reported per fixed substep from inside stepSimulation.
     *
     * @private
     */
    _useTickCallback = false;

    /**
     * The tick dispatcher this world is registered with, and the native world pointer it is
     * registered under. Null when the build has no internal tick callback.
     *
     * @type {{ pointer: number, worlds: Map<number, AmmoPhysicsWorld> }|null}
     * @private
     */
    _tickDispatcher = null;

    /** @private */
    _nativeWorldPointer = 0;

    /**
     * The reused contact pair driven through the contact listener.
     *
     * @private
     */
    _contactPair = null;

    /** @private */
    _btVec1 = null;

    /** @private */
    _btVec2 = null;

    /** @private */
    _btQuat = null;

    /** @private */
    _btTransform = null;

    /** @private */
    _btRayStart = null;

    /** @private */
    _btRayEnd = null;

    /**
     * Create a new AmmoPhysicsWorld instance. The Ammo library must be loaded before the
     * backend is constructed.
     */
    constructor() {
        super();

        Debug.assert(typeof Ammo !== 'undefined', 'AmmoPhysicsWorld: the Ammo.js library must be loaded before the Ammo backend is constructed.');

        this._hasScaledTriMesh = typeof Ammo.btScaledBvhTriangleMeshShape === 'function';

        this.collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
        this.dispatcher = new Ammo.btCollisionDispatcher(this.collisionConfiguration);
        this.overlappingPairCache = new Ammo.btDbvtBroadphase();
        this.solver = new Ammo.btSequentialImpulseConstraintSolver();
        this.nativeWorld = new Ammo.btDiscreteDynamicsWorld(this.dispatcher, this.overlappingPairCache, this.solver, this.collisionConfiguration);

        // report contacts per fixed substep from inside stepSimulation where supported,
        // otherwise defer to flushContacts()
        this._useTickCallback = !!this.nativeWorld.setInternalTickCallback;
        if (this._useTickCallback) {
            // one callback per module, routed by world pointer - see tickDispatchers
            const dispatcher = getTickDispatcher(Ammo);
            this._nativeWorldPointer = Ammo.getPointer(this.nativeWorld);
            dispatcher.worlds.set(this._nativeWorldPointer, this);
            this._tickDispatcher = dispatcher;
            this.nativeWorld.setInternalTickCallback(dispatcher.pointer);
        } else {
            Debug.warn('WARNING: This version of ammo.js can potentially fail to report contacts. Please update it to the latest version.');
        }

        this._contactPair = new AmmoContactPair();

        // cached math temporaries, shared by this world's bodies
        this._btVec1 = new Ammo.btVector3();
        this._btVec2 = new Ammo.btVector3();
        this._btQuat = new Ammo.btQuaternion();
        this._btTransform = new Ammo.btTransform();
        this._btRayStart = new Ammo.btVector3();
        this._btRayEnd = new Ammo.btVector3();
    }

    destroy() {
        this._triMeshCache.forEach((entry) => {
            if (entry.bvhShape) {
                Ammo.destroy(entry.bvhShape);
            }
            Ammo.destroy(entry.triMesh);
        });
        this._triMeshCache.clear();
        this._unusedTriMeshEntries.clear();

        destroyFixedBody(this);

        Ammo.destroy(this._btVec1);
        Ammo.destroy(this._btVec2);
        Ammo.destroy(this._btQuat);
        Ammo.destroy(this._btTransform);
        Ammo.destroy(this._btRayStart);
        Ammo.destroy(this._btRayEnd);
        this._btVec1 = null;
        this._btVec2 = null;
        this._btQuat = null;
        this._btTransform = null;
        this._btRayStart = null;
        this._btRayEnd = null;

        // unregister before the native world is freed: the next world may be allocated at the
        // same address
        if (this._tickDispatcher) {
            this._tickDispatcher.worlds.delete(this._nativeWorldPointer);
            this._tickDispatcher = null;
        }

        Ammo.destroy(this.nativeWorld);
        Ammo.destroy(this.solver);
        Ammo.destroy(this.overlappingPairCache);
        Ammo.destroy(this.dispatcher);
        Ammo.destroy(this.collisionConfiguration);
        this.nativeWorld = null;
        this.solver = null;
        this.overlappingPairCache = null;
        this.dispatcher = null;
        this.collisionConfiguration = null;
    }

    /**
     * @param {PhysicsBodyDesc} desc - The body descriptor.
     * @returns {AmmoPhysicsBody} The new body.
     * @ignore
     */
    createBody(desc) {
        const { type, mass, shape, position, rotation, entity } = desc;
        const noContactResponse = !!desc.noContactResponse;

        this._btVec1.setValue(position.x, position.y, position.z);
        this._btQuat.setValue(rotation.x, rotation.y, rotation.z, rotation.w);
        this._btTransform.setOrigin(this._btVec1);
        this._btTransform.setRotation(this._btQuat);

        const localInertia = new Ammo.btVector3(0, 0, 0);
        if (mass !== 0) {
            shape.calculateLocalInertia(mass, localInertia);
        }

        const motionState = new Ammo.btDefaultMotionState(this._btTransform);
        const bodyInfo = new Ammo.btRigidBodyConstructionInfo(mass, motionState, shape, localInertia);
        const nativeBody = new Ammo.btRigidBody(bodyInfo);
        Ammo.destroy(bodyInfo);
        Ammo.destroy(localInertia);

        if (type === BODYTYPE_KINEMATIC) {
            nativeBody.setCollisionFlags(nativeBody.getCollisionFlags() | CF_KINEMATIC_OBJECT);
            nativeBody.setActivationState(DISABLE_DEACTIVATION);
        }
        if (noContactResponse) {
            nativeBody.setCollisionFlags(nativeBody.getCollisionFlags() | CF_NO_CONTACT_RESPONSE);
        }

        // entity back-reference on the native body: read by the raycast and manifold walks,
        // and by user code holding the native escape hatch
        nativeBody.entity = entity;

        const body = new AmmoPhysicsBody(this, nativeBody, type, noContactResponse);
        body.entity = entity;
        return body;
    }

    destroyBody(body) {
        const nativeBody = body.nativeBody;
        // The motion state needs to be destroyed explicitly (if present)
        const motionState = nativeBody.getMotionState();
        if (motionState) {
            Ammo.destroy(motionState);
        }
        Ammo.destroy(nativeBody);
        body.nativeBody = null;
    }

    addBody(body, group, mask) {
        const nativeBody = body.nativeBody;
        if (group !== undefined && mask !== undefined) {
            this.nativeWorld.addRigidBody(nativeBody, group, mask);
        } else {
            this.nativeWorld.addRigidBody(nativeBody);
        }
        body._inWorld = true;

        // kinematic bodies must never deactivate, everything else enters the active state
        nativeBody.forceActivationState(body._type === BODYTYPE_KINEMATIC ? DISABLE_DEACTIVATION : ACTIVE_TAG);
    }

    removeBody(body) {
        const nativeBody = body.nativeBody;
        this.nativeWorld.removeRigidBody(nativeBody);
        body._inWorld = false;

        // set activation state to disable simulation so isActive() does not return true even
        // though the body is no longer in the world
        nativeBody.forceActivationState(DISABLE_SIMULATION);
    }

    /**
     * @param {PhysicsShapeDesc} desc - The shape descriptor.
     * @returns {object} The opaque shape handle (the native btCollisionShape).
     * @ignore
     */
    createShape(desc) {
        return createShape(this, desc);
    }

    get supportsMeshScaling() {
        return this._hasScaledTriMesh;
    }

    destroyShape(shape) {
        destroyShape(this, shape);
    }

    addCompoundChild(compound, child, position, rotation) {
        addCompoundChild(this, compound, child, position, rotation);
    }

    updateCompoundChild(compound, child, position, rotation) {
        updateCompoundChild(this, compound, child, position, rotation);
    }

    removeCompoundChild(compound, child) {
        removeCompoundChild(compound, child);
    }

    getCompoundChildCount(compound) {
        return compound.getNumChildShapes();
    }

    /**
     * @param {PhysicsJointDesc} desc - The joint descriptor.
     * @returns {AmmoPhysicsJoint} The new joint.
     * @ignore
     */
    createJoint(desc) {
        return createJoint(this, desc);
    }

    destroyJoint(joint) {
        destroyJoint(this, joint);
    }

    /**
     * @param {Vec3} gravity - The world space gravity.
     * @ignore
     */
    setGravity(gravity) {
        this._btVec1.setValue(gravity.x, gravity.y, gravity.z);
        this.nativeWorld.setGravity(this._btVec1);
    }

    step(dt, maxSubSteps, fixedTimeStep) {
        this._fixedTimeStep = fixedTimeStep;
        this.nativeWorld.stepSimulation(dt, maxSubSteps, fixedTimeStep);

        releaseUnusedTriMeshShapes(this);
    }

    flushContacts() {
        // ammo builds without internal tick callbacks get one contact pass per frame instead,
        // deliberately after the caller's dynamic transform sync
        if (!this._useTickCallback) {
            this._walkContacts();
        }
    }

    /**
     * Walks the dispatcher's contact manifolds and reports each contacting pair with entities
     * on both bodies to the contact listener.
     *
     * @private
     */
    _walkContacts() {
        const listener = this.contactListener;
        if (!listener) {
            return;
        }

        listener.onContactsBegin();

        const dispatcher = this.dispatcher;
        const numManifolds = dispatcher.getNumManifolds();
        const pair = this._contactPair;

        for (let i = 0; i < numManifolds; i++) {
            const manifold = dispatcher.getManifoldByIndexInternal(i);

            const wb0 = Ammo.castObject(manifold.getBody0(), Ammo.btRigidBody);
            const wb1 = Ammo.castObject(manifold.getBody1(), Ammo.btRigidBody);

            const e0 = wb0.entity;
            const e1 = wb1.entity;

            // check if entity is null - TODO: investigate when this happens
            if (!e0 || !e1) {
                continue;
            }

            const numContacts = manifold.getNumContacts();
            if (numContacts > 0) {
                pair.entityA = e0;
                pair.entityB = e1;
                pair.triggerA = (wb0.getCollisionFlags() & CF_NO_CONTACT_RESPONSE) !== 0;
                pair.triggerB = (wb1.getCollisionFlags() & CF_NO_CONTACT_RESPONSE) !== 0;
                pair.contactCount = numContacts;
                pair._manifold = manifold;

                listener.onContactPair(pair);
            }
        }

        pair.entityA = null;
        pair.entityB = null;
        pair._manifold = null;

        listener.onContactsEnd();
    }

    raycastFirst(start, end, options = {}) {
        let result = null;

        this._btRayStart.setValue(start.x, start.y, start.z);
        this._btRayEnd.setValue(end.x, end.y, end.z);
        const rayCallback = new Ammo.ClosestRayResultCallback(this._btRayStart, this._btRayEnd);
        applyRayOptions(rayCallback, options);

        this.nativeWorld.rayTest(this._btRayStart, this._btRayEnd, rayCallback);
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

    raycastAll(start, end, options = {}) {
        Debug.assert(Ammo.AllHitsRayResultCallback, 'AmmoPhysicsWorld#raycastAll: Your version of ammo.js does not expose Ammo.AllHitsRayResultCallback. Update it to latest.');

        const results = [];

        this._btRayStart.setValue(start.x, start.y, start.z);
        this._btRayEnd.setValue(end.x, end.y, end.z);
        const rayCallback = new Ammo.AllHitsRayResultCallback(this._btRayStart, this._btRayEnd);
        applyRayOptions(rayCallback, options);

        this.nativeWorld.rayTest(this._btRayStart, this._btRayEnd, rayCallback);
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
        }

        Ammo.destroy(rayCallback);

        return results;
    }
}

export { AmmoPhysicsWorld };
