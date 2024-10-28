import { BoundingBox, Vec2, Vec3, Ray, Plane, math } from 'playcanvas';

import { BaseCamera } from './base-camera.js';

const tmpVa = new Vec2();
const tmpV1 = new Vec3();
const tmpV2 = new Vec3();
const tmpR1 = new Ray();
const tmpP1 = new Plane();

const PASSIVE = { passive: false };

/**
 * Calculate the bounding box of an entity.
 *
 * @param {BoundingBox} bbox - The bounding box.
 * @param {Entity} entity - The entity.
 * @returns {BoundingBox} The bounding box.
 */
const calcEntityAABB = (bbox, entity) => {
    bbox.center.set(0, 0, 0);
    bbox.halfExtents.set(0, 0, 0);
    entity.findComponents('render').forEach((render) => {
        render.meshInstances.forEach((mi) => {
            bbox.add(mi.aabb);
        });
    });
    return bbox;
};

class MultiCamera extends BaseCamera {
    /**
     * @attribute
     * @type {number}
     */
    focusFov = 75;

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
     * @attribute
     * @type {number}
     */
    moveSpeed = 2;

    /**
     * @attribute
     * @type {number}
     */
    sprintSpeed = 4;

    /**
     * @attribute
     * @type {number}
     */
    crouchSpeed = 1;

    /**
     * @type {number}
     * @private
     */
    _zoom = 0;

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
     */
    _panning = false;

    /**
     * @type {boolean}
     */
    _flying = false;

    /**
     * @type {Record<string, boolean>}
     * @private
     */
    _key = {
        forward: false,
        backward: false,
        left: false,
        right: false,
        up: false,
        down: false,
        sprint: false,
        crouch: false
    };

    /**
     * @param {Record<string, any>} args - The script arguments
     */
    constructor(args) {
        super(args);
        const { attributes } = args;
        const { pinchSpeed, wheelSpeed, zoomMin, zoomMax, moveSpeed, sprintSpeed, crouchSpeed } = attributes;

        this.pinchSpeed = pinchSpeed ?? this.pinchSpeed;
        this.wheelSpeed = wheelSpeed ?? this.wheelSpeed;
        this.zoomMin = zoomMin ?? this.zoomMin;
        this.zoomMax = zoomMax ?? this.zoomMax;
        this.moveSpeed = moveSpeed ?? this.moveSpeed;
        this.sprintSpeed = sprintSpeed ?? this.sprintSpeed;
        this.crouchSpeed = crouchSpeed ?? this.crouchSpeed;

        this._onWheel = this._onWheel.bind(this);
        this._onKeyDown = this._onKeyDown.bind(this);
        this._onKeyUp = this._onKeyUp.bind(this);
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
        if (event.shiftKey || event.button === 1) {
            this._lastPosition.set(event.clientX, event.clientY);
            this._panning = true;
        }
        if (event.button === 2) {
            this._zoom = this._cameraDist;
            this._origin.copy(this._camera.getPosition());
            this._position.copy(this._origin);
            this._camera.setLocalPosition(0, 0, 0);
            this._flying = true;
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
                this._handlePan(tmpVa.set(event.clientX, event.clientY));
            } else {
                super._look(event);
            }
            return;
        }

        if (this._pointerEvents.size === 2) {
            // touch pan
            this._handlePan(this._getMidPoint(tmpVa));

            // pinch zoom
            const pinchDist = this._getPinchDist();
            if (this._lastPinchDist > 0) {
                this._handleZoom((this._lastPinchDist - pinchDist) * this.pinchSpeed);
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
        if (this._flying) {
            tmpV1.copy(this.entity.forward).mulScalar(this._zoom);
            this._origin.add(tmpV1);
            this._position.add(tmpV1);
            this._flying = false;
        }
    }

    /**
     * @param {WheelEvent} event - The wheel event.
     * @private
     */
    _onWheel(event) {
        event.preventDefault();
        this._handleZoom(event.deltaY);
    }

    /**
     * @param {KeyboardEvent} event - The keyboard event.
     * @private
     */
    _onKeyDown(event) {
        event.stopPropagation();
        switch (event.key.toLowerCase()) {
            case 'w':
                this._key.forward = true;
                break;
            case 's':
                this._key.backward = true;
                break;
            case 'a':
                this._key.left = true;
                break;
            case 'd':
                this._key.right = true;
                break;
            case 'q':
                this._key.up = true;
                break;
            case 'e':
                this._key.down = true;
                break;
            case 'shift':
                this._key.sprint = true;
                break;
            case 'control':
                this._key.crouch = true;
                break;
        }
    }

    /**
     * @param {KeyboardEvent} event - The keyboard event.
     * @private
     */
    _onKeyUp(event) {
        event.stopPropagation();
        switch (event.key.toLowerCase()) {
            case 'w':
                this._key.forward = false;
                break;
            case 's':
                this._key.backward = false;
                break;
            case 'a':
                this._key.left = false;
                break;
            case 'd':
                this._key.right = false;
                break;
            case 'q':
                this._key.up = false;
                break;
            case 'e':
                this._key.down = false;
                break;
            case 'shift':
                this._key.sprint = false;
                break;
            case 'control':
                this._key.crouch = false;
                break;
        }
    }

    /**
     * @param {number} dt - The time delta.
     * @private
     */
    _handleMove(dt) {
        tmpV1.set(0, 0, 0);
        if (this._key.forward) {
            tmpV1.add(this.entity.forward);
        }
        if (this._key.backward) {
            tmpV1.sub(this.entity.forward);
        }
        if (this._key.left) {
            tmpV1.sub(this.entity.right);
        }
        if (this._key.right) {
            tmpV1.add(this.entity.right);
        }
        if (this._key.up) {
            tmpV1.add(this.entity.up);
        }
        if (this._key.down) {
            tmpV1.sub(this.entity.up);
        }
        tmpV1.normalize();
        const speed = this._key.crouch ? this.crouchSpeed : this._key.sprint ? this.sprintSpeed : this.moveSpeed;
        tmpV1.mulScalar(this.sceneSize * speed * dt);
        this._origin.add(tmpV1);
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
     * @returns {number} The pinch distance.
     * @private
     */
    _getPinchDist() {
        const [a, b] = this._pointerEvents.values();
        const dx = a.clientX - b.clientX;
        const dy = a.clientY - b.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * @param {Vec2} pos - The position.
     * @param {Vec3} point - The output point.
     * @private
     */
    _screenToWorldPan(pos, point) {
        const mouseW = this._camera.camera.screenToWorld(pos.x, pos.y, 1);
        const cameraPos = this._camera.getPosition();

        const focusDirScaled = tmpV1.copy(this.entity.forward).mulScalar(this._zoom);
        const focalPos = tmpV2.add2(cameraPos, focusDirScaled);
        const planeNormal = focusDirScaled.mulScalar(-1).normalize();

        const plane = tmpP1.setFromPointNormal(focalPos, planeNormal);
        const ray = tmpR1.set(cameraPos, mouseW.sub(cameraPos).normalize());

        plane.intersectsRay(ray, point);
    }

    /**
     * @param {Vec2} pos - The position.
     * @private
     */
    _handlePan(pos) {
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
    _handleZoom(delta) {
        const min = this._camera.camera.nearClip + this.zoomMin * this.sceneSize;
        const max = this.zoomMax * this.sceneSize;
        const scale = math.clamp(this._zoom / (max - min), this.zoomScaleMin, 1);
        this._zoom += delta * this.wheelSpeed * this.sceneSize * scale;
        this._zoom = math.clamp(this._zoom, min, max);
    }

    /**
     * @returns {number} The zoom.
     * @private
     */
    _calcZoom() {
        const camera = this._camera.camera;
        const d1 = Math.tan(0.5 * this.focusFov * math.DEG_TO_RAD);
        const d2 = Math.tan(0.5 * camera.fov * math.DEG_TO_RAD);

        const scale = (d1 / d2) * (1 / camera.aspectRatio);
        return scale * this.sceneSize + this.sceneSize;
    }

    /**
     * @param {Vec3} point - The point to focus on.
     * @param {Vec3} [start] - The start point.
     * @param {boolean} [snap] - Whether to snap the focus.
     */
    focus(point, start, snap = false) {
        if (!this._camera) {
            return;
        }

        this._origin.copy(point);
        if (snap) {
            this._position.copy(point);
        }
        this._camera.setPosition(start);
        this._camera.setLocalEulerAngles(0, 0, 0);

        if (!start) {
            return;
        }

        tmpV1.sub2(start, point);
        const elev = Math.atan2(tmpV1.y, tmpV1.z) * math.RAD_TO_DEG;
        const azim = Math.atan2(tmpV1.x, tmpV1.z) * math.RAD_TO_DEG;
        this._dir.set(-elev, -azim);
        if (snap) {
            this._angles.copy(this._dir);
        }

        this._zoom = tmpV1.length();
    }

    /**
     * @param {Entity} entity - The entity to focus on.
     * @param {boolean} [snap] - Whether to snap the focus.
     */
    focusOnEntity(entity, snap = false) {
        const bbox = calcEntityAABB(new BoundingBox(), entity);
        this.sceneSize = bbox.halfExtents.length();
        this.focus(bbox.center, undefined, snap);
        this._zoom = this._calcZoom();
        if (snap) {
            this._cameraDist = this._zoom;
        }
    }

    /**
     * @param {Entity} camera - The camera entity to attach.
     */
    attach(camera) {
        super.attach(camera);
        this._camera.setPosition(0, 0, 0);
        this._camera.setLocalEulerAngles(0, 0, 0);

        window.addEventListener('wheel', this._onWheel, PASSIVE);
        window.addEventListener('keydown', this._onKeyDown, false);
        window.addEventListener('keyup', this._onKeyUp, false);
    }

    detach() {
        super.detach();

        window.removeEventListener('wheel', this._onWheel, PASSIVE);
        window.removeEventListener('keydown', this._onKeyDown, false);
        window.removeEventListener('keyup', this._onKeyUp, false);

        this._pointerEvents.clear();
        this._lastPinchDist = -1;
        this._panning = false;
        this._key = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            up: false,
            down: false,
            sprint: false,
            crouch: false
        };
    }

    /**
     * @param {number} dt - The delta time in seconds.
     */
    update(dt) {
        if (!this._camera) {
            return;
        }

        if (!this._flying) {
            this._cameraDist = math.lerp(this._cameraDist, this._zoom, 1 - Math.pow(this.moveDamping, dt * 1000));
            this._camera.setLocalPosition(0, 0, this._cameraDist);
        }

        this._handleMove(dt);

        super.update(dt);
    }
}

export { MultiCamera };
