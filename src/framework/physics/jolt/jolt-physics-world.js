import { Debug } from '../../../core/debug.js';
import { Vec3 } from '../../../core/math/vec3.js';
import {
    BODYGROUP_DYNAMIC, BODYGROUP_STATIC, BODYMASK_ALL, BODYMASK_NOT_STATIC, BODYTYPE_DYNAMIC,
    BODYTYPE_KINEMATIC
} from '../../components/rigid-body/constants.js';
import { RaycastResult } from '../../components/rigid-body/raycast-result.js';
import { PhysicsWorld } from '../physics-world.js';
import { JoltContacts, pairKey } from './jolt-contacts.js';
import { probeHeapLayout } from './jolt-heap.js';
import { JoltPhysicsBody } from './jolt-physics-body.js';
import { createJoint, destroyJoint } from './jolt-physics-joint.js';
import {
    addCompoundChild, computeMassProperties, createShape, destroyShape, flushShapeChanges,
    releaseUnusedMeshes, removeCompoundChild, updateCompoundChild
} from './jolt-physics-shape.js';

/**
 * @import { JoltHeapLayout } from './jolt-heap.js'
 * @import { JoltPhysicsJoint } from './jolt-physics-joint.js'
 * @import { JoltMeshEntry } from './jolt-physics-shape.js'
 * @import { PhysicsBody } from '../physics-body.js'
 * @import { PhysicsBodyDesc, PhysicsJointDesc, PhysicsShapeDesc } from '../physics-world.js'
 */

// Broadphase layers: static bodies share a tree that moving bodies query unless their mask
// excludes static bodies, and that is never rebuilt for movement
const BROADPHASE_STATIC = 0;
const BROADPHASE_MOVING = 1;

// The engine's collision groups and masks are 16 bits each
const GROUP_BITS = 0xffff;

// How deep bodies may rest in each other, in meters (see the constructor)
const PENETRATION_SLOP = 0.005;

/**
 * Returns the Jolt object layer that holds an engine collision group and mask.
 *
 * @param {object} Jolt - The Jolt module.
 * @param {number} group - The collision group.
 * @param {number} mask - The collision mask.
 * @returns {number} The object layer.
 */
function getObjectLayer(Jolt, group, mask) {
    return Jolt.ObjectLayerPairFilterMask.prototype.sGetObjectLayer(group & GROUP_BITS,
        mask & GROUP_BITS);
}

/**
 * The Jolt Physics backend, built on JoltPhysics.js - the WebAssembly port of the Jolt Physics
 * engine. JoltPhysics.js is an ES module that creates no global, so the initialized module is
 * passed to the constructor. Load the library first, then supply the backend to the application:
 *
 * ```javascript
 * import initJolt from 'jolt-physics/wasm';
 *
 * const Jolt = await initJolt();
 *
 * const options = new AppOptions();
 * options.physicsWorld = new JoltPhysicsWorld(Jolt);
 * ```
 *
 * The single-threaded flavors of the library (`wasm`, `wasm-compat` and `asm`) are supported.
 *
 * Physics components behave as they do with the Ammo backend, apart from these differences:
 *
 * - Fast dynamic bodies use continuous collision detection, so they do not pass through thin
 * colliders the way they can with Ammo.
 * - Rolling friction is not supported.
 * - Linear and angular factors can only lock an axis: any factor other than 0 leaves the axis
 * free.
 * - Angular velocity is limited to about 47 radians per second, Jolt's default.
 * - Contact impulses are estimated from the speed at which the two bodies meet, as Jolt does not
 * report the impulses its solver applies.
 *
 * @category Physics
 * @alpha
 */
class JoltPhysicsWorld extends PhysicsWorld {
    /**
     * The Jolt module.
     *
     * @type {object}
     * @ignore
     */
    _jolt;

    /**
     * The native JoltInterface, owning the physics system and its filters.
     *
     * @type {object}
     * @ignore
     */
    _joltInterface;

    /**
     * The native PhysicsSystem.
     *
     * @type {object}
     * @ignore
     */
    _system;

    /**
     * The native BodyInterface.
     *
     * @type {object}
     * @ignore
     */
    _bodyInterface;

    /**
     * Where the Jolt data read straight from the module heap lives, or null to go through the
     * bindings.
     *
     * @type {JoltHeapLayout|null}
     * @ignore
     */
    _layout = null;

    /**
     * Jolt's static body that world-pinned joints attach to.
     *
     * @type {object}
     * @ignore
     */
    _fixedToWorld;

    /**
     * The speed below which Jolt applies no restitution, used by contact impulse estimates.
     *
     * @ignore
     */
    _minRestitutionVelocity = 1;

    /**
     * Bodies keyed by the address of their native body, for contact callbacks, and by the index
     * and sequence number of their body ID, for queries and removed contacts.
     *
     * @type {Map<number, JoltPhysicsBody>}
     * @ignore
     */
    _bodiesByPointer = new Map();

    /**
     * @type {Map<number, JoltPhysicsBody>}
     * @ignore
     */
    _bodiesById = new Map();

    /**
     * Dynamic bodies in the simulation, for interpolation.
     *
     * @type {JoltPhysicsBody[]}
     * @private
     */
    _dynamicBodies = [];

    /**
     * Kinematic bodies in the simulation, whose targets are applied before each step.
     *
     * @type {JoltPhysicsBody[]}
     * @private
     */
    _kinematicBodies = [];

    /**
     * Bodies with a force or torque applied since the last step.
     *
     * @type {JoltPhysicsBody[]}
     * @private
     */
    _forceBodies = [];

    /**
     * Every live shape handle, released with the world if its component did not release it.
     *
     * @type {Set<object>}
     * @ignore
     */
    _shapes = new Set();

    /**
     * Compound shapes changed since the bodies using them were last updated.
     *
     * @type {Set<object>}
     * @ignore
     */
    _dirtyCompounds = new Set();

    /**
     * Unit scale triangle meshes cached per geometry source id and shared by every collider built
     * from the same geometry, reference counted by those colliders.
     *
     * @type {Map<number, JoltMeshEntry>}
     * @ignore
     */
    _meshCache = new Map();

    /**
     * Cached meshes whose reference count dropped to zero since the last step.
     *
     * @type {Set<JoltMeshEntry>}
     * @ignore
     */
    _unusedMeshes = new Set();

    /**
     * Every live joint, and the joints with a finite break impulse.
     *
     * @type {Set<JoltPhysicsJoint>}
     * @private
     */
    _joints = new Set();

    /**
     * @type {Set<JoltPhysicsJoint>}
     * @ignore
     */
    _breakableJoints = new Set();

    /**
     * The number of joints disabling collision between each pair of bodies, keyed by pairKey.
     *
     * @type {Map<number, number>}
     * @ignore
     */
    _noCollisionPairs = new Map();

    /**
     * The time accumulated towards the next fixed substep.
     *
     * @private
     */
    _localTime = 0;

    /**
     * How far the presented poses of dynamic bodies are from the pose before the last substep
     * to the current one, from 0 to 1.
     *
     * @ignore
     */
    _interpolation = 1;

    /**
     * The duration of the last substep.
     *
     * @ignore
     */
    _fixedTimeStep = 1 / 60;

    /**
     * @type {JoltContacts}
     * @private
     */
    _contacts;

    /**
     * Ray query filters per object layer.
     *
     * @type {Map<number, { broadPhase: object, object: object }>}
     * @private
     */
    _rayFilters = new Map();

    /**
     * Reused native temporaries.
     *
     * @ignore
     */
    _vec;

    /** @ignore */
    _vec2;

    /** @ignore */
    _rvec;

    /** @ignore */
    _quat;

    /** @private */
    _ray;

    /** @private */
    _raySettings;

    /** @private */
    _closestHit;

    /** @private */
    _allHits;

    /** @private */
    _bodyFilter;

    /** @private */
    _shapeFilter;

    /**
     * Create a new JoltPhysicsWorld instance.
     *
     * @param {object} jolt - The initialized JoltPhysics.js module, as its default export
     * resolves it.
     */
    constructor(jolt) {
        super();

        Debug.assert(jolt && typeof jolt.JoltInterface === 'function',
            'JoltPhysicsWorld: pass the initialized JoltPhysics.js module to the constructor.');
        Debug.call(() => {
            if (typeof SharedArrayBuffer !== 'undefined' &&
                jolt.HEAP8?.buffer instanceof SharedArrayBuffer) {
                Debug.warn('JoltPhysicsWorld: only the single-threaded builds of JoltPhysics.js ' +
                    'are supported.');
            }
        });

        const Jolt = jolt;
        this._jolt = Jolt;

        // collision filtering by the engine's groups and masks, packed into Jolt's 32 bit object
        // layers: two bodies collide when each one's group is in the other's mask, as in Bullet
        const broadPhase = new Jolt.BroadPhaseLayerInterfaceMask(2);
        const staticLayer = new Jolt.BroadPhaseLayer(BROADPHASE_STATIC);
        const movingLayer = new Jolt.BroadPhaseLayer(BROADPHASE_MOVING);
        broadPhase.ConfigureLayer(staticLayer, BODYGROUP_STATIC, 0);
        broadPhase.ConfigureLayer(movingLayer, GROUP_BITS & ~BODYGROUP_STATIC, 0);
        Jolt.destroy(staticLayer);
        Jolt.destroy(movingLayer);

        const settings = new Jolt.JoltSettings();
        settings.mBroadPhaseLayerInterface = broadPhase;
        settings.mObjectVsBroadPhaseLayerFilter =
            new Jolt.ObjectVsBroadPhaseLayerFilterMask(broadPhase);
        settings.mObjectLayerPairFilter = new Jolt.ObjectLayerPairFilterMask();

        // the interface takes ownership of the filters
        this._joltInterface = new Jolt.JoltInterface(settings);
        Jolt.destroy(settings);

        this._system = this._joltInterface.GetPhysicsSystem();
        this._bodyInterface = this._system.GetBodyInterface();
        this.nativeWorld = this._system;
        this._fixedToWorld = Jolt.JoltInterface.prototype.sGetFixedToWorldBody();

        // Jolt leaves bodies sunk into each other by up to the penetration slop after an impact,
        // 2 cm by default, where Ammo bodies come to rest on the surface; 5 mm is barely visible
        // and still lets stacks and piles settle and sleep
        const physicsSettings = this._system.GetPhysicsSettings();
        physicsSettings.mPenetrationSlop = PENETRATION_SLOP;
        this._system.SetPhysicsSettings(physicsSettings);
        this._minRestitutionVelocity = physicsSettings.mMinVelocityForRestitution;

        this._vec = new Jolt.Vec3();
        this._vec2 = new Jolt.Vec3();
        this._rvec = new Jolt.RVec3();
        this._quat = new Jolt.Quat();

        this._ray = new Jolt.RRayCast();
        this._raySettings = new Jolt.RayCastSettings();
        // like Bullet, a ray starting inside a convex shape does not hit it, and never hits the
        // back of one
        this._raySettings.mTreatConvexAsSolid = false;
        this._raySettings.mBackFaceModeConvex = Jolt.EBackFaceMode_IgnoreBackFaces;
        this._closestHit = new Jolt.CastRayClosestHitCollisionCollector();
        this._allHits = new Jolt.CastRayAllHitCollisionCollector();
        this._bodyFilter = new Jolt.BodyFilter();
        this._shapeFilter = new Jolt.ShapeFilter();

        this._layout = probeHeapLayout(Jolt, this._bodyInterface);
        this._contacts = new JoltContacts(this);
    }

    destroy() {
        const Jolt = this._jolt;

        this._contacts.destroy();

        this._joints.forEach(joint => destroyJoint(this, joint));
        this._joints.clear();

        // the physics system frees the bodies left in it
        this._bodiesByPointer.clear();
        this._bodiesById.clear();
        this._dynamicBodies.length = 0;
        this._kinematicBodies.length = 0;
        this._forceBodies.length = 0;

        this._shapes.forEach(shape => destroyShape(this, shape));
        this._meshCache.forEach(entry => entry.shape.Release());
        this._meshCache.clear();
        this._unusedMeshes.clear();

        this._rayFilters.forEach((filters) => {
            Jolt.destroy(filters.broadPhase);
            Jolt.destroy(filters.object);
        });
        this._rayFilters.clear();

        Jolt.destroy(this._ray);
        Jolt.destroy(this._raySettings);
        Jolt.destroy(this._closestHit);
        Jolt.destroy(this._allHits);
        Jolt.destroy(this._bodyFilter);
        Jolt.destroy(this._shapeFilter);
        Jolt.destroy(this._vec);
        Jolt.destroy(this._vec2);
        Jolt.destroy(this._rvec);
        Jolt.destroy(this._quat);

        Jolt.destroy(this._joltInterface);
        this._contacts.destroyListener();

        this._joltInterface = null;
        this._system = null;
        this._bodyInterface = null;
        this.nativeWorld = null;
    }

    /**
     * @param {PhysicsBodyDesc} desc - The body descriptor.
     * @returns {PhysicsBody} The new body.
     * @ignore
     */
    createBody(desc) {
        const Jolt = this._jolt;
        const { type, mass, shape, position, rotation, entity } = desc;
        const sensor = !!desc.noContactResponse;

        Debug.call(() => {
            const com = shape.GetCenterOfMass();
            Debug.assert(com.GetX() === 0 && com.GetY() === 0 && com.GetZ() === 0,
                'JoltPhysicsWorld: bodies need shapes created by this world, with their center ' +
                'of mass at their origin.');
        });

        // triggers are kinematic sensors that never sleep, so they detect sleeping and kinematic
        // bodies, as Ammo triggers do
        let motionType;
        if (sensor || type === BODYTYPE_KINEMATIC) {
            motionType = Jolt.EMotionType_Kinematic;
        } else if (type === BODYTYPE_DYNAMIC) {
            motionType = Jolt.EMotionType_Dynamic;
        } else {
            motionType = Jolt.EMotionType_Static;
        }

        this._rvec.Set(position.x, position.y, position.z);
        this._quat.Set(rotation.x, rotation.y, rotation.z, rotation.w);

        // the object layer is set when the body is added with its group and mask
        const settings = new Jolt.BodyCreationSettings(shape, this._rvec, this._quat,
            motionType, 0);
        settings.mLinearDamping = 0;
        settings.mAngularDamping = 0;
        if (motionType === Jolt.EMotionType_Kinematic) {
            settings.mAllowSleeping = false;
        }
        if (sensor) {
            settings.mIsSensor = true;
            settings.mCollideKinematicVsNonDynamic = true;
        }
        if (motionType === Jolt.EMotionType_Dynamic) {
            // Jolt sweeps a body that moves further than a fraction of its size in a substep, so
            // projectiles do not pass through what they hit; slower bodies cost nothing extra
            settings.mMotionQuality = Jolt.EMotionQuality_LinearCast;
            settings.mOverrideMassProperties = Jolt.EOverrideMassProperties_MassAndInertiaProvided;
            settings.mMassPropertiesOverride = computeMassProperties(this, shape, mass);
            if (!(mass > 0)) {
                // a dynamic body without mass cannot move, as in Bullet
                settings.mAllowedDOFs = 0;
            }
        }

        const nativeBody = this._bodyInterface.CreateBody(settings);
        Jolt.destroy(settings);

        if (!nativeBody) {
            Debug.error('JoltPhysicsWorld: cannot create a body. The maximum number of bodies ' +
                'has been reached.');
            return super.createBody(desc);
        }

        const body = new JoltPhysicsBody(this, nativeBody, type, motionType, sensor, shape, mass);
        body.entity = entity ?? null;

        this._bodiesByPointer.set(Jolt.getPointer(nativeBody), body);
        this._bodiesById.set(body._idValue, body);
        shape._bodies?.add(body);

        return body;
    }

    destroyBody(body) {
        if (!(body instanceof JoltPhysicsBody) || !body.nativeBody) {
            return;
        }

        if (body._inWorld) {
            this.removeBody(body);
        }
        this._contacts.removeBody(body);

        body._shape._bodies?.delete(body);
        this._bodiesByPointer.delete(this._jolt.getPointer(body.nativeBody));
        this._bodiesById.delete(body._idValue);

        this._bodyInterface.DestroyBody(body._id);
        body.nativeBody = null;
        body._id = null;
    }

    addBody(body, group, mask) {
        if (!(body instanceof JoltPhysicsBody) || !body.nativeBody || body._inWorld) {
            return;
        }

        const Jolt = this._jolt;

        // Bullet's defaults when no filter is given: dynamic bodies collide with everything,
        // others with everything but static bodies
        if (group === undefined || mask === undefined) {
            const dynamic = body._motionType === Jolt.EMotionType_Dynamic;
            group = dynamic ? BODYGROUP_DYNAMIC : BODYGROUP_STATIC;
            mask = dynamic ? BODYMASK_ALL : BODYMASK_NOT_STATIC;
        }

        this._bodyInterface.SetObjectLayer(body._id, getObjectLayer(Jolt, group, mask));

        // kinematic bodies never sleep (see createBody), everything else starts awake
        const activation = body._motionType === Jolt.EMotionType_Static ?
            Jolt.EActivation_DontActivate : Jolt.EActivation_Activate;
        this._bodyInterface.AddBody(body._id, activation);
        body._inWorld = true;

        if (body._motionType === Jolt.EMotionType_Dynamic) {
            this._listAdd(this._dynamicBodies, body);
        } else if (body._motionType === Jolt.EMotionType_Kinematic && !body._sensor) {
            this._listAdd(this._kinematicBodies, body);
        }

        // interpolation starts from the pose the body enters the simulation with
        body._capturePose();
    }

    removeBody(body) {
        if (!(body instanceof JoltPhysicsBody) || !body._inWorld) {
            return;
        }

        this._bodyInterface.RemoveBody(body._id);
        body._inWorld = false;
        body._hasTarget = false;

        if (body._listIndex >= 0) {
            this._listRemove(body._motionType === this._jolt.EMotionType_Dynamic ?
                this._dynamicBodies : this._kinematicBodies, body);
        }

        this._contacts.removeBody(body);
    }

    /**
     * @param {PhysicsShapeDesc} desc - The shape descriptor.
     * @returns {object} The opaque shape handle (the native Jolt Shape).
     * @ignore
     */
    createShape(desc) {
        return createShape(this, desc);
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
        removeCompoundChild(this, compound, child);
    }

    getCompoundChildCount(compound) {
        return compound._children ? compound._children.length : 0;
    }

    /**
     * @param {PhysicsJointDesc} desc - The joint descriptor.
     * @returns {JoltPhysicsJoint} The new joint.
     * @ignore
     */
    createJoint(desc) {
        const joint = createJoint(this, desc);
        this._joints.add(joint);
        return joint;
    }

    destroyJoint(joint) {
        if (joint.nativeJoint) {
            this._joints.delete(joint);
            destroyJoint(this, joint);
        }
    }

    /**
     * @param {Vec3} gravity - The world space gravity.
     * @ignore
     */
    setGravity(gravity) {
        this._vec.Set(gravity.x, gravity.y, gravity.z);
        this._system.SetGravity(this._vec);
    }

    step(dt, maxSubSteps, fixedTimeStep) {
        let steps = 0;
        let stepSize = fixedTimeStep;

        if (maxSubSteps > 0) {
            // fixed substeps, taken as Bullet's stepSimulation takes them: the time left over
            // carries to the next step and is interpolated, and the time beyond the maximum
            // number of substeps is dropped
            this._localTime += dt;
            if (this._localTime >= fixedTimeStep) {
                steps = Math.floor(this._localTime / fixedTimeStep);
                this._localTime -= steps * fixedTimeStep;
            }
            steps = Math.min(steps, maxSubSteps);
        } else {
            // a single substep of the whole time
            stepSize = dt;
            steps = dt > 0 ? 1 : 0;
            this._localTime = 0;
        }

        flushShapeChanges(this);

        if (steps > 0) {
            this._fixedTimeStep = stepSize;
            this._applyKinematicTargets(steps * stepSize);

            const contacts = this._contacts;
            for (let i = 0; i < steps; i++) {
                this._applyForces();

                if (i === steps - 1) {
                    this._capturePoses();
                }

                contacts.beginPass();
                this._joltInterface.Step(stepSize, 1);
                contacts.endPass();

                this._checkBrokenJoints();

                // contact event handlers may have changed compound shapes
                flushShapeChanges(this);
            }
        }

        // like Bullet, forces apply to every substep of the step they were added in, then clear
        this._clearForces();

        this._interpolation = maxSubSteps > 0 ? this._localTime / fixedTimeStep : 1;

        releaseUnusedMeshes(this);
    }

    raycastFirst(start, end, options = {}) {
        const collector = this._closestHit;
        collector.Reset();
        this._castRay(start, end, options, collector);

        if (!collector.HadHit()) {
            return null;
        }
        const hit = collector.mHit;
        const body = this._bodiesById.get(hit.mBodyID.GetIndexAndSequenceNumber() >>> 0);
        return body ? this._createRaycastResult(hit, start, end, body) : null;
    }

    raycastAll(start, end, options = {}) {
        const collector = this._allHits;
        collector.Reset();
        this._castRay(start, end, options, collector);

        const results = [];
        const hits = collector.mHits;
        const numHits = hits.size();
        for (let i = 0; i < numHits; i++) {
            const hit = hits.at(i);
            const body = this._bodiesById.get(hit.mBodyID.GetIndexAndSequenceNumber() >>> 0);
            const entity = body?.entity;

            if (!body || !entity ||
                options.filterTags && !entity.tags.has(...options.filterTags) ||
                options.filterCallback && !options.filterCallback(entity)) {
                continue;
            }

            results.push(this._createRaycastResult(hit, start, end, body));
        }

        return results;
    }

    get supportsMeshScaling() {
        return true;
    }

    /**
     * Casts a ray into the world with the options shared by all ray queries.
     *
     * @param {Vec3} start - The world space start point.
     * @param {Vec3} end - The world space end point.
     * @param {object} options - The raycast options.
     * @param {object} collector - The native hit collector.
     * @private
     */
    _castRay(start, end, options, collector) {
        const Jolt = this._jolt;

        // compound shapes changed since the last step must be in place for the query
        flushShapeChanges(this);

        // Bullet's default ray filter: group 1, all mask bits
        const { filterCollisionGroup, filterCollisionMask } = options;
        const group = typeof filterCollisionGroup === 'number' ? filterCollisionGroup : 1;
        const mask = typeof filterCollisionMask === 'number' ? filterCollisionMask : GROUP_BITS;
        const filters = this._getRayFilters(getObjectLayer(Jolt, group, mask));

        const ray = this._ray;
        this._rvec.Set(start.x, start.y, start.z);
        ray.mOrigin = this._rvec;
        this._vec.Set(end.x - start.x, end.y - start.y, end.z - start.z);
        ray.mDirection = this._vec;

        const settings = this._raySettings;
        settings.mBackFaceModeTriangles = options.hitBackFaces === false ?
            Jolt.EBackFaceMode_IgnoreBackFaces : Jolt.EBackFaceMode_CollideWithBackFaces;

        this._system.GetNarrowPhaseQuery().CastRay(ray, settings, collector, filters.broadPhase,
            filters.object, this._bodyFilter, this._shapeFilter);
    }

    /**
     * Returns the query filters for rays in an object layer, creating them on first use.
     *
     * @param {number} layer - The object layer of the ray.
     * @returns {{ broadPhase: object, object: object }} The filters.
     * @private
     */
    _getRayFilters(layer) {
        let filters = this._rayFilters.get(layer);
        if (!filters) {
            const Jolt = this._jolt;
            const joltInterface = this._joltInterface;
            const broadPhaseFilter = joltInterface.GetObjectVsBroadPhaseLayerFilter();
            const objectFilter = joltInterface.GetObjectLayerPairFilter();
            filters = {
                broadPhase: new Jolt.DefaultBroadPhaseLayerFilter(broadPhaseFilter, layer),
                object: new Jolt.DefaultObjectLayerFilter(objectFilter, layer)
            };
            this._rayFilters.set(layer, filters);
        }
        return filters;
    }

    /**
     * @param {object} hit - The native RayCastResult.
     * @param {Vec3} start - The world space start point of the ray.
     * @param {Vec3} end - The world space end point of the ray.
     * @param {JoltPhysicsBody} body - The body hit.
     * @returns {RaycastResult} The result.
     * @private
     */
    _createRaycastResult(hit, start, end, body) {
        const fraction = hit.mFraction;
        const point = new Vec3().lerp(start, end, fraction);

        this._rvec.Set(point.x, point.y, point.z);
        const n = body.nativeBody.GetWorldSpaceSurfaceNormal(hit.mSubShapeID2, this._rvec);
        const normal = new Vec3(n.GetX(), n.GetY(), n.GetZ());

        // a back face hit reports the normal flipped to face the start of the ray, as in Bullet
        const dot = normal.x * (end.x - start.x) + normal.y * (end.y - start.y) +
            normal.z * (end.z - start.z);
        if (dot > 0) {
            normal.mulScalar(-1);
        }

        return new RaycastResult(body.entity, point, normal, fraction);
    }

    /**
     * Drives each kinematic body with a target towards it over the time the step simulates, so
     * it arrives at the end of the last substep and pushes dynamic bodies at the speed it moves.
     *
     * @param {number} duration - The time the step simulates.
     * @private
     */
    _applyKinematicTargets(duration) {
        const bodies = this._kinematicBodies;
        const rvec = this._rvec;
        const quat = this._quat;
        for (let i = 0; i < bodies.length; i++) {
            const body = bodies[i];
            if (body._hasTarget) {
                const p = body._targetPosition;
                const q = body._targetRotation;
                rvec.Set(p.x, p.y, p.z);
                quat.Set(q.x, q.y, q.z, q.w);
                body.nativeBody.MoveKinematic(rvec, quat, duration);
                body._hasTarget = false;
            }
        }
    }

    /**
     * Registers a body with a force or torque to apply at the next step.
     *
     * @param {JoltPhysicsBody} body - The body.
     * @ignore
     */
    _addForceBody(body) {
        if (!body._hasForce) {
            body._hasForce = true;
            this._forceBodies.push(body);
        }
    }

    /** @private */
    _applyForces() {
        const bodies = this._forceBodies;
        for (let i = 0; i < bodies.length; i++) {
            const body = bodies[i];
            if (body._inWorld) {
                body._applyForces();
            }
        }
    }

    /** @private */
    _clearForces() {
        const bodies = this._forceBodies;
        for (let i = 0; i < bodies.length; i++) {
            bodies[i]._clearForces();
        }
        bodies.length = 0;
    }

    /**
     * Records the pose of every dynamic body before the last substep of a step, the pose
     * interpolation starts from.
     *
     * @private
     */
    _capturePoses() {
        const bodies = this._dynamicBodies;
        for (let i = 0; i < bodies.length; i++) {
            bodies[i]._capturePose();
        }
    }

    /** @private */
    _checkBrokenJoints() {
        this._breakableJoints.forEach(joint => joint._checkBreak());
    }

    /**
     * Enables or disables collision between two bodies, counting the joints that disable it.
     *
     * @param {JoltPhysicsBody} bodyA - A body.
     * @param {JoltPhysicsBody} bodyB - The other body.
     * @param {boolean} enable - True to release one joint's hold on the pair, false to add one.
     * @ignore
     */
    _setPairCollision(bodyA, bodyB, enable) {
        const pairs = this._noCollisionPairs;
        const key = pairKey(bodyA, bodyB);
        const count = (pairs.get(key) ?? 0) + (enable ? -1 : 1);
        if (count > 0) {
            pairs.set(key, count);
        } else {
            pairs.delete(key);
        }

        // Jolt reuses the contacts it cached for a pair, empty or not, while the two bodies keep
        // their relative pose, without validating them again
        if (count === (enable ? 0 : 1)) {
            this._bodyInterface.InvalidateContactCache(bodyA._id);
        }
    }

    /**
     * @param {JoltPhysicsBody[]} list - A body list.
     * @param {JoltPhysicsBody} body - The body to add.
     * @private
     */
    _listAdd(list, body) {
        body._listIndex = list.length;
        list.push(body);
    }

    /**
     * @param {JoltPhysicsBody[]} list - A body list.
     * @param {JoltPhysicsBody} body - The body to remove.
     * @private
     */
    _listRemove(list, body) {
        const index = body._listIndex;
        const last = /** @type {JoltPhysicsBody} */ (list.pop());
        if (last !== body) {
            list[index] = last;
            last._listIndex = index;
        }
        body._listIndex = -1;
    }
}

export { JoltPhysicsWorld };
