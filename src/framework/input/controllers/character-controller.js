import { Debug } from '../../../core/debug.js';
import { math } from '../../../core/math/math.js';
import { Quat } from '../../../core/math/quat.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { BODYGROUP_ENGINE_1, BODYGROUP_TRIGGER, BODYMASK_ALL } from '../../components/rigid-body/constants.js';
import { Pose } from '../pose.js';
import { InputController, damp, num, stepDt } from './input-controller.js';

/**
 * @import { Entity } from '../../entity.js'
 * @import { RigidBodyComponentSystem } from '../../components/rigid-body/system.js'
 * @import { InputFrame, InputSnapshot } from '../../../platform/input/input-frame.js'
 */

/**
 * The collision group for character bodies. Put the character's rigidbody in this group so its
 * own sweeps, which mask it out by default, skip it and other characters.
 *
 * @category Input
 * @alpha
 */
export const CHARACTER_GROUP = BODYGROUP_ENGINE_1;

const MAX_SLIDES = 4;

const GROUND_PROBE = 0.05;

const wish = new Vec3();
const disp = new Vec3();
const tmp = new Vec3();
const to = new Vec3();
const rotation = new Quat();

/**
 * The character controller. Moves a kinematic capsule with collide-and-slide sweeps: `move` walks
 * relative to the `look` yaw, `jump` sets an upward velocity on the press while grounded, and
 * gravity and damping integrate the rest. {@link step} only queries the physics world, never
 * steps it, so a client can predict by stepping snapshots locally and replay them from a server
 * {@link state}. Put the entity's rigidbody in {@link CHARACTER_GROUP}.
 *
 * @example
 * entity.addComponent('collision', { type: 'capsule', radius: 0.5, height: 2 });
 * entity.addComponent('rigidbody', { type: 'kinematic', group: CHARACTER_GROUP });
 * const controller = new CharacterController(entity);
 * const frame = new InputFrame(CharacterController.fields);
 *
 * // each frame, after writing move, look, jump and sprint into frame.input
 * controller.step(frame.capture(dt));
 * const pose = controller.update(dt);
 * camera.setPosition(pose.position);
 * camera.setEulerAngles(pose.angles);
 * @category Input
 * @alpha
 */
class CharacterController extends InputController {
    /**
     * The frame fields: `move` is a held `[strafe, forward]` axis in -1 to 1, `look` the held
     * absolute `[pitch, yaw]` in degrees, and `jump` and `sprint` are held buttons.
     *
     * @type {InputFrame['fields']}
     */
    static fields = {
        move: { type: 'vec2', kind: 'held' },
        look: { type: 'vec2', kind: 'held' },
        jump: { type: 'bool', kind: 'held' },
        sprint: { type: 'bool', kind: 'held' }
    };

    /**
     * The entity moved by the controller.
     *
     * @type {Entity}
     */
    entity;

    /**
     * The capsule radius, read from the collision component.
     *
     * @type {number}
     */
    radius;

    /**
     * The capsule height including both caps, read from the collision component.
     *
     * @type {number}
     */
    height;

    /**
     * The acceleration in units per second squared while grounded.
     */
    speedGround = 50;

    /**
     * The acceleration in units per second squared while in the air.
     */
    speedAir = 5;

    /**
     * The acceleration multiplier while `sprint` is held on the ground.
     */
    sprintMult = 1.5;

    /**
     * The horizontal velocity damping per millisecond while grounded.
     */
    velocityDampingGround = 0.99;

    /**
     * The horizontal velocity damping per millisecond while in the air.
     */
    velocityDampingAir = 0.99925;

    /**
     * The upward velocity in units per second set by a jump.
     */
    jumpSpeed = 6;

    /**
     * The vertical acceleration in units per second squared.
     */
    gravity = -9.81;

    /**
     * The steepest slope in degrees the character stands on.
     */
    maxSlope = 45;

    /**
     * The gap in units kept between the capsule and what it hits.
     */
    skin = 0.01;

    /**
     * The collision mask of the sweeps. Defaults to everything except characters and triggers.
     */
    filterCollisionMask = BODYMASK_ALL ^ (CHARACTER_GROUP | BODYGROUP_TRIGGER);

    /**
     * The display position damping, used when attached with smoothing. In the range 0 to 1.
     */
    moveDamping = 0.98;

    /**
     * The display rotation damping, used when attached with smoothing. In the range 0 to 1.
     */
    rotateDamping = 0.98;

    /**
     * @type {RigidBodyComponentSystem}
     * @private
     */
    _system;

    /**
     * @private
     */
    _shape = { type: /** @type {'capsule'} */ ('capsule'), radius: 0, height: 0 };

    /**
     * @private
     */
    _options = { filterCollisionMask: 0 };

    /**
     * @private
     */
    _position = new Vec3();

    /**
     * @private
     */
    _velocity = new Vec3();

    /**
     * @private
     */
    _pitch = 0;

    /**
     * @private
     */
    _yaw = 0;

    /**
     * @private
     */
    _grounded = false;

    /**
     * @private
     */
    _jumping = false;

    /**
     * @private
     */
    _prevJump = false;

    /**
     * @private
     */
    _smooth = false;

    /**
     * @type {Pose}
     * @private
     */
    _targetPose = new Pose();

    /**
     * Creates a new CharacterController.
     *
     * @param {Entity} entity - The entity, with a kinematic rigidbody and a capsule collision.
     */
    constructor(entity) {
        super();
        Debug.assert(entity.rigidbody && entity.collision, 'CharacterController: the entity needs a rigidbody and a collision component');
        this.entity = entity;
        this.radius = entity.collision.radius;
        this.height = entity.collision.height;
        this._system = entity.rigidbody.system;
        this._position.copy(entity.getPosition());
    }

    /**
     * Sets the authoritative state and moves the entity to its position.
     *
     * @type {{ position: number[], velocity: number[], look: number[], grounded: boolean, jumping: boolean, prevJump: boolean }}
     */
    set state(value) {
        this._position.fromArray(value.position);
        this._velocity.fromArray(value.velocity);
        this._pitch = value.look[0];
        this._yaw = value.look[1];
        this._grounded = !!value.grounded;
        this._jumping = !!value.jumping;
        this._prevJump = !!value.prevJump;
        this.entity.setPosition(this._position);
    }

    /**
     * Gets a copy of the authoritative state.
     *
     * @type {{ position: number[], velocity: number[], look: number[], grounded: boolean, jumping: boolean, prevJump: boolean }}
     */
    get state() {
        const { _position: p, _velocity: v } = this;
        return {
            position: [p.x, p.y, p.z],
            velocity: [v.x, v.y, v.z],
            look: [this._pitch, this._yaw],
            grounded: this._grounded,
            jumping: this._jumping,
            prevJump: this._prevJump
        };
    }

    /**
     * Applies a snapshot: integrates velocity, moves the capsule with collide-and-slide sweeps and
     * sets the entity position. It reads the physics world but never steps it.
     *
     * @param {InputSnapshot} snapshot - The snapshot.
     */
    step(snapshot) {
        const dt = stepDt(snapshot);
        const { move, look, jump, sprint } = /** @type {InputSnapshot['input']} */ (snapshot.input ?? {});
        const pressed = !!jump;
        const velocity = this._velocity;
        const position = this._position;
        const shape = this._shape;
        const options = this._options;
        shape.radius = this.radius;
        shape.height = this.height;
        options.filterCollisionMask = this.filterCollisionMask;

        // look
        this._pitch = math.clamp(num(look?.[0]), -90, 90);
        this._yaw = num(look?.[1]);

        // wish direction relative to yaw, -z being forward
        wish.set(num(move?.[0]), 0, -num(move?.[1]));
        if (wish.lengthSq() > 1) {
            wish.normalize();
        }
        rotation.setFromEulerAngles(0, this._yaw, 0).transformVector(wish, wish);

        // velocity
        const grounded = this._grounded;
        const speed = (grounded ? this.speedGround : this.speedAir) * (sprint && grounded ? this.sprintMult : 1);
        const decay = Math.pow(grounded ? this.velocityDampingGround : this.velocityDampingAir, dt * 1000);
        velocity.x = (velocity.x + wish.x * speed * dt) * decay;
        velocity.z = (velocity.z + wish.z * speed * dt) * decay;
        const jumped = pressed && !this._prevJump && grounded;
        if (jumped) {
            velocity.y = this.jumpSpeed;
            this._jumping = true;
        }

        // no gravity while standing, so a walkable slope does not slide the character down it
        if (!grounded || jumped) {
            velocity.y += this.gravity * dt;
        }

        // collide and slide, stopping skin short of each hit and sliding the remainder along it
        const x = position.x;
        const z = position.z;
        disp.copy(velocity).mulScalar(dt);
        for (let i = 0; i < MAX_SLIDES; i++) {
            const len = disp.length();
            if (len === 0) {
                break;
            }
            const hit = this._system.sweep(shape, position, to.add2(position, disp), options);

            // hits moving away or along a surface, such as from a start inside it, do not block
            if (!hit || disp.dot(hit.normal) >= 0) {
                position.copy(to);
                break;
            }
            const normal = hit.normal;
            const f = Math.max(0, hit.hitFraction - this.skin / len);
            position.add(tmp.copy(disp).mulScalar(f));
            disp.mulScalar(1 - f);
            disp.sub(tmp.copy(normal).mulScalar(disp.dot(normal)));
            const vn = velocity.dot(normal);
            if (vn < 0) {
                velocity.sub(tmp.copy(normal).mulScalar(vn));
            }
        }

        // ground probe, reaching as far as the steepest walkable slope drops over the distance moved
        const slope = this.maxSlope * math.DEG_TO_RAD;
        const probe = 2 * this.skin + GROUND_PROBE + Math.hypot(position.x - x, position.z - z) * Math.tan(slope);
        to.set(position.x, position.y - probe, position.z);
        const ground = this._system.sweep(shape, position, to, options);
        this._grounded = !!ground && ground.normal.y >= Math.cos(slope);

        // on the ground unless rising from a jump: stop vertical motion and snap down to skin above
        // the ground, so landing and walking downhill keep contact
        if (this._grounded && !(this._jumping && velocity.y > 0)) {
            velocity.y = 0;
            this._jumping = false;
            position.y -= Math.max(0, ground.hitFraction * probe - this.skin);
        }
        this._prevJump = pressed;

        this.entity.setPosition(position);
    }

    /**
     * Sets the display pose to start from. With `smooth`, {@link update} damps the display pose
     * toward the eye, otherwise it places it at the eye every update.
     *
     * @param {Pose} pose - The display pose to start from.
     * @param {boolean} [smooth] - Whether to smooth the display pose.
     */
    attach(pose, smooth = true) {
        this._pose.copy(pose);
        this._smooth = smooth;
    }

    /**
     * Advances the display pose: the eye at `height / 2 - radius` above the capsule centre,
     * looking along `look`.
     *
     * @param {number} dt - The delta time in seconds.
     * @returns {Pose} The display pose.
     */
    update(dt) {
        const p = this._position;
        const target = this._targetPose;
        target.position.set(p.x, p.y + this.height / 2 - this.radius, p.z);
        target.angles.set(this._pitch, this._yaw, 0);

        if (!this._smooth) {
            return this._pose.copy(target);
        }
        return this._pose.lerp(this._pose, target, damp(this.moveDamping, dt), damp(this.rotateDamping, dt));
    }
}

export { CharacterController };
