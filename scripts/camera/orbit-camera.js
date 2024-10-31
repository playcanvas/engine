import { Vec2, Vec3, Ray, Plane, math } from 'playcanvas';

import { BaseCamera } from './base-camera.js';

/** @import { CameraComponent } from 'playcanvas' */

const tmpVa = new Vec2();
const tmpV1 = new Vec3();
const tmpV2 = new Vec3();
const tmpR1 = new Ray();
const tmpP1 = new Plane();

const PASSIVE = { passive: false };

class OrbitCamera extends BaseCamera {
    /**
     * @type {number}
     * @private
     */
    _zoomDist = 0;

    /**
     * @type {number}
     * @private
     */
    _cameraDist = 0;

    /**
     * @type {Map<number, PointerEvent>}
     * @private
     */
    _pointerEvents = new Map();

    /**
     * @type {number}
     * @private
     */
    _lastPinchDist = -1;

    /**
     * @type {Vec2}
     * @private
     */
    _lastPosition = new Vec2();

    /**
     * @type {boolean}
     * @private
     */
    _panning = false;

    /**
     * @attribute
     * @type {number}
     */
    lookSensitivity = 0.2;

    /**
     * @attribute
     * @type {number}
     */
    lookDamping = 0.97;

    /**
     * @attribute
     * @type {number}
     */
    moveDamping = 0.98;

    /**
     * @attribute
     * @type {number}
     */
    pinchSpeed = 5;

    /**
     * @attribute
     * @type {number}
     */
    wheelSpeed = 0.005;

    /**
     * @attribute
     * @type {number}
     */
    zoomMin = 0.001;

    /**
     * @attribute
     * @type {number}
     */
    zoomMax = 10;

    /**
     * @attribute
     * @type {number}
     */
    zoomScaleMin = 0.01;

    /**
     * @param {object} args - The script arguments.
     */
    constructor(args) {
        super(args);
        const { pinchSpeed, wheelSpeed, zoomMin, zoomMax } = args.attributes;

        this.pinchSpeed = pinchSpeed ?? this.pinchSpeed;
        this.wheelSpeed = wheelSpeed ?? this.wheelSpeed;
        this.zoomMin = zoomMin ?? this.zoomMin;
        this.zoomMax = zoomMax ?? this.zoomMax;

        this._onWheel = this._onWheel.bind(this);

        if (!this.entity.camera) {
            throw new Error('OrbitCamera script requires a camera component');
        }
        this.attach(this.entity.camera);
    }

    /**
     * @param {PointerEvent} event - The pointer event.
     * @protected
     */
    _onPointerDown(event) {
        if (!this._camera) {
            return;
        }
        this._pointerEvents.set(event.pointerId, event);
        if (this._pointerEvents.size === 2) {
            this._lastPinchDist = this._getPinchDist();
            this._getMidPoint(this._lastPosition);
            this._panning = true;
        }
        if (event.button === 2) {
            this._lastPosition.set(event.clientX, event.clientY);
            this._panning = true;
        }
    }

    /**
     * @param {PointerEvent} event - The pointer event.
     * @protected
     */
    _onPointerMove(event) {
        if (this._pointerEvents.size === 0) {
            return;
        }

        this._pointerEvents.set(event.pointerId, event);

        if (this._pointerEvents.size === 1) {
            if (this._panning) {
                // mouse pan
                this._pan(tmpVa.set(event.clientX, event.clientY));
            } else {
                super._look(event);
            }
            return;
        }

        if (this._pointerEvents.size === 2) {
            // touch pan
            this._pan(this._getMidPoint(tmpVa));

            // pinch zoom
            const pinchDist = this._getPinchDist();
            if (this._lastPinchDist > 0) {
                this._zoom((this._lastPinchDist - pinchDist) * this.pinchSpeed);
            }
            this._lastPinchDist = pinchDist;
        }

    }

    /**
     * @param {PointerEvent} event - The pointer event.
     * @protected
     */
    _onPointerUp(event) {
        this._pointerEvents.delete(event.pointerId);
        if (this._pointerEvents.size < 2) {
            this._lastPinchDist = -1;
            this._panning = false;
        }
        if (this._panning) {
            this._panning = false;
        }
    }

    /**
     * @param {WheelEvent} event - The wheel event.
     * @private
     */
    _onWheel(event) {
        event.preventDefault();
        this._zoom(event.deltaY);
    }

    /**
     * @param {Vec2} out - The output vector.
     * @returns {Vec2} The mid point.
     * @private
     */
    _getMidPoint(out) {
        const [a, b] = this._pointerEvents.values();
        const dx = a.clientX - b.clientX;
        const dy = a.clientY - b.clientY;
        return out.set(b.clientX + dx * 0.5, b.clientY + dy * 0.5);
    }

    /**
     * @private
     * @returns {number} The pinch distance.
     */
    _getPinchDist() {
        const [a, b] = this._pointerEvents.values();
        const dx = a.clientX - b.clientX;
        const dy = a.clientY - b.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * @param {Vec2} pos - The screen position.
     * @param {Vec3} point - The output point.
     * @private
     */
    _screenToWorldPan(pos, point) {
        const mouseW = this._camera.screenToWorld(pos.x, pos.y, 1);
        const cameraPos = this._camera.entity.getPosition();

        const focusDirScaled = tmpV1.copy(this.root.forward).mulScalar(this._zoomDist);
        const focalPos = tmpV2.add2(cameraPos, focusDirScaled);
        const planeNormal = focusDirScaled.mulScalar(-1).normalize();

        const plane = tmpP1.setFromPointNormal(focalPos, planeNormal);
        const ray = tmpR1.set(cameraPos, mouseW.sub(cameraPos).normalize());

        plane.intersectsRay(ray, point);
    }

    /**
     * @param {Vec2} pos - The screen position.
     * @private
     */
    _pan(pos) {
        const start = new Vec3();
        const end = new Vec3();

        this._screenToWorldPan(this._lastPosition, start);
        this._screenToWorldPan(pos, end);

        tmpV1.sub2(start, end);
        this._origin.add(tmpV1);

        this._lastPosition.copy(pos);
    }

    /**
     * @param {number} delta - The delta.
     * @private
     */
    _zoom(delta) {
        if (!this._camera) {
            return;
        }
        const min = this._camera.nearClip + this.zoomMin * this.sceneSize;
        const max = this.zoomMax * this.sceneSize;
        const scale = math.clamp(this._zoomDist / (max - min), this.zoomScaleMin, 1);
        this._zoomDist += (delta * this.wheelSpeed * this.sceneSize * scale);
        this._zoomDist = math.clamp(this._zoomDist, min, max);
    }

    /**
     * @param {Vec3} point - The point.
     * @param {Vec3} [start] - The start.
     */
    focus(point, start) {
        if (!this._camera) {
            return;
        }
        if (!start) {
            this._origin.copy(point);
            return;
        }

        tmpV1.sub2(start, point);
        const elev = Math.atan2(tmpV1.y, tmpV1.z) * math.RAD_TO_DEG;
        const azim = Math.atan2(tmpV1.x, tmpV1.z) * math.RAD_TO_DEG;
        this._dir.set(-elev, -azim);

        this._origin.copy(point);
        this._camera.entity.setPosition(start);
        this._camera.entity.setLocalEulerAngles(0, 0, 0);

        this._zoomDist = tmpV1.length();
    }

    /**
     * @param {number} [zoomDist] - The zoom distance.
     */
    resetZoom(zoomDist = 0) {
        this._zoomDist = zoomDist;
    }

    /**
     * @param {CameraComponent} camera - The camera component.
     */
    attach(camera) {
        super.attach(camera);

        window.addEventListener('wheel', this._onWheel, PASSIVE);
    }

    detach() {
        super.detach();

        window.removeEventListener('wheel', this._onWheel, PASSIVE);

        this._pointerEvents.clear();
        this._lastPinchDist = -1;
        this._panning = false;
    }

    /**
     * @param {number} dt - The delta time.
     */
    update(dt) {
        if (!this._camera) {
            return;
        }

        this._cameraDist = math.lerp(this._cameraDist, this._zoomDist, 1 - Math.pow(this.moveDamping, dt * 1000));
        this._camera.entity.setLocalPosition(0, 0, this._cameraDist);

        super.update(dt);
    }
}

export { OrbitCamera };
