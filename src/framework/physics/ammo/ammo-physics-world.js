import { Debug } from '../../../core/debug.js';
import { Vec3 } from '../../../core/math/vec3.js';
import {
    BODYFLAG_KINEMATIC_OBJECT, BODYFLAG_NORESPONSE_OBJECT,
    BODYSTATE_ACTIVE_TAG, BODYSTATE_DISABLE_DEACTIVATION, BODYSTATE_DISABLE_SIMULATION,
    BODYTYPE_KINEMATIC
} from '../../components/rigid-body/constants.js';
import { RaycastResult } from '../../components/rigid-body/raycast-result.js';
import { PhysicsWorld } from '../physics-world.js';
import { AmmoPhysicsBody } from './ammo-physics-body.js';
import { createJoint, destroyJoint, destroyFixedBody } from './ammo-physics-joint.js';

/**
 * @import { AmmoPhysicsJoint } from './ammo-physics-joint.js'
 */
import {
    createShape, destroyShape, addCompoundChild, updateCompoundChild, removeCompoundChild
} from './ammo-physics-shape.js';

/**
 * @import { ContactPoint } from '../../components/rigid-body/contact-point.js'
 * @import { PhysicsBodyDesc, PhysicsJointDesc, PhysicsShapeDesc } from '../physics-world.js'
 */

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
 * The Ammo.js (Bullet) physics backend. Expects the `Ammo` global to be available when
 * constructed - the RigidBodyComponentSystem only creates it after the Ammo WasmModule has
 * loaded.
 *
 * @ignore
 */
class AmmoPhysicsWorld extends PhysicsWorld {
    /** @private */
    _gravityFloat32 = new Float32Array(3);

    /**
     * Built triangle data cached per geometry source id, shared by all mesh shapes created
     * from the same geometry. Entries live until the world is destroyed.
     *
     * @type {Map<number, object>}
     * @ignore
     */
    _triMeshCache = new Map();

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
     * Create a new AmmoPhysicsWorld instance.
     *
     * @param {object} [options] - The world options. See {@link PhysicsWorld}.
     */
    constructor(options = {}) {
        super(options);

        this.collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
        this.dispatcher = new Ammo.btCollisionDispatcher(this.collisionConfiguration);
        this.overlappingPairCache = new Ammo.btDbvtBroadphase();
        this.solver = new Ammo.btSequentialImpulseConstraintSolver();
        this.nativeWorld = new Ammo.btDiscreteDynamicsWorld(this.dispatcher, this.overlappingPairCache, this.solver, this.collisionConfiguration);

        // report contacts per fixed substep from inside stepSimulation where supported,
        // otherwise defer to flushContacts()
        this._useTickCallback = !!this.nativeWorld.setInternalTickCallback;
        if (this._useTickCallback) {
            const checkForCollisionsPointer = Ammo.addFunction(() => this._walkContacts(), 'vif');
            this.nativeWorld.setInternalTickCallback(checkForCollisionsPointer);
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
        this._triMeshCache.forEach(triMesh => Ammo.destroy(triMesh));
        this._triMeshCache.clear();

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
            nativeBody.setCollisionFlags(nativeBody.getCollisionFlags() | BODYFLAG_KINEMATIC_OBJECT);
            nativeBody.setActivationState(BODYSTATE_DISABLE_DEACTIVATION);
        }
        if (noContactResponse) {
            nativeBody.setCollisionFlags(nativeBody.getCollisionFlags() | BODYFLAG_NORESPONSE_OBJECT);
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

        // kinematic bodies must never deactivate, everything else enters the active state
        nativeBody.forceActivationState(body._type === BODYTYPE_KINEMATIC ? BODYSTATE_DISABLE_DEACTIVATION : BODYSTATE_ACTIVE_TAG);
    }

    removeBody(body) {
        const nativeBody = body.nativeBody;
        this.nativeWorld.removeRigidBody(nativeBody);

        // set activation state to disable simulation so isActive() does not return true even
        // though the body is no longer in the world
        nativeBody.forceActivationState(BODYSTATE_DISABLE_SIMULATION);
    }

    /**
     * @param {PhysicsShapeDesc} desc - The shape descriptor.
     * @returns {object} The opaque shape handle (the native btCollisionShape).
     */
    createShape(desc) {
        return createShape(this, desc);
    }

    destroyShape(shape) {
        destroyShape(shape);
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
     */
    createJoint(desc) {
        return createJoint(this, desc);
    }

    destroyJoint(joint) {
        destroyJoint(this, joint);
    }

    /**
     * @param {Vec3} gravity - The world space gravity.
     */
    setGravity(gravity) {
        // downcast gravity to float32 so we can accurately compare with existing gravity set
        // in the world
        this._gravityFloat32[0] = gravity.x;
        this._gravityFloat32[1] = gravity.y;
        this._gravityFloat32[2] = gravity.z;

        // compare against the world's own value so writes through the native escape hatch are
        // still detected
        const current = this.nativeWorld.getGravity();
        if (current.x() !== this._gravityFloat32[0] ||
            current.y() !== this._gravityFloat32[1] ||
            current.z() !== this._gravityFloat32[2]) {
            current.setValue(gravity.x, gravity.y, gravity.z);
            this.nativeWorld.setGravity(current);
        }
    }

    step(dt, maxSubSteps, fixedTimeStep) {
        this._fixedTimeStep = fixedTimeStep;
        this.nativeWorld.stepSimulation(dt, maxSubSteps, fixedTimeStep);
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
                pair.triggerA = (wb0.getCollisionFlags() & BODYFLAG_NORESPONSE_OBJECT) !== 0;
                pair.triggerB = (wb1.getCollisionFlags() & BODYFLAG_NORESPONSE_OBJECT) !== 0;
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

        if (typeof options.filterCollisionGroup === 'number') {
            rayCallback.set_m_collisionFilterGroup(options.filterCollisionGroup);
        }

        if (typeof options.filterCollisionMask === 'number') {
            rayCallback.set_m_collisionFilterMask(options.filterCollisionMask);
        }

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

        if (typeof options.filterCollisionGroup === 'number') {
            rayCallback.set_m_collisionFilterGroup(options.filterCollisionGroup);
        }

        if (typeof options.filterCollisionMask === 'number') {
            rayCallback.set_m_collisionFilterMask(options.filterCollisionMask);
        }

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
