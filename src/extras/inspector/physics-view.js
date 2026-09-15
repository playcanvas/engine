import { Mat4 } from '../../core/math/mat4.js';
import { Quat } from '../../core/math/quat.js';
import { Vec3 } from '../../core/math/vec3.js';
import { BODYTYPE_DYNAMIC, BODYTYPE_KINEMATIC, BODYTYPE_STATIC } from '../../framework/components/rigid-body/constants.js';

import { formatNumber } from './describe.js';

/** @import { AppBase } from '../../framework/app-base.js' */
/** @import { CollisionComponent } from '../../framework/components/collision/component.js' */
/** @import { RigidBodyComponent } from '../../framework/components/rigid-body/component.js' */
/** @import { Entity } from '../../framework/entity.js' */
/** @import { WireRenderer } from '../renderers/wire-renderer.js' */
/** @import { ListRow } from './list-view.js' */

/**
 * @typedef {object} PhysicsStats
 * @property {boolean} system - Whether a rigid body component system is registered.
 * @property {boolean} world - Whether the physics world exists, i.e. the backend is loaded.
 * @property {number} bodies - The number of rigid body components.
 * @property {number} active - The number of awake dynamic bodies.
 * @property {number} contacts - The number of contact points in the last step.
 * @property {number} joints - The number of joint components.
 * @property {number} time - The CPU time of the last physics step, in milliseconds.
 */

const _pos = new Vec3();
const _rot = new Quat();
const _mat = new Mat4();
const _a = new Vec3();
const _b = new Vec3();
const _dir = new Vec3();

/**
 * @param {AppBase} app - The app.
 * @returns {Entity[]} Every entity carrying a rigid body component.
 */
function bodyEntities(app) {
    const store = app.systems.rigidbody?.store;
    return store ? Object.values(store).map(record => record.entity) : [];
}

/**
 * @param {CollisionComponent|undefined} collision - A collision component.
 * @returns {string} The shape and its dimensions.
 */
function shapeText(collision) {
    if (!collision) return 'no collision';
    switch (collision.type) {
        case 'box': {
            const h = collision.halfExtents;
            return `box ${formatNumber(h.x * 2)}×${formatNumber(h.y * 2)}×${formatNumber(h.z * 2)}`;
        }
        case 'sphere':
            return `sphere r ${formatNumber(collision.radius)}`;
        case 'capsule':
        case 'cylinder':
        case 'cone':
            return `${collision.type} r ${formatNumber(collision.radius)} h ${formatNumber(collision.height)}`;
        case 'mesh':
            return collision.convexHull ? 'convex hull' : 'mesh';
        default:
            return collision.type;
    }
}

/**
 * @param {RigidBodyComponent} rigidbody - A rigid body component.
 * @returns {string} Its simulation state.
 */
function bodyState(rigidbody) {
    if (!rigidbody.enabled || !rigidbody.entity.enabled) return 'disabled';
    switch (rigidbody.type) {
        case BODYTYPE_STATIC: return 'static';
        case BODYTYPE_KINEMATIC: return 'kinematic';
        default:
            if (!rigidbody.body) return 'no body';
            return rigidbody.isActive() ? 'active' : 'sleeping';
    }
}

/**
 * One row per rigid body: a checkbox that excludes the body from the debug drawing, name linking
 * to the entity, type, shape, mass, and state with the speed of awake bodies. Sleeping and
 * disabled bodies are dimmed.
 *
 * @param {AppBase} app - The app.
 * @param {{ has: (entity: Entity) => boolean }} hidden - The bodies excluded from the drawing.
 * @param {boolean} drawing - Whether the world is drawn at all; the checkboxes are disabled otherwise.
 * @returns {ListRow[]} The rows.
 */
function bodyRows(app, hidden, drawing) {
    return bodyEntities(app).map((entity) => {
        const rigidbody = entity.rigidbody;
        const state = bodyState(rigidbody);
        const dynamic = rigidbody.type === BODYTYPE_DYNAMIC;
        const speed = dynamic && state === 'active' ? ` · ${formatNumber(rigidbody.linearVelocity.length())} m/s` : '';

        return {
            key: entity.guid,
            item: entity,
            name: entity.name,
            dim: state === 'sleeping' || state === 'disabled',
            cells: [
                { toggle: true, checked: !hidden.has(entity), disabled: !drawing, title: 'Draw this body' },
                { text: entity.name, cls: 'pci-cell-name', target: entity },
                { text: rigidbody.type, cls: 'pci-cell-tag pci-cell-tag-info' },
                { text: shapeText(entity.collision), cls: 'pci-cell-info' },
                { text: dynamic ? `${formatNumber(rigidbody.mass)} kg` : '', cls: 'pci-cell-info' },
                { text: `${state}${speed}`, cls: 'pci-cell-info pci-cell-right' }
            ]
        };
    });
}

/**
 * @param {AppBase} app - The app.
 * @returns {Entity[]} Every entity carrying a joint component.
 */
function jointEntities(app) {
    const store = app.systems.joint?.store;
    return store ? Object.values(store).map(record => record.entity) : [];
}

/**
 * One row per joint: name linking to the entity, the joint type, the two bodies it connects as
 * links, and whether it has broken. Joints without a second body are attached to the world.
 *
 * @param {AppBase} app - The app.
 * @returns {ListRow[]} The rows.
 */
function jointRows(app) {
    return jointEntities(app).map((entity) => {
        const joint = entity.joint;
        const a = joint.entityA;
        const b = joint.entityB;
        const broken = !!joint.isBroken;
        const flags = [
            joint.enableLimits ? 'limits' : '',
            joint.motorSpeed ? 'motor' : '',
            joint.breakImpulse > 0 && joint.breakImpulse < Number.MAX_VALUE ? 'breakable' : '',
            joint.enableCollision ? '' : 'no collision'
        ].filter(Boolean).join(' · ');

        return {
            key: `joint:${entity.guid}`,
            item: entity,
            name: entity.name,
            dim: !joint.enabled || !entity.enabled || broken,
            cells: [
                { text: '', cls: 'pci-cell-spacer' },
                { text: entity.name, cls: 'pci-cell-name', target: entity },
                { text: `${joint.type} joint`, cls: 'pci-cell-tag pci-cell-tag-info' },
                { text: a ? a.name : 'world', cls: 'pci-cell-info', target: a ?? undefined },
                { text: '↔', cls: 'pci-cell-info' },
                { text: b ? b.name : 'world', cls: 'pci-cell-info', target: b ?? undefined },
                { text: flags, cls: 'pci-cell-info' },
                { text: broken ? 'broken' : (joint.enabled ? 'active' : 'disabled'), cls: 'pci-cell-info pci-cell-right' }
            ]
        };
    });
}

/**
 * Outlines a joint. The joint entity's own frame is drawn as axes, and for each connected body the
 * joint frame the constraint was created with is drawn where that body currently carries it: axes
 * at the anchor (red is the primary joint axis, green the secondary), a line from the body's center
 * to the anchor, and a line from the joint entity to the anchor. Where the two anchor frames have
 * drifted apart, the constraint is being violated by that much.
 *
 * @param {WireRenderer} wire - The renderer to draw with. Its color and depth test are used as set.
 * @param {Entity} entity - The entity carrying the joint component.
 * @param {number} size - The axis length.
 * @returns {boolean} False when the entity has no joint component.
 */
function drawJoint(wire, entity, size) {
    const joint = /** @type {any} */ (entity.joint);
    if (!joint) return false;

    const position = entity.getPosition();
    wire.axes(entity.getWorldTransform(), size);

    const frames = [[joint.entityA, joint._frameA], [joint.entityB, joint._frameB]];
    for (const [body, frame] of frames) {
        if (!frame) {
            // no constraint yet: at least show what the joint connects
            if (body) wire.line(position, body.getPosition());
            continue;
        }

        // bodies ignore entity scale, so the anchor follows the body's unscaled transform
        if (body) {
            _mat.setTRS(body.getPosition(), body.getRotation(), Vec3.ONE).mul(frame);
        } else {
            _mat.copy(frame);
        }
        _mat.getTranslation(_a);

        wire.axes(_mat, size * 0.75);
        wire.line(position, _a);
        if (body) wire.line(body.getPosition(), _a);
    }
    return true;
}

/**
 * @param {AppBase} app - The app.
 * @returns {PhysicsStats} Counts for the status bar.
 */
function physicsStats(app) {
    const system = app.systems.rigidbody;
    const entities = bodyEntities(app);

    let active = 0;
    for (const entity of entities) {
        const rigidbody = entity.rigidbody;
        if (rigidbody.type === BODYTYPE_DYNAMIC && rigidbody.isActive()) active++;
    }

    let contacts = 0;
    const dispatcher = system?.dispatcher;
    if (dispatcher) {
        const manifolds = dispatcher.getNumManifolds();
        for (let i = 0; i < manifolds; i++) {
            contacts += dispatcher.getManifoldByIndexInternal(i).getNumContacts();
        }
    }

    return {
        system: !!system,
        world: !!system?.dynamicsWorld,
        bodies: entities.length,
        active,
        contacts,
        joints: jointEntities(app).length,
        time: app.stats?.frame?.physicsTime ?? 0
    };
}

/**
 * @param {number} axis - A collision component axis: 0 for x, 1 for y, 2 for z.
 * @param {Vec3} out - Receives the unit vector.
 * @returns {Vec3} The unit vector.
 */
function axisVector(axis, out) {
    return out.set(axis === 0 ? 1 : 0, axis === 1 ? 1 : 0, axis === 2 ? 1 : 0);
}

/**
 * Outlines an entity's primitive collision shape where the physics engine has it: at the entity's
 * position and rotation with the component's offsets applied, ignoring the entity scale as
 * primitive shapes do.
 *
 * @param {WireRenderer} wire - The renderer to draw with. Its color and depth test are used as set.
 * @param {Entity} entity - The entity.
 * @returns {boolean} False when the entity has no primitive collision shape to outline.
 */
function drawCollisionShape(wire, entity) {
    const collision = entity.collision;
    if (!collision?.enabled) return false;

    const type = collision.type;
    if (!['box', 'sphere', 'capsule', 'cylinder', 'cone'].includes(type)) return false;

    const rotation = entity.getRotation();
    _rot.copy(rotation);
    if (collision.angularOffset) _rot.mul(collision.angularOffset);

    _pos.copy(entity.getPosition());
    if (collision.linearOffset) {
        rotation.transformVector(collision.linearOffset, _a);
        _pos.add(_a);
    }

    _mat.setTRS(_pos, _rot, Vec3.ONE);
    wire.transform = _mat;

    const radius = collision.radius;
    const height = collision.height;
    axisVector(collision.axis, _dir);

    switch (type) {
        case 'box': {
            const h = collision.halfExtents;
            _a.set(-h.x, -h.y, -h.z);
            _b.set(h.x, h.y, h.z);
            wire.boxMinMax(_a, _b);
            break;
        }
        case 'sphere':
            wire.sphere(Vec3.ZERO, radius);
            break;
        case 'capsule': {
            const half = Math.max(0, height / 2 - radius);
            _a.copy(_dir).mulScalar(-half);
            _b.copy(_dir).mulScalar(half);
            wire.capsule(_a, _b, radius);
            break;
        }
        case 'cylinder':
            _a.copy(_dir).mulScalar(-height / 2);
            _b.copy(_dir).mulScalar(height / 2);
            wire.cylinder(_a, _b, radius);
            break;
        case 'cone': {
            _a.copy(_dir).mulScalar(height / 2);
            _b.copy(_dir).mulScalar(-1);
            const angle = Math.atan2(radius, height) * 180 / Math.PI;
            wire.cone(_a, _b, angle, height);
            break;
        }
    }

    wire.transform = null;
    return true;
}

export { bodyRows, drawCollisionShape, drawJoint, jointRows, physicsStats };
