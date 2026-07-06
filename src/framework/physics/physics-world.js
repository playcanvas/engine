import { PhysicsBody } from './physics-body.js';
import { PhysicsJoint } from './physics-joint.js';

/**
 * @import { Entity } from '../entity.js'
 * @import { Mat4 } from '../../core/math/mat4.js'
 * @import { Quat } from '../../core/math/quat.js'
 * @import { Vec2 } from '../../core/math/vec2.js'
 * @import { Vec3 } from '../../core/math/vec3.js'
 * @import { ContactPoint } from '../components/rigid-body/contact-point.js'
 * @import { RaycastResult } from '../components/rigid-body/raycast-result.js'
 */

/**
 * @typedef {object} PhysicsBodyDesc
 * @property {string} type - The body type: BODYTYPE_STATIC, BODYTYPE_DYNAMIC or
 * BODYTYPE_KINEMATIC.
 * @property {number} mass - The construction mass. Callers pass 0 for non-dynamic bodies.
 * @property {object} shape - An opaque collision shape handle created by
 * {@link PhysicsWorld#createShape}.
 * @property {Vec3} position - The initial world space position. Collision component offsets are
 * already applied by the caller.
 * @property {Quat} rotation - The initial world space rotation.
 * @property {Entity|null} entity - The entity this body simulates. Surfaced by raycast and
 * contact results.
 * @property {boolean} [noContactResponse] - When true, the body collides and reports contacts
 * but does not respond to them (used for triggers). Defaults to false.
 */

/**
 * @typedef {object} PhysicsMeshSource
 * @property {number} id - A stable cache key for the source geometry (mesh id). Backends may
 * cache built triangle data per id for the lifetime of the world.
 * @property {Float32Array|number[]} positions - Vertex positions, possibly interleaved.
 * @property {number} stride - The number of floats between consecutive positions (3 when
 * tightly packed).
 * @property {number[]|Uint16Array|Uint32Array} indices - Triangle indices. Ignored when
 * convexHull is true.
 * @property {number} base - The first index to read.
 * @property {number} count - The number of indices to read (a multiple of 3). Ignored when
 * convexHull is true - hulls consume every position.
 * @property {boolean} convexHull - Build a convex hull instead of a triangle mesh.
 * @property {boolean} checkDuplicates - Weld duplicate vertices while building triangle data.
 * @property {Vec3|null} shapeScale - Scaling to apply to the built sub-shape, or null.
 * @property {Vec3} position - The sub-shape position within the mesh shape. Collision component
 * offsets are already applied by the caller.
 * @property {Quat} rotation - The sub-shape rotation within the mesh shape.
 */

/**
 * @typedef {object} PhysicsShapeDesc
 * @property {string} type - The shape type: 'box', 'sphere', 'capsule', 'cylinder', 'cone',
 * 'mesh' or 'compound'.
 * @property {Vec3} [halfExtents] - The box half extents.
 * @property {number} [radius] - The sphere/capsule/cylinder/cone radius.
 * @property {number} [height] - The full capsule/cylinder/cone height along the alignment axis.
 * Backends convert to their own conventions.
 * @property {number} [axis] - The capsule/cylinder/cone alignment axis: 0 (X), 1 (Y) or 2 (Z).
 * @property {PhysicsMeshSource[]} [sources] - The geometry sources of a 'mesh' shape. Mesh
 * shapes are created in one atomic call so backends may build immutable composites.
 * @property {Vec3|null} [scale] - Whole-shape scaling of a 'mesh' shape, or null.
 */

/**
 * The parameter bag consumed by {@link PhysicsWorld#createJoint} and the PhysicsJoint update
 * methods. JointComponent structurally satisfies this contract and passes itself.
 *
 * @typedef {object} PhysicsJointSettings
 * @property {boolean} enableLimits - Whether hinge/slider limits are enabled.
 * @property {Vec2} limits - The hinge (degrees) or slider (meters) limits.
 * @property {number} motorSpeed - The hinge (deg/s) or slider (m/s) motor speed.
 * @property {number} maxMotorForce - The maximum motor force. The motor is engaged while > 0.
 * @property {number} swingLimitY - The ball joint swing limit around Y in degrees.
 * @property {number} swingLimitZ - The ball joint swing limit around Z in degrees.
 * @property {number} twistLimit - The ball joint twist limit in degrees.
 * @property {string} linearMotionX - MOTION_FREE, MOTION_LIMITED or MOTION_LOCKED.
 * @property {string} linearMotionY - MOTION_FREE, MOTION_LIMITED or MOTION_LOCKED.
 * @property {string} linearMotionZ - MOTION_FREE, MOTION_LIMITED or MOTION_LOCKED.
 * @property {Vec2} linearLimitsX - The 6dof linear limits along X in meters.
 * @property {Vec2} linearLimitsY - The 6dof linear limits along Y in meters.
 * @property {Vec2} linearLimitsZ - The 6dof linear limits along Z in meters.
 * @property {Vec3} linearStiffness - The 6dof linear spring stiffness per axis.
 * @property {Vec3} linearDamping - The 6dof linear spring damping per axis.
 * @property {Vec3} linearEquilibrium - The 6dof linear spring equilibrium point per axis.
 * @property {string} angularMotionX - MOTION_FREE, MOTION_LIMITED or MOTION_LOCKED.
 * @property {string} angularMotionY - MOTION_FREE, MOTION_LIMITED or MOTION_LOCKED.
 * @property {string} angularMotionZ - MOTION_FREE, MOTION_LIMITED or MOTION_LOCKED.
 * @property {Vec2} angularLimitsX - The 6dof angular limits around X in degrees.
 * @property {Vec2} angularLimitsY - The 6dof angular limits around Y in degrees.
 * @property {Vec2} angularLimitsZ - The 6dof angular limits around Z in degrees.
 * @property {Vec3} angularStiffness - The 6dof angular spring stiffness per axis.
 * @property {Vec3} angularDamping - The 6dof angular spring damping per axis.
 * @property {Vec3} angularEquilibrium - The 6dof angular spring equilibrium per axis in degrees.
 */

/**
 * @typedef {object} PhysicsJointDesc
 * @property {string} type - The joint type: JOINTTYPE_FIXED, JOINTTYPE_BALL, JOINTTYPE_HINGE,
 * JOINTTYPE_SLIDER or JOINTTYPE_6DOF.
 * @property {PhysicsBody} bodyA - The first constrained body.
 * @property {PhysicsBody|null} bodyB - The second constrained body, or null to anchor the joint
 * to the world (the backend supplies its own fixed anchor body).
 * @property {Mat4} frameA - The joint frame in body A's local space, as a scale-free matrix
 * with X as the primary joint axis by engine convention. Backends apply their own native axis
 * corrections. Only valid during the call.
 * @property {Mat4} frameB - The joint frame in body B's local space (or world space when bodyB
 * is null).
 * @property {boolean} enableCollision - Whether the two bodies keep colliding with each other.
 * Creation-time only - changing it recreates the joint.
 * @property {PhysicsJointSettings} settings - The full parameter bag, applied at creation.
 */

/**
 * A single contacting body pair reported to the {@link PhysicsContactListener}. Backends reuse
 * one instance per world - it is only valid inside onContactPair and must never be retained.
 *
 * @typedef {object} PhysicsContactPair
 * @property {Entity} entityA - The entity owning the first body.
 * @property {Entity} entityB - The entity owning the second body.
 * @property {boolean} triggerA - True if the first body has no contact response.
 * @property {boolean} triggerB - True if the second body has no contact response.
 * @property {number} contactCount - The number of contact points (always >= 1).
 * @property {(index: number, out: ContactPoint) => void} readContact - Fills out with contact
 * point index from A's perspective, allocation free.
 */

/**
 * Receives contact reports from a {@link PhysicsWorld}. The world runs one complete contact
 * pass - onContactsBegin, zero or more onContactPair, onContactsEnd - once per simulation
 * substep where the backend supports substep granularity, otherwise at least once per step.
 *
 * @typedef {object} PhysicsContactListener
 * @property {() => void} onContactsBegin - Called when a contact pass begins.
 * @property {(pair: PhysicsContactPair) => void} onContactPair - Called for each contacting
 * pair. Pairs with no contact points or without entities on both bodies are not reported.
 * @property {() => void} onContactsEnd - Called when a contact pass ends.
 */

/**
 * The base class for physics backends. A PhysicsWorld owns the lifecycle of a physics engine's
 * simulation world: stepping, gravity, body and shape factories, joints, raycasts and contact
 * reporting. Backends subclass it (AmmoPhysicsWorld) and override every method.
 *
 * The base implementation is a functional no-op: bodies and joints are created but inert,
 * raycasts miss and stepping does nothing. NullPhysicsWorld uses this to let component
 * lifecycle run in tests without a physics engine loaded.
 *
 * @ignore
 */
class PhysicsWorld {
    /**
     * The listener driven during {@link PhysicsWorld#step}. Set once at construction.
     *
     * @type {PhysicsContactListener|null}
     */
    contactListener = null;

    /**
     * The backend-native world object - btDiscreteDynamicsWorld when the Ammo backend is
     * active, null otherwise.
     *
     * @type {object|null}
     */
    nativeWorld = null;

    /**
     * Create a new PhysicsWorld instance.
     *
     * @param {object} [options] - The world options.
     * @param {PhysicsContactListener} [options.contactListener] - The contact listener.
     */
    constructor(options = {}) {
        this.contactListener = options.contactListener ?? null;
    }

    /**
     * Destroys the world and all native resources it owns. The world is unusable afterwards.
     */
    destroy() {
    }

    /**
     * Applies gravity if it differs from the current world gravity. Safe (and expected) to be
     * called every frame - backends deduplicate.
     *
     * @param {Vec3} gravity - The world space gravity.
     */
    setGravity(gravity) {
    }

    /**
     * Advances the simulation. Contact passes are driven from inside this call on backends
     * that support substep granularity.
     *
     * @param {number} dt - The elapsed time in seconds.
     * @param {number} maxSubSteps - The maximum number of fixed substeps to take.
     * @param {number} fixedTimeStep - The duration of a fixed substep in seconds.
     */
    step(dt, maxSubSteps, fixedTimeStep) {
    }

    /**
     * Runs a deferred contact pass on backends that could not report contacts from inside
     * {@link PhysicsWorld#step}. Called by the system after dynamic transform sync. No-op on
     * backends that report during step.
     */
    flushContacts() {
    }

    /**
     * Creates a body outside the simulation. Add it with {@link PhysicsWorld#addBody}.
     *
     * @param {PhysicsBodyDesc} desc - The body descriptor.
     * @returns {PhysicsBody} The new body.
     */
    createBody(desc) {
        const body = new PhysicsBody();
        body.entity = desc.entity ?? null;
        return body;
    }

    /**
     * Destroys a body. It must not currently be in the simulation.
     *
     * @param {PhysicsBody} body - The body to destroy.
     */
    destroyBody(body) {
    }

    /**
     * Adds a body to the simulation and applies the backend's activation policy for the body's
     * type (kinematic bodies never deactivate, all others enter the active state).
     *
     * @param {PhysicsBody} body - The body to add.
     * @param {number} [group] - The collision group bits. Used together with mask.
     * @param {number} [mask] - The collision mask bits.
     */
    addBody(body, group, mask) {
    }

    /**
     * Removes a body from the simulation. The body becomes inert until re-added.
     *
     * @param {PhysicsBody} body - The body to remove.
     */
    removeBody(body) {
    }

    /**
     * Creates a collision shape from a typed descriptor. The returned handle is opaque - it is
     * owned by this world and must only be passed back to this world.
     *
     * @param {PhysicsShapeDesc} desc - The shape descriptor.
     * @returns {object} The opaque shape handle.
     */
    createShape(desc) {
        return {};
    }

    /**
     * Destroys a shape handle created by {@link PhysicsWorld#createShape}.
     *
     * @param {object} shape - The shape handle.
     */
    destroyShape(shape) {
    }

    /**
     * Adds a child shape to a 'compound' shape at a local pose.
     *
     * @param {object} compound - The compound shape handle.
     * @param {object} child - The child shape handle.
     * @param {Vec3} position - The child position in the compound's local space.
     * @param {Quat} rotation - The child rotation in the compound's local space.
     */
    addCompoundChild(compound, child, position, rotation) {
    }

    /**
     * Updates the local pose of a child within a 'compound' shape. Adds the child if it is not
     * present.
     *
     * @param {object} compound - The compound shape handle.
     * @param {object} child - The child shape handle.
     * @param {Vec3} position - The child position in the compound's local space.
     * @param {Quat} rotation - The child rotation in the compound's local space.
     */
    updateCompoundChild(compound, child, position, rotation) {
    }

    /**
     * Removes a child from a 'compound' shape. No-op if the child is not present.
     *
     * @param {object} compound - The compound shape handle.
     * @param {object} child - The child shape handle.
     */
    removeCompoundChild(compound, child) {
    }

    /**
     * Returns the number of children in a 'compound' shape.
     *
     * @param {object} compound - The compound shape handle.
     * @returns {number} The child count.
     */
    getCompoundChildCount(compound) {
        return 0;
    }

    /**
     * Creates a joint between two bodies (or one body and the world) and adds it to the
     * simulation.
     *
     * @param {PhysicsJointDesc} desc - The joint descriptor.
     * @returns {PhysicsJoint} The new joint.
     */
    createJoint(desc) {
        return new PhysicsJoint();
    }

    /**
     * Removes a joint from the simulation and destroys it.
     *
     * @param {PhysicsJoint} joint - The joint to destroy.
     */
    destroyJoint(joint) {
    }

    /**
     * Raycast the world and return the first hit.
     *
     * @param {Vec3} start - The world space start point.
     * @param {Vec3} end - The world space end point.
     * @param {object} [options] - The raycast options.
     * @param {number} [options.filterCollisionGroup] - Collision group to apply to the raycast.
     * @param {number} [options.filterCollisionMask] - Collision mask to apply to the raycast.
     * @returns {RaycastResult|null} The hit, or null if there was none.
     */
    raycastFirst(start, end, options) {
        return null;
    }

    /**
     * Raycast the world and return all hits, in backend order.
     *
     * @param {Vec3} start - The world space start point.
     * @param {Vec3} end - The world space end point.
     * @param {object} [options] - The raycast options.
     * @param {number} [options.filterCollisionGroup] - Collision group to apply to the raycast.
     * @param {number} [options.filterCollisionMask] - Collision mask to apply to the raycast.
     * @param {any[]} [options.filterTags] - Tags filters. Defined the same way as a
     * {@link Tags#has} query but within an array. Hits filtered here are never allocated.
     * @param {Function} [options.filterCallback] - Custom function to use to filter entities.
     * Must return true to proceed with result. Takes the entity to evaluate as argument.
     * @returns {RaycastResult[]} The hits (0 length if there were none).
     */
    raycastAll(start, end, options) {
        return [];
    }
}

export { PhysicsWorld };
