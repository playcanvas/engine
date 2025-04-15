import { Vec2 } from '../../core/math/vec2.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Quat } from '../../core/math/quat.js';
import { Mat4 } from '../../core/math/mat4.js';
import { math } from '../../core/math/math.js';
import { Controller } from './controller.js';

/**
 * @typedef {object} FirstPersonInputFrame
 * @property {Vec3} move - The move deltas.
 * @property {Vec2} rotate - The rotate deltas.
 */

const tmpV1 = new Vec3();
const tmpV2 = new Vec3();
const tmpQ1 = new Quat();
const tmpM1 = new Mat4();

/**
 * Calculate the lerp rate.
 *
 * @param {number} damping - The damping.
 * @param {number} dt - The delta time.
 * @returns {number} - The lerp rate.
 */
const lerpRate = (damping, dt) => 1 - Math.pow(damping, dt * 1000);

class FirstPersonController extends Controller {
    /**
     * @private
     * @type {Vec3}
     */
    _targetPosition = new Vec3();

    /**
     * @private
     * @type {Vec3}
     */
    _position = new Vec3();

    /**
     * @private
     * @type {Vec3}
     */
    _targetAngles = new Vec3();

    /**
     * @private
     * @type {Vec3}
     */
    _angles = new Vec3();

    /**
     * The rotation damping. A higher value means more damping. A value of 0 means no damping.
     *
     * @type {number}
     */
    rotateDamping = 0.98;

    /**
     * The movement damping. A higher value means more damping. A value of 0 means no damping.
     *
     * @type {number}
     */
    moveDamping = 0.98;

    /**
     * @private
     */
    _clampAngles() {
        this._targetAngles.x = math.clamp(this._targetAngles.x, -90, 90);
    }

    /**
     * @param {Vec2} dv - The delta.
     * @private
     */
    _look(dv) {
        this._targetAngles.x -= dv.y;
        this._targetAngles.y -= dv.x;
        this._clampAngles();
    }

    /**
     * @param {Vec3} dv - The delta vector.
     * @param {number} dt - The delta time.
     * @private
     */
    _move(dv, dt) {
        tmpM1.setFromAxisAngle(Vec3.UP, this._angles.y);
        tmpM1.transformVector(tmpV1.set(dv.x, dv.y, -dv.z), tmpV1);
        tmpV1.mulScalar(dt);

        this._targetPosition.add(tmpV1);
    }

    /**
     * @param {number} dt - The delta time.
     * @private
     */
    _smoothTransform(dt) {
        const ar = dt === -1 ? 1 : lerpRate(this.rotateDamping, dt);
        const am = dt === -1 ? 1 : lerpRate(this.moveDamping, dt);

        this._angles.x = math.lerpAngle(this._angles.x % 360, this._targetAngles.x % 360, ar);
        this._angles.y = math.lerpAngle(this._angles.y % 360, this._targetAngles.y % 360, ar);
        this._position.lerp(this._position, this._targetPosition, am);
        this._transform.setTRS(this._position, tmpQ1.setFromEulerAngles(this._angles), Vec3.ONE);
    }

    /**
     * @private
     */
    _cancelSmoothTransform() {
        this._targetPosition.copy(this._position);
        this._targetAngles.copy(this._angles);
    }

    /**
     * @param {Mat4} transform - The transform.
     */
    attach(transform) {
        this._targetPosition.set(0, 0, 0);

        transform.getZ(tmpV1).normalize();
        const elev = Math.atan2(tmpV1.y, Math.sqrt(tmpV1.x * tmpV1.x + tmpV1.z * tmpV1.z)) * math.RAD_TO_DEG;
        const azim = Math.atan2(tmpV1.x, tmpV1.z) * math.RAD_TO_DEG;
        this._targetAngles.set(-elev, azim, 0);

        this._position.copy(this._targetPosition);
        this._angles.copy(this._targetAngles);

        this._smoothTransform(-1);
    }

    detach() {
        this._cancelSmoothTransform();
    }

    /**
     * @param {FirstPersonInputFrame} frame - The input frame.
     * @param {number} dt - The delta time.
     * @returns {Mat4} - The camera transform.
     */
    update(frame, dt) {
        const { move, rotate } = frame;
        this._look(rotate);
        this._move(move, dt);

        this._smoothTransform(dt);

        return this._transform;
    }

    destroy() {
        this.detach();
    }
}

export { FirstPersonController };
