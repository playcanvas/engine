import { Vec3 } from '../../core/math/vec3.js';
import { Quat } from '../../core/math/quat.js';
import { Mat4 } from '../../core/math/mat4.js';
import { math } from '../../core/math/math.js';
import { EventHandler } from '../../core/event-handler.js';

/**
 * @import { EventHandle } from 'playcanvas'
 *
 * @import { Input } from '../inputs/input.js'
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
     * @type {Input | null}
     * @private
     */
    _input = null;

    /**
     * @type {EventHandle[]}
     * @private
     */
    _evts = [];

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
     * @param {number} x - The x value.
     * @param {number} y - The y value.
     * @private
     */
    _look(x, y) {
        this._targetAngles.x -= (y || 0) * this.rotateSpeed;
        this._targetAngles.y -= (x || 0) * this.rotateSpeed;
    }

    /**
     * @param {number} x - The x value.
     * @param {number} y - The y value.
     * @param {number} z - The z value.
     * @param {number} dt - The delta time.
     * @private
     */
    _move(x, y, z, dt) {
        const back = this._transform.getZ();
        const right = this._transform.getX();
        const up = this._transform.getY();

        tmpV1.set(0, 0, 0);
        tmpV1.sub(tmpV2.copy(back).mulScalar(z));
        tmpV1.add(tmpV2.copy(right).mulScalar(x));
        tmpV1.add(tmpV2.copy(up).mulScalar(y));
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
     * @param {Input} input - The input.
     * @param {Mat4} transform - The transform.
     */
    attach(input, transform) {
        if (this._input) {
            this.detach();
        }
        this._input = input;
        // this._evts.push(this._input.on(Input.EVENT_ROTATEMOVE, this._look, this));

        this._position.copy(transform.getTranslation());
        this._targetPosition.copy(this._position);

        this._angles.copy(transform.getEulerAngles());
        this._targetAngles.copy(this._angles);

        this._transform.copy(transform);
    }

    detach() {
        if (!this._input) {
            return;
        }
        this._evts.forEach(evt => evt.off());
        this._evts.length = 0;
        this._input = null;

        this._cancelSmoothTransform();
    }

    /**
     * @param {number} dt - The delta time.
     * @returns {Mat4} - The camera transform.
     */
    update(dt) {
        if (!this._input) {
            return this._transform;
        }

        this._input.collect();
        this._look(this._input.get('rotate:x'), this._input.get('rotate:y'));
        this._move(this._input.get('translate:x'), this._input.get('translate:y'), this._input.get('translate:z'), dt);
        this._input.flush();

        this._smoothTransform(dt);

        return this._transform;
    }

    destroy() {
        this.detach();
    }
}

export { FlyCamera };
