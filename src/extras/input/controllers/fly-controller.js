import { Vec2 } from '../../../core/math/vec2.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { Quat } from '../../../core/math/quat.js';
import { math } from '../../../core/math/math.js';
import { InputController } from '../input.js';

/** @import { Mat4 } from '../../../core/math/mat4.js'; */

/**
 * @typedef {object} FlyInputFrame
 * @property {Vec3} move - The move deltas.
 * @property {Vec2} rotate - The rotate deltas.
 */

const tmpV1 = new Vec3();
const tmpV2 = new Vec3();
const tmpQ1 = new Quat();

/**
 * Calculate the lerp rate.
 *
 * @param {number} damping - The damping.
 * @param {number} dt - The delta time.
 * @returns {number} - The lerp rate.
 */
const lerpRate = (damping, dt) => 1 - Math.pow(damping, dt * 1000);

/**
 * The fly controller.
 *
 * @category Input
 * @alpha
 */
class FlyController extends InputController {
    /**
     * @type {Vec3}
     * @private
     */
    _targetPosition = new Vec3();

    /**
     * @type {Vec3}
     * @private
     */
    _position = new Vec3();

    /**
     * @type {Vec3}
     * @private
     */
    _targetAngles = new Vec3();

    /**
     * @type {Vec3}
     * @private
     */
    _angles = new Vec3();

    /**
     * @type {Vec2}
     * @private
     */
    _pitchRange = new Vec2(-Infinity, Infinity);

    /**
     * @type {Vec2}
     * @private
     */
    _yawRange = new Vec2(-Infinity, Infinity);

    /**
     * The rotation damping. In the range 0 to 1, where a value of 0 means no damping and 1 means
     * full damping. Default is 0.98.
     *
     * @type {number}
     */
    rotateDamping = 0.98;

    /**
     * The movement damping. In the range 0 to 1, where a value of 0 means no damping and 1 means
     * full damping. Default is 0.98.
     *
     * @type {number}
     */
    moveDamping = 0.98;

    set pitchRange(value) {
        this._pitchRange.copy(value);
        this._clampAngles();
        this._smoothTransform(-1);
    }

    get pitchRange() {
        return this._pitchRange;
    }

    set yawRange(value) {
        this._yawRange.copy(value);
        this._clampAngles();
        this._smoothTransform(-1);
    }

    get yawRange() {
        return this._yawRange;
    }

    /**
     * @private
     */
    _clampAngles() {
        this._targetAngles.x = math.clamp(this._targetAngles.x, this._pitchRange.x, this._pitchRange.y);
        this._targetAngles.y = math.clamp(this._targetAngles.y, this._yawRange.x, this._yawRange.y);
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
        const back = this._transform.getZ();
        const right = this._transform.getX();
        const up = this._transform.getY();

        tmpV1.set(0, 0, 0);
        tmpV1.sub(tmpV2.copy(back).mulScalar(dv.z));
        tmpV1.add(tmpV2.copy(right).mulScalar(dv.x));
        tmpV1.add(tmpV2.copy(up).mulScalar(dv.y));
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
        this._targetPosition.copy(transform.getTranslation());

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
     * @param {FlyInputFrame} frame - The input frame.
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

export { FlyController };
