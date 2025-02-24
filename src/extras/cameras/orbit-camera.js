import { Vec3 } from '../../core/math/vec3.js';
import { Quat } from '../../core/math/quat.js';
import { Mat4 } from '../../core/math/mat4.js';
import { math } from '../../core/math/math.js';
import { EventHandler } from '../../core/event-handler.js';

import { Input } from '../inputs/input.js';

/** @import { EventHandle } from 'playcanvas' */

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

class OrbitCamera extends EventHandler {
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
     * @type {number}
     * @private
     */
    _targetZoomDist = 0;

    /**
     * @type {number}
     * @private
     */
    _zoomDist = 0;

    /**
     * @type {Mat4}
     * @private
     */
    _orbitTransform = new Mat4();

    /**
     * @type {Mat4}
     * @private
     */
    _rootTransform = new Mat4();

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
     * The zoom damping. A higher value means more damping. A value of 0 means no damping.
     *
     * @type {number}
     */
    zoomDamping = 0.98;

    /**
     * The zoom speed relative to the scene size.
     *
     * @type {number}
     */
    zoomSpeed = 0.01;

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
     * @param {number} delta - The delta value.
     * @private
     */
    _zoom(delta) {
        this._targetZoomDist += delta * this.zoomSpeed;
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
        this._rootTransform.setTRS(this._position, tmpQ1.setFromEulerAngles(this._angles), Vec3.ONE);
    }

    /**
     * @private
     */
    _cancelSmoothTransform() {
        this._targetPosition.copy(this._position);
        this._targetAngles.copy(this._angles);
    }

    /**
     * @param {number} dt - The delta time.
     * @private
     */
    _smoothZoom(dt) {
        const a = dt === -1 ? 1 : lerpRate(this.zoomDamping, dt);
        this._zoomDist = math.lerp(this._zoomDist, this._targetZoomDist, a);
        this._orbitTransform.setTranslate(0, 0, this._zoomDist);
    }

    /**
     * @private
     */
    _cancelSmoothZoom() {
        this._targetZoomDist = this._zoomDist;
    }

    /**
     * @param {Input} input - The input.
     * @param {Mat4} transform - The transform.
     * @param {Vec3} [point] - The point.
     */
    attach(input, transform, point = Vec3.ZERO) {
        if (this._input) {
            this.detach();
        }
        this._input = input;
        // this._evts.push(this._input.on(Input.EVENT_ROTATEMOVE, this._look, this));

        this._position.copy(point);
        this._targetPosition.copy(this._position);

        tmpV1.sub2(transform.getTranslation(), point);
        const elev = Math.atan2(tmpV1.y, Math.sqrt(tmpV1.x * tmpV1.x + tmpV1.z * tmpV1.z)) * math.RAD_TO_DEG;
        const azim = Math.atan2(tmpV1.x, tmpV1.z) * math.RAD_TO_DEG;
        this._angles.set(-elev, azim, 0);
        this._targetAngles.copy(this._angles);

        this._rootTransform.setTRS(point, tmpQ1.setFromEulerAngles(this._angles), Vec3.ONE);

        this._zoomDist = tmpV1.length();
        this._targetZoomDist = this._zoomDist;
        this._orbitTransform.setTranslate(0, 0, this._zoomDist);
    }

    detach() {
        if (!this._input) {
            return;
        }
        this._evts.forEach(evt => evt.off());
        this._evts.length = 0;
        this._input = null;

        this._cancelSmoothTransform();
        this._cancelSmoothZoom();
    }

    /**
     * @param {number} dt - The delta time.
     * @returns {Mat4} - The camera transform.
     */
    update(dt) {
        if (!this._input) {
            return this._transform;
        }

        this._look(this._input.get('rotate:x'), this._input.get('rotate:y'));
        this._zoom(this._input.get('zoom'));

        this._smoothTransform(dt);
        this._smoothZoom(dt);

        this._input.clear();

        return this._transform.mul2(this._rootTransform, this._orbitTransform);
    }

    destroy() {
        this.detach();
    }
}

export { OrbitCamera };
