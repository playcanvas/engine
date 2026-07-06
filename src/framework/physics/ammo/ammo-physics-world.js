import { Debug } from '../../../core/debug.js';
import {
    BODYFLAG_KINEMATIC_OBJECT, BODYFLAG_NORESPONSE_OBJECT,
    BODYSTATE_ACTIVE_TAG, BODYSTATE_DISABLE_DEACTIVATION, BODYSTATE_DISABLE_SIMULATION,
    BODYTYPE_KINEMATIC
} from '../../components/rigid-body/constants.js';
import { PhysicsWorld } from '../physics-world.js';
import { AmmoPhysicsBody } from './ammo-physics-body.js';
import {
    createShape, destroyShape, addCompoundChild, updateCompoundChild, removeCompoundChild
} from './ammo-physics-shape.js';

/**
 * @import { Vec3 } from '../../../core/math/vec3.js'
 * @import { PhysicsBodyDesc, PhysicsShapeDesc } from '../physics-world.js'
 */

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
     * Create a new AmmoPhysicsWorld instance.
     *
     * @param {object} [options] - The world options.
     * @param {Function} [options.onTick] - Raw simulation tick callback, invoked per fixed
     * substep with (worldPointer, timeStep) on ammo builds that support internal tick
     * callbacks.
     */
    constructor(options = {}) {
        super(options);

        this.collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
        this.dispatcher = new Ammo.btCollisionDispatcher(this.collisionConfiguration);
        this.overlappingPairCache = new Ammo.btDbvtBroadphase();
        this.solver = new Ammo.btSequentialImpulseConstraintSolver();
        this.nativeWorld = new Ammo.btDiscreteDynamicsWorld(this.dispatcher, this.overlappingPairCache, this.solver, this.collisionConfiguration);

        if (this.nativeWorld.setInternalTickCallback) {
            const checkForCollisionsPointer = Ammo.addFunction(options.onTick, 'vif');
            this.nativeWorld.setInternalTickCallback(checkForCollisionsPointer);
        } else {
            Debug.warn('WARNING: This version of ammo.js can potentially fail to report contacts. Please update it to the latest version.');
        }

        // cached math temporaries, shared by this world's bodies
        this._btVec1 = new Ammo.btVector3();
        this._btVec2 = new Ammo.btVector3();
        this._btQuat = new Ammo.btQuaternion();
        this._btTransform = new Ammo.btTransform();
    }

    destroy() {
        this._triMeshCache.forEach(triMesh => Ammo.destroy(triMesh));
        this._triMeshCache.clear();

        Ammo.destroy(this._btVec1);
        Ammo.destroy(this._btVec2);
        Ammo.destroy(this._btQuat);
        Ammo.destroy(this._btTransform);
        this._btVec1 = null;
        this._btVec2 = null;
        this._btQuat = null;
        this._btTransform = null;

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
        this.nativeWorld.stepSimulation(dt, maxSubSteps, fixedTimeStep);
    }
}

export { AmmoPhysicsWorld };
