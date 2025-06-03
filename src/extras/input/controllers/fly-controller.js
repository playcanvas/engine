import { Vec2 } from '../../../core/math/vec2.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { Quat } from '../../../core/math/quat.js';
import { math } from '../../../core/math/math.js';
import { InputController } from '../input.js';

/** @import { InputDelta } from '../input.js'; */
/** @import { Pose } from '../pose.js'; */

const tmpV1 = new Vec3();
const tmpV2 = new Vec3();
const tmpQ1 = new Quat();

/**
 * Calculate the damp rate.
 *
 * @param {number} damping - The damping.
 * @param {number} dt - The delta time.
 * @returns {number} - The lerp rate.
 */
const damp = (damping, dt) => 1 - Math.pow(damping, dt * 1000);

/**
 * The fly controller.
 *
 * @category Input Controller
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
     * @param {number} dt - The delta time.
     * @private
     */
    _smoothTransform(dt) {
        const ar = dt === -1 ? 1 : damp(this.rotateDamping, dt);
        const am = dt === -1 ? 1 : damp(this.moveDamping, dt);

        this._angles.x = math.lerpAngle(this._angles.x, this._targetAngles.x, ar) % 360;
        this._angles.y = math.lerpAngle(this._angles.y, this._targetAngles.y, ar) % 360;
        this._position.lerp(this._position, this._targetPosition, am);

        this._pose.set(this._position, tmpQ1.setFromEulerAngles(this._angles));
    }

    /**
     * @private
     */
    _cancelSmoothTransform() {
        this._targetPosition.copy(this._position);
        this._targetAngles.copy(this._angles);
    }

    /**
     * @param {Pose} pose - The pose to attach to.
     */
    attach(pose) {
        this._targetPosition.copy(pose.position);

        pose.rotation.transformVector(Vec3.BACK, tmpV1).normalize();
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
     * @param {object} frame - The input frame.
     * @param {InputDelta} frame.move - The movement input delta.
     * @param {InputDelta} frame.rotate - The rotation input delta.
     * @param {number} dt - The delta time.
     * @returns {Pose} - The controller pose.
     */
    update(frame, dt) {
        const { move, rotate } = frame;

        // rotate
        this._targetAngles.x -= rotate.value[1];
        this._targetAngles.y -= rotate.value[0];
        this._targetAngles.x %= 360;
        this._targetAngles.y %= 360;
        this._clampAngles();

        // move
        const forward = this._pose.rotation.transformVector(Vec3.FORWARD, new Vec3());
        const right = this._pose.rotation.transformVector(Vec3.RIGHT, new Vec3());
        const up = this._pose.rotation.transformVector(Vec3.UP, new Vec3());

        tmpV1.set(0, 0, 0);
        tmpV1.add(tmpV2.copy(forward).mulScalar(move.value[2]));
        tmpV1.add(tmpV2.copy(right).mulScalar(move.value[0]));
        tmpV1.add(tmpV2.copy(up).mulScalar(move.value[1]));
        tmpV1.mulScalar(dt);
        this._targetPosition.add(tmpV1);

        // smoothing
        this._smoothTransform(dt);

        return this._pose;
    }

    destroy() {
        this.detach();
    }
}

export { FlyController };
