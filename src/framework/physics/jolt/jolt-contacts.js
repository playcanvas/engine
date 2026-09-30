import { Quat } from '../../../core/math/quat.js';
import { Vec3 } from '../../../core/math/vec3.js';

/**
 * @import { ContactPoint } from '../../components/rigid-body/contact-point.js'
 * @import { Entity } from '../../entity.js'
 * @import { JoltHeapLayout } from './jolt-heap.js'
 * @import { JoltPhysicsBody } from './jolt-physics-body.js'
 * @import { JoltPhysicsWorld } from './jolt-physics-world.js'
 */

const _quat = new Quat();
const _vec3 = new Vec3();
const _linearA = new Vec3();
const _angularA = new Vec3();
const _linearB = new Vec3();
const _angularB = new Vec3();

/**
 * A contact manifold captured from a Jolt contact callback: the contact points of one pair of
 * sub shapes of two bodies, the contact normal, the estimated impulse at each point and the poses
 * of both bodies at the time, from which the local contact points are derived.
 *
 * @ignore
 */
class JoltContactRecord {
    /** @type {JoltPhysicsBody|null} */
    bodyA = null;

    /** @type {JoltPhysicsBody|null} */
    bodyB = null;

    subShapeA = 0;

    subShapeB = 0;

    count = 0;

    /**
     * The world space points on A and B of each contact, six floats per contact.
     *
     * @type {Float32Array}
     */
    points = new Float32Array(24);

    /** @type {Float32Array} */
    impulses = new Float32Array(4);

    /**
     * Jolt's contact normal, pointing from A towards B.
     */
    normal = new Vec3();

    positionA = new Vec3();

    rotationA = new Quat();

    positionB = new Vec3();

    rotationB = new Quat();

    /**
     * For a contact carried while its bodies sleep: whether either body was awake when the
     * current step began, so that Jolt had the chance to report the contact itself.
     */
    awake = false;

    /**
     * @param {number} count - The number of contact points to make room for.
     */
    reserve(count) {
        if (this.impulses.length < count) {
            this.points = new Float32Array(count * 6);
            this.impulses = new Float32Array(count);
        }
    }

    /**
     * @param {JoltContactRecord} other - The record to copy.
     */
    copy(other) {
        this.bodyA = other.bodyA;
        this.bodyB = other.bodyB;
        this.subShapeA = other.subShapeA;
        this.subShapeB = other.subShapeB;
        this.count = other.count;
        this.reserve(other.count);
        this.points.set(other.points.subarray(0, other.count * 6));
        this.impulses.set(other.impulses.subarray(0, other.count));
        this.normal.copy(other.normal);
        this.positionA.copy(other.positionA);
        this.rotationA.copy(other.rotationA);
        this.positionB.copy(other.positionB);
        this.rotationB.copy(other.rotationB);
    }
}

/**
 * The reused contact pair reported to the contact listener, reading its contact points from the
 * record being reported.
 *
 * @ignore
 */
class JoltContactPair {
    /** @type {Entity|null} */
    entityA = null;

    /** @type {Entity|null} */
    entityB = null;

    triggerA = false;

    triggerB = false;

    contactCount = 0;

    /**
     * The record being reported, set by JoltContacts.
     *
     * @type {JoltContactRecord|null}
     * @ignore
     */
    _record = null;

    /**
     * @param {number} index - The contact point index.
     * @param {ContactPoint} out - The contact point to fill, from body A's perspective.
     */
    readContact(index, out) {
        const record = this._record;
        const p = record.points;
        const o = index * 6;
        const n = record.normal;

        out.point.set(p[o], p[o + 1], p[o + 2]);
        out.pointOther.set(p[o + 3], p[o + 4], p[o + 5]);

        // Jolt's normal points from A towards B; the engine reports the normal of B's surface,
        // which points from B towards A
        out.normal.set(-n.x, -n.y, -n.z);

        _quat.copy(record.rotationA).invert();
        _quat.transformVector(_vec3.sub2(out.point, record.positionA), out.localPoint);
        _quat.copy(record.rotationB).invert();
        _quat.transformVector(_vec3.sub2(out.pointOther, record.positionB), out.localPointOther);

        out.impulse = record.impulses[index];
    }
}

/**
 * Returns the key of an unordered pair of bodies.
 *
 * @param {JoltPhysicsBody} a - A body.
 * @param {JoltPhysicsBody} b - The other body.
 * @returns {number} The key.
 * @ignore
 */
function pairKey(a, b) {
    const i = a._index;
    const j = b._index;
    return i < j ? i * 0x100000 + j : j * 0x100000 + i;
}

/**
 * Captures the contacts Jolt reports during a substep and reports them to the world's contact
 * listener once the substep is over, when it is safe for event handlers to change the world.
 *
 * Jolt stops reporting the contacts of a body when it falls asleep, where Bullet keeps them: a
 * resting body would lose its contacts - and fire collision end events - every time it slept. So
 * a contact removed while both of its bodies are asleep is kept and reported with its last data
 * until either body wakes up, at which point Jolt reports it again if it still exists.
 *
 * @ignore
 */
class JoltContacts {
    /**
     * @type {JoltPhysicsWorld}
     * @private
     */
    _world;

    /**
     * The native ContactListenerJS.
     *
     * @private
     */
    _listener;

    /**
     * The records captured in the current substep, and those of the previous one, which contact
     * removals are matched against.
     *
     * @type {JoltContactRecord[]}
     * @private
     */
    _current = [];

    /** @private */
    _currentCount = 0;

    /** @private */
    _previous = [];

    /** @private */
    _previousCount = 0;

    /**
     * The contacts kept while their bodies sleep.
     *
     * @type {JoltContactRecord[]}
     * @private
     */
    _sleeping = [];

    /**
     * Unused records.
     *
     * @type {JoltContactRecord[]}
     * @private
     */
    _pool = [];

    /**
     * The contacts removed in the current substep, four values each: the index and sequence
     * number of body 1, its sub shape ID, then the same for body 2.
     *
     * @type {number[]}
     * @private
     */
    _removed = [];

    /** @private */
    _pair = new JoltContactPair();

    /**
     * @param {JoltPhysicsWorld} world - The owning world.
     */
    constructor(world) {
        const Jolt = world._jolt;
        this._world = world;

        const capture = (body1, body2, manifold, settings) => {
            this._capture(body1, body2, manifold, settings);
        };
        const listener = new Jolt.ContactListenerJS();
        listener.OnContactValidate = (body1, body2) => this._validate(body1, body2);
        listener.OnContactAdded = capture;
        listener.OnContactPersisted = capture;
        listener.OnContactRemoved = pair => this._onRemoved(pair);
        world._system.SetContactListener(listener);
        this._listener = listener;
    }

    /**
     * Unregisters the listener. Destroy it with {@link JoltContacts#destroyListener} once the
     * physics system is gone.
     */
    destroy() {
        this._world._system.SetContactListener(null);
        this._current.length = 0;
        this._previous.length = 0;
        this._sleeping.length = 0;
        this._pool.length = 0;
    }

    /**
     * Frees the native listener.
     */
    destroyListener() {
        this._world._jolt.destroy(this._listener);
        this._listener = null;
    }

    /**
     * Forgets the contacts kept for a body that left the simulation.
     *
     * @param {JoltPhysicsBody} body - The body.
     */
    removeBody(body) {
        const sleeping = this._sleeping;
        for (let i = sleeping.length - 1; i >= 0; i--) {
            const record = sleeping[i];
            if (record.bodyA === body || record.bodyB === body) {
                sleeping.splice(i, 1);
                this._release(record);
            }
        }
    }

    /**
     * Prepares for a substep: the records of the last substep become the previous ones.
     */
    beginPass() {
        const previous = this._previous;
        for (let i = 0; i < this._previousCount; i++) {
            this._release(previous[i]);
        }
        this._previous = this._current;
        this._previousCount = this._currentCount;
        this._current = previous;
        this._currentCount = 0;
        this._removed.length = 0;

        const sleeping = this._sleeping;
        for (let i = 0; i < sleeping.length; i++) {
            const record = sleeping[i];
            record.awake = record.bodyA.isActive() || record.bodyB.isActive();
        }
    }

    /**
     * Reports the contacts of the substep that just ran to the world's contact listener.
     */
    endPass() {
        this._keepSleepingContacts();

        const listener = this._world.contactListener;
        if (!listener) {
            return;
        }

        listener.onContactsBegin();
        this._report(listener, this._current, this._currentCount);
        this._report(listener, this._sleeping, this._sleeping.length);

        const pair = this._pair;
        pair.entityA = null;
        pair.entityB = null;
        pair._record = null;

        listener.onContactsEnd();
    }

    /**
     * Keeps the contacts that were removed because their bodies fell asleep, and drops the kept
     * contacts of bodies that were awake for the substep - Jolt reported those itself if they
     * still exist - or that left the simulation.
     *
     * @private
     */
    _keepSleepingContacts() {
        const sleeping = this._sleeping;
        for (let i = sleeping.length - 1; i >= 0; i--) {
            const record = sleeping[i];
            if (record.awake || !record.bodyA._inWorld || !record.bodyB._inWorld) {
                sleeping.splice(i, 1);
                this._release(record);
            }
        }

        const removed = this._removed;
        if (removed.length === 0) {
            return;
        }

        const bodies = this._world._bodiesById;
        for (let i = 0; i < removed.length; i += 4) {
            const bodyA = bodies.get(removed[i]);
            const bodyB = bodies.get(removed[i + 2]);
            if (!bodyA || !bodyB || !bodyA._inWorld || !bodyB._inWorld ||
                bodyA.isActive() || bodyB.isActive()) {
                continue;
            }

            // both bodies are asleep: keep the contact as it was last reported
            const previous = this._previous;
            for (let j = 0; j < this._previousCount; j++) {
                const record = previous[j];
                if (record.bodyA === bodyA && record.bodyB === bodyB &&
                    record.subShapeA === removed[i + 1] && record.subShapeB === removed[i + 3]) {
                    const kept = this._allocate();
                    kept.copy(record);
                    kept.awake = false;
                    sleeping.push(kept);
                    break;
                }
            }
        }
    }

    /**
     * @param {object} listener - The contact listener.
     * @param {JoltContactRecord[]} records - The records to report.
     * @param {number} count - The number of records.
     * @private
     */
    _report(listener, records, count) {
        const pair = this._pair;
        for (let i = 0; i < count; i++) {
            const record = records[i];
            const bodyA = record.bodyA;
            const bodyB = record.bodyB;

            // an event handler earlier in the pass may have taken a body out of the simulation
            if (record.count === 0 || !bodyA._inWorld || !bodyB._inWorld) {
                continue;
            }

            pair.entityA = bodyA.entity;
            pair.entityB = bodyB.entity;
            pair.triggerA = bodyA._sensor;
            pair.triggerB = bodyB._sensor;
            pair.contactCount = record.count;
            pair._record = record;

            listener.onContactPair(pair);
        }
    }

    /**
     * @returns {JoltContactRecord} A record from the pool.
     * @private
     */
    _allocate() {
        return this._pool.pop() ?? new JoltContactRecord();
    }

    /**
     * @param {JoltContactRecord} record - The record to return to the pool.
     * @private
     */
    _release(record) {
        record.bodyA = null;
        record.bodyB = null;
        this._pool.push(record);
    }

    /**
     * Rejects the contacts of pairs of bodies joined by a joint that disables their collision.
     *
     * @param {number} body1 - The address of the first body.
     * @param {number} body2 - The address of the second body.
     * @returns {number} The Jolt ValidateResult.
     * @private
     */
    _validate(body1, body2) {
        const world = this._world;
        const Jolt = world._jolt;
        const pairs = world._noCollisionPairs;
        if (pairs.size > 0) {
            const bodyA = world._bodiesByPointer.get(body1);
            const bodyB = world._bodiesByPointer.get(body2);
            if (bodyA && bodyB && pairs.has(pairKey(bodyA, bodyB))) {
                return Jolt.ValidateResult_RejectAllContactsForThisBodyPair;
            }
        }
        return Jolt.ValidateResult_AcceptAllContactsForThisBodyPair;
    }

    /**
     * Called by Jolt during a substep for every added and persisting contact manifold. Sets the
     * combined friction and restitution, and records the contact for reporting. Must not change
     * the simulation.
     *
     * @param {number} body1 - The address of the first body.
     * @param {number} body2 - The address of the second body.
     * @param {number} manifoldAddress - The address of the ContactManifold.
     * @param {number} settingsAddress - The address of the ContactSettings.
     * @private
     */
    _capture(body1, body2, manifoldAddress, settingsAddress) {
        const world = this._world;
        const Jolt = world._jolt;
        const bodyA = world._bodiesByPointer.get(body1);
        const bodyB = world._bodiesByPointer.get(body2);
        if (!bodyA || !bodyB) {
            return;
        }

        // friction and restitution combine by multiplication, as in Bullet and as the engine
        // documents, where Jolt defaults to their geometric mean and maximum
        const restitution = Math.max(bodyA._restitution * bodyB._restitution, 0);
        const settings = Jolt.wrapPointer(settingsAddress, Jolt.ContactSettings);
        settings.mCombinedFriction = Math.max(bodyA._friction * bodyB._friction, 0);
        settings.mCombinedRestitution = restitution;

        // only pairs with an entity on both bodies are reported
        if (!bodyA.entity || !bodyB.entity || !world.contactListener) {
            return;
        }

        const record = this._allocate();
        this._current[this._currentCount++] = record;
        record.bodyA = bodyA;
        record.bodyB = bodyB;

        const layout = world._layout;
        if (layout) {
            this._readManifoldHeap(record, manifoldAddress, layout);
        } else {
            this._readManifold(record, manifoldAddress);
        }

        bodyA._readPose(record.positionA, record.rotationA);
        bodyB._readPose(record.positionB, record.rotationB);

        this._estimateImpulses(record, restitution);
    }

    /**
     * Reads a manifold straight from the module heap.
     *
     * @param {JoltContactRecord} record - The record to fill.
     * @param {number} address - The address of the ContactManifold.
     * @param {JoltHeapLayout} layout - The heap layout.
     * @private
     */
    _readManifoldHeap(record, address, layout) {
        const Jolt = this._world._jolt;
        const heap = Jolt.HEAPF32;
        const words = Jolt.HEAPU32;
        const m = address >> 2;

        const count = words[m + layout.manifoldCount];
        record.count = count;
        record.reserve(count);
        record.subShapeA = words[m + layout.manifoldSubShape1];
        record.subShapeB = words[m + layout.manifoldSubShape2];

        const n = m + layout.manifoldNormal;
        record.normal.set(heap[n], heap[n + 1], heap[n + 2]);

        // points are stored relative to the base offset
        const b = m + layout.manifoldBaseOffset;
        const bx = heap[b], by = heap[b + 1], bz = heap[b + 2];
        const points = record.points;
        const stride = layout.pointStride;
        let p1 = m + layout.manifoldPoints1;
        let p2 = m + layout.manifoldPoints2;
        for (let i = 0; i < count; i++, p1 += stride, p2 += stride) {
            const o = i * 6;
            points[o] = bx + heap[p1];
            points[o + 1] = by + heap[p1 + 1];
            points[o + 2] = bz + heap[p1 + 2];
            points[o + 3] = bx + heap[p2];
            points[o + 4] = by + heap[p2 + 1];
            points[o + 5] = bz + heap[p2 + 2];
        }
    }

    /**
     * Reads a manifold through the bindings.
     *
     * @param {JoltContactRecord} record - The record to fill.
     * @param {number} address - The address of the ContactManifold.
     * @private
     */
    _readManifold(record, address) {
        const Jolt = this._world._jolt;
        const manifold = Jolt.wrapPointer(address, Jolt.ContactManifold);

        const count = manifold.mRelativeContactPointsOn1.size();
        record.count = count;
        record.reserve(count);
        record.subShapeA = manifold.mSubShapeID1.GetValue() >>> 0;
        record.subShapeB = manifold.mSubShapeID2.GetValue() >>> 0;

        const n = manifold.mWorldSpaceNormal;
        record.normal.set(n.GetX(), n.GetY(), n.GetZ());

        const points = record.points;
        for (let i = 0; i < count; i++) {
            const o = i * 6;
            const a = manifold.GetWorldSpaceContactPointOn1(i);
            points[o] = a.GetX();
            points[o + 1] = a.GetY();
            points[o + 2] = a.GetZ();
            const b = manifold.GetWorldSpaceContactPointOn2(i);
            points[o + 3] = b.GetX();
            points[o + 4] = b.GetY();
            points[o + 5] = b.GetZ();
        }
    }

    /**
     * Estimates the impulse at each contact point, as Jolt does not expose the impulses its
     * solver applies: the impulse that stops the two bodies approaching each other at the point,
     * with restitution above Jolt's restitution speed threshold, shared between the points.
     * Contacts are reported before the solver runs, with gravity already added to the
     * velocities, so a resting contact carries the body's weight for the substep, as Bullet's
     * applied impulse does.
     *
     * @param {JoltContactRecord} record - The record with its points, normal and poses read.
     * @param {number} restitution - The combined restitution.
     * @private
     */
    _estimateImpulses(record, restitution) {
        const bodyA = record.bodyA;
        const bodyB = record.bodyB;
        const impulses = record.impulses;
        const count = record.count;
        const invMass = bodyA._invMass + bodyB._invMass;

        if (!(invMass > 0) || count === 0) {
            impulses.fill(0, 0, count);
            return;
        }

        bodyA._readVelocities(_linearA, _angularA);
        bodyB._readVelocities(_linearB, _angularB);

        const points = record.points;
        const n = record.normal;
        const pa = record.positionA;
        const pb = record.positionB;
        const threshold = this._world._minRestitutionVelocity;
        const share = 1 / (invMass * count);

        for (let i = 0; i < count; i++) {
            const o = i * 6;
            const cx = (points[o] + points[o + 3]) * 0.5;
            const cy = (points[o + 1] + points[o + 4]) * 0.5;
            const cz = (points[o + 2] + points[o + 5]) * 0.5;

            // velocity of each body at the contact: v + w x r
            const ax = cx - pa.x, ay = cy - pa.y, az = cz - pa.z;
            const vax = _linearA.x + _angularA.y * az - _angularA.z * ay;
            const vay = _linearA.y + _angularA.z * ax - _angularA.x * az;
            const vaz = _linearA.z + _angularA.x * ay - _angularA.y * ax;
            const bx = cx - pb.x, by = cy - pb.y, bz = cz - pb.z;
            const vbx = _linearB.x + _angularB.y * bz - _angularB.z * by;
            const vby = _linearB.y + _angularB.z * bx - _angularB.x * bz;
            const vbz = _linearB.z + _angularB.x * by - _angularB.y * bx;

            // speed at which B approaches A along the normal, which points from A to B
            const approach = -((vbx - vax) * n.x + (vby - vay) * n.y + (vbz - vaz) * n.z);
            const bounce = approach > threshold ? restitution : 0;
            impulses[i] = approach > 0 ? (1 + bounce) * approach * share : 0;
        }
    }

    /**
     * Called by Jolt during a substep for every contact that ended, including the contacts of
     * bodies that fell asleep. The bodies cannot be accessed here, so the pair is recorded and
     * examined once the substep is over.
     *
     * @param {number} address - The address of the SubShapeIDPair.
     * @private
     */
    _onRemoved(address) {
        // the bindings return the unsigned IDs as signed integers
        const Jolt = this._world._jolt;
        const pair = Jolt.wrapPointer(address, Jolt.SubShapeIDPair);
        this._removed.push(
            pair.GetBody1ID().GetIndexAndSequenceNumber() >>> 0,
            pair.GetSubShapeID1().GetValue() >>> 0,
            pair.GetBody2ID().GetIndexAndSequenceNumber() >>> 0,
            pair.GetSubShapeID2().GetValue() >>> 0
        );
    }
}

export { JoltContacts, pairKey };
