import { Vec3 } from '../../core/math/vec3.js';
import { Quat } from '../../core/math/quat.js';
import { Mat4 } from '../../core/math/mat4.js';
import { math } from '../../core/math/math.js';
import { EventHandler } from '../../core/event-handler.js';

/**
 * @typedef {object} FlyInputFrame
 * @property {number[]} move - The move deltas.
 * @property {number[]} rotate - The rotate deltas.
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

class FlyCamera extends EventHandler {
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
     * @type {Mat4}
     * @private
     */
    _transform = new Mat4();

    /**
     * The rotation speed.
     *
     * @type {number}
     */
    rotateSpeed = 0.2;

    /**
     * The rotation damping. A higher value means more damping. A value of 0 means no damping.
     *
     * @type {number}
     */
    rotateDamping = 0.98;

    /**
     * The fly move speed.
     *
     * @type {number}
     */
    moveSpeed = 20;

    /**
     * The movement damping. A higher value means more damping. A value of 0 means no damping.
     *
     * @type {number}
     */
    moveDamping = 0.98;

    /**
     * @param {number} dx - The dx value.
     * @param {number} dy - The dy value.
     * @private
     */
    _look(dx, dy) {
        this._targetAngles.x -= (dy || 0) * this.rotateSpeed;
        this._targetAngles.y -= (dx || 0) * this.rotateSpeed;
    }


    /**
     * @param {number} dx - The dx value.
     * @param {number} dy - The dy value.
     * @param {number} dz - The dz value.
     * @param {number} dt - The delta time.
     * @private
     */
    _move(dx, dy, dz, dt) {
        const back = this._transform.getZ();
        const right = this._transform.getX();
        const up = this._transform.getY();

        tmpV1.set(0, 0, 0);
        tmpV1.sub(tmpV2.copy(back).mulScalar(dz));
        tmpV1.add(tmpV2.copy(right).mulScalar(dx));
        tmpV1.add(tmpV2.copy(up).mulScalar(dy));
        tmpV1.mulScalar(this.moveSpeed * dt);

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
        this._position.copy(transform.getTranslation());
        this._targetPosition.copy(this._position);

        this._angles.copy(transform.getEulerAngles());
        this._targetAngles.copy(this._angles);

        this._transform.copy(transform);
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
        this._look(rotate[0], rotate[1]);
        this._move(move[0], move[1], move[2], dt);

        this._smoothTransform(dt);

        return this._transform;
    }

    destroy() {
        this.detach();
    }
}

export { FlyCamera };
