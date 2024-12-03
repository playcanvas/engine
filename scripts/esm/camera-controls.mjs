/* eslint-disable-next-line import/no-unresolved */
import { Vec2, Vec3, Ray, Plane, Mat4, Quat, Script, math } from 'playcanvas';

/** @import { CameraComponent } from 'playcanvas' */

const tmpVa = new Vec2();
const tmpV1 = new Vec3();
const tmpV2 = new Vec3();
const tmpM1 = new Mat4();
const tmpQ1 = new Quat();
const tmpR1 = new Ray();
const tmpP1 = new Plane();

const PASSIVE = { passive: false };
const ZOOM_SCALE_SCENE_MULT = 10;

/**
 * Calculate the lerp rate.
 *
 * @param {number} damping - The damping.
 * @param {number} dt - The delta time.
 * @returns {number} - The lerp rate.
 */
const lerpRate = (damping, dt) => 1 - Math.pow(damping, dt * 1000);

class CameraControls extends Script {
    /**
     * @private
     * @type {CameraComponent}
     */
    _camera = null;

    /**
     * @private
     * @type {Vec3}
     */
    _origin = new Vec3();

    /**
     * @private
     * @type {Vec3}
     */
    _position = new Vec3();

    /**
     * @private
     * @type {Vec2}
     */
    _dir = new Vec2();

    /**
     * @private
     * @type {Vec3}
     */
    _angles = new Vec3();

    /**
     * @private
     * @type {Vec2}
     */
    _pitchRange = new Vec2(-360, 360);

    /**
     * @private
     * @type {number}
     */
    _zoomMin = 0;

    /**
     * @private
     * @type {number}
     */
    _zoomMax = 0;

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
    _orbiting = false;

    /**
     * @type {boolean}
     * @private
     */
    _panning = false;

    /**
     * @type {boolean}
     * @private
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
     * @type {HTMLElement}
     * @private
     */
    _element;

    /**
     * @type {Mat4}
     * @private
     */
    _cameraTransform = new Mat4();

    /**
     * @type {Mat4}
     * @private
     */
    _baseTransform = new Mat4();

    /**
     * The scene size. The zoom, pan and fly speeds are relative to this size.
     *
     * @attribute
     * @type {number}
     */
    sceneSize = 100;

    /**
     * The look sensitivity.
     *
     * @attribute
     * @type {number}
     */
    lookSensitivity = 0.2;

    /**
     * The look damping. A higher value means less damping. A value of 1 means no damping.
     *
     * @attribute
     * @type {number}
     */
    lookDamping = 0.97;

    /**
     * The move damping. A higher value means less damping. A value of 1 means no damping.
     *
     * @attribute
     * @type {number}
     */
    moveDamping = 0.98;

    /**
     * Enable orbit camera controls.
     *
     * @attribute
     * @type {boolean}
     */
    enableOrbit = true;

    /**
     * Enable pan camera controls.
     *
     * @attribute
     * @type {boolean}
     */
    enablePan = true;

    /**
     * Enable fly camera controls.
     *
     * @attribute
     * @type {boolean}
     */
    enableFly = true;

    /**
     * The touch pinch speed.
     *
     * @attribute
     * @type {number}
     */
    pinchSpeed = 5;

    /**
     * The mouse wheel speed.
     *
     * @attribute
     * @type {number}
     */
    wheelSpeed = 0.005;

    /**
     * The minimum scale the camera can zoom (absolute value).
     *
     * @attribute
     * @type {number}
     */
    zoomScaleMin = 0;

    /**
     * The fly move speed relative to the scene size.
     *
     * @attribute
     * @type {number}
     */
    moveSpeed = 2;

    /**
     * The fly sprint speed relative to the scene size.
     *
     * @attribute
     * @type {number}
     */
    sprintSpeed = 4;

    /**
     * The fly crouch speed relative to the scene size.
     *
     * @attribute
     * @type {number}
     */
    crouchSpeed = 1;

    /**
     * @param {object} args - The script arguments.
     */
    constructor(args) {
        super(args);
        const {
            element,
            enableOrbit,
            enablePan,
            enableFly,
            focusPoint,
            sceneSize,
            lookSensitivity,
            lookDamping,
            moveDamping,
            pitchRange,
            pinchSpeed,
            wheelSpeed,
            zoomMin,
            zoomMax,
            moveSpeed,
            sprintSpeed,
            crouchSpeed
        } = args.attributes;

        this._element = element ?? this.app.graphicsDevice.canvas;

        this.enableOrbit = enableOrbit ?? this.enableOrbit;
        this.enablePan = enablePan ?? this.enablePan;
        this.enableFly = enableFly ?? this.enableFly;
        this.sceneSize = sceneSize ?? this.sceneSize;
        this.lookSensitivity = lookSensitivity ?? this.lookSensitivity;
        this.lookDamping = lookDamping ?? this.lookDamping;
        this.moveDamping = moveDamping ?? this.moveDamping;
        this.pinchSpeed = pinchSpeed ?? this.pinchSpeed;
        this.wheelSpeed = wheelSpeed ?? this.wheelSpeed;

        this.moveSpeed = moveSpeed ?? this.moveSpeed;
        this.sprintSpeed = sprintSpeed ?? this.sprintSpeed;
        this.crouchSpeed = crouchSpeed ?? this.crouchSpeed;

        this._onWheel = this._onWheel.bind(this);
        this._onKeyDown = this._onKeyDown.bind(this);
        this._onKeyUp = this._onKeyUp.bind(this);
        this._onPointerDown = this._onPointerDown.bind(this);
        this._onPointerMove = this._onPointerMove.bind(this);
        this._onPointerUp = this._onPointerUp.bind(this);
        this._onContextMenu = this._onContextMenu.bind(this);

        if (!this.entity.camera) {
            throw new Error('CameraControls script requires a camera component');
        }
        this.attach(this.entity.camera);

        this.focusPoint = focusPoint ?? this.focusPoint;
        this.pitchRange = pitchRange ?? this.pitchRange;
        this.zoomMin = zoomMin ?? this.zoomMin;
        this.zoomMax = zoomMax ?? this.zoomMax;
    }

    /**
     * The element to attach the camera controls to.
     *
     * @type {HTMLElement}
     */
    set element(value) {
        this._element = value;

        const camera = this._camera;
        this.detach();
        this.attach(camera);
    }

    get element() {
        return this._element;
    }

    /**
     * The camera's focus point.
     *
     * @param {Vec3} point - The focus point.
     */
    set focusPoint(point) {
        if (!this._camera) {
            return;
        }
        this.focus(point, this._camera.entity.getPosition(), false);
    }

    get focusPoint() {
        return this._origin;
    }

    /**
     * The camera's pitch range. Having a value of -360 means no minimum pitch and 360 means no
     * maximum pitch.
     *
     * @attribute
     * @type {Vec2}
     */
    set pitchRange(value) {
        this._pitchRange.copy(value);
        this._dir.x = this._clampPitch(this._dir.x);
        this._smoothTransform(-1);
    }

    get pitchRange() {
        return this._pitchRange;
    }

    /**
     * The minimum zoom distance relative to the scene size.
     *
     * @attribute
     * @type {number}
     */
    set zoomMin(value) {
        this._zoomMin = value;
        this._zoomDist = this._clampZoom(this._zoomDist);
        this._smoothZoom(-1);
    }

    get zoomMin() {
        return this._zoomMin;
    }

    /**
     * The maximum zoom distance relative to the scene size. Having a value less than or equal to
     * zoomMin means no maximum zoom.
     *
     * @attribute
     * @type {number}
     */
    set zoomMax(value) {
        this._zoomMax = value;
        this._zoomDist = this._clampZoom(this._zoomDist);
        this._smoothZoom(-1);

    }

    get zoomMax() {
        return this._zoomMax;
    }

    /**
     * @private
     * @param {number} value - The value to clamp.
     * @returns {number} - The clamped value.
     */
    _clampPitch(value) {
        const min = this._pitchRange.x === -360 ? -Infinity : this._pitchRange.x;
        const max = this._pitchRange.y === 360 ? Infinity : this._pitchRange.y;
        return math.clamp(value, min, max);
    }

    /**
     * @private
     * @param {number} value - The value to clamp.
     * @returns {number} - The clamped value.
     */
    _clampZoom(value) {
        const min = (this._camera?.nearClip ?? 0) + this.zoomMin * this.sceneSize;
        const max = this.zoomMax <= this.zoomMin ? Infinity : this.zoomMax * this.sceneSize;
        return math.clamp(value, min, max);
    }

    /**
     * @private
     * @param {MouseEvent} event - The mouse event.
     */
    _onContextMenu(event) {
        event.preventDefault();
    }

    /**
     * @private
     * @param {PointerEvent} event - The pointer event.
     * @returns {boolean} Whether the mouse pan should start.
     */
    _isStartMousePan(event) {
        if (!this.enablePan) {
            return false;
        }
        if (event.shiftKey) {
            return true;
        }
        if (!this.enableOrbit && !this.enableFly) {
            return event.button === 0 || event.button === 1 || event.button === 2;
        }
        if (!this.enableOrbit || !this.enableFly) {
            return event.button === 1 || event.button === 2;
        }
        return event.button === 1;
    }

    /**
     * @private
     * @param {PointerEvent} event - The pointer event.
     * @returns {boolean} Whether the fly should start.
     */
    _isStartFly(event) {
        if (!this.enableFly) {
            return false;
        }
        if (!this.enableOrbit && !this.enablePan) {
            return event.button === 0 || event.button === 1 || event.button === 2;
        }
        if (!this.enableOrbit) {
            return event.button === 0;
        }
        return event.button === 2;
    }

    /**
     * @param {PointerEvent} event - The pointer event.
     * @returns {boolean} Whether the orbit should start.
     * @private
     */
    _isStartOrbit(event) {
        if (!this.enableOrbit) {
            return false;
        }
        if (!this.enableFly && !this.enablePan) {
            return event.button === 0 || event.button === 1 || event.button === 2;
        }
        return event.button === 0;
    }

    /**
     * @private
     * @param {PointerEvent} event - The pointer event.
     */
    _onPointerDown(event) {
        if (!this._camera) {
            return;
        }
        this._element.setPointerCapture(event.pointerId);
        this._pointerEvents.set(event.pointerId, event);

        const startTouchPan = this.enablePan && this._pointerEvents.size === 2;
        const startMousePan = this._isStartMousePan(event);
        const startFly = this._isStartFly(event);
        const startOrbit = this._isStartOrbit(event);

        if (startTouchPan) {
            // start touch pan
            this._lastPinchDist = this._getPinchDist();
            this._getMidPoint(this._lastPosition);
            this._panning = true;
        }
        if (startMousePan) {
            // start mouse pan
            this._lastPosition.set(event.clientX, event.clientY);
            this._panning = true;
        }
        if (startFly) {
            // start fly
            this._zoomDist = this._cameraDist;
            this._origin.copy(this._camera.entity.getPosition());
            this._position.copy(this._origin);
            this._cameraTransform.setTranslate(0, 0, 0);
            this._flying = true;
        }
        if (startOrbit) {
            // start orbit
            this._orbiting = true;
        }
    }

    /**
     * @private
     * @param {PointerEvent} event - The pointer event.
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
            } else if (this._orbiting || this._flying) {
                this._look(event);
            }
            return;
        }

        if (this._pointerEvents.size === 2) {
            // touch pan
            if (this._panning) {
                this._pan(this._getMidPoint(tmpVa));
            }

            // pinch zoom
            const pinchDist = this._getPinchDist();
            if (this._lastPinchDist > 0) {
                this._zoom((this._lastPinchDist - pinchDist) * this.pinchSpeed);
            }
            this._lastPinchDist = pinchDist;
        }

    }

    /**
     * @private
     * @param {PointerEvent} event - The pointer event.
     */
    _onPointerUp(event) {
        this._element.releasePointerCapture(event.pointerId);
        this._pointerEvents.delete(event.pointerId);
        if (this._pointerEvents.size < 2) {
            this._lastPinchDist = -1;
            this._panning = false;
        }
        if (this._orbiting) {
            this._orbiting = false;
        }
        if (this._panning) {
            this._panning = false;
        }
        if (this._flying) {
            tmpV1.copy(this._camera.entity.forward).mulScalar(this._zoomDist);
            this._origin.add(tmpV1);
            this._position.add(tmpV1);
            this._flying = false;
        }
    }

    /**
     * @private
     * @param {WheelEvent} event - The wheel event.
     */
    _onWheel(event) {
        event.preventDefault();
        this._zoom(event.deltaY);
    }

    /**
     * @private
     * @param {KeyboardEvent} event - The keyboard event.
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
     * @private
     * @param {KeyboardEvent} event - The keyboard event.
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
     * @private
     * @param {PointerEvent} event - The pointer event.
     */
    _look(event) {
        if (event.target !== this.app.graphicsDevice.canvas) {
            return;
        }
        const movementX = event.movementX || 0;
        const movementY = event.movementY || 0;
        this._dir.x = this._clampPitch(this._dir.x - movementY * this.lookSensitivity);
        this._dir.y -= movementX * this.lookSensitivity;
    }

    /**
     * @param {number} dt - The delta time.
     */
    _move(dt) {
        if (!this.enableFly) {
            return;
        }

        tmpV1.set(0, 0, 0);
        if (this._key.forward) {
            tmpV1.add(this._camera.entity.forward);
        }
        if (this._key.backward) {
            tmpV1.sub(this._camera.entity.forward);
        }
        if (this._key.left) {
            tmpV1.sub(this._camera.entity.right);
        }
        if (this._key.right) {
            tmpV1.add(this._camera.entity.right);
        }
        if (this._key.up) {
            tmpV1.add(this._camera.entity.up);
        }
        if (this._key.down) {
            tmpV1.sub(this._camera.entity.up);
        }
        tmpV1.normalize();
        const speed = this._key.crouch ? this.crouchSpeed : this._key.sprint ? this.sprintSpeed : this.moveSpeed;
        tmpV1.mulScalar(this.sceneSize * speed * dt);
        this._origin.add(tmpV1);
    }

    /**
     * @private
     * @param {Vec2} out - The output vector.
     * @returns {Vec2} The mid point.
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
     * @private
     * @param {Vec2} pos - The screen position.
     * @param {Vec3} point - The output point.
     */
    _screenToWorldPan(pos, point) {
        const mouseW = this._camera.screenToWorld(pos.x, pos.y, 1);
        const cameraPos = this._camera.entity.getPosition();

        const focusDirScaled = tmpV1.copy(this._camera.entity.forward).mulScalar(this._zoomDist);
        const focalPos = tmpV2.add2(cameraPos, focusDirScaled);
        const planeNormal = focusDirScaled.mulScalar(-1).normalize();

        const plane = tmpP1.setFromPointNormal(focalPos, planeNormal);
        const ray = tmpR1.set(cameraPos, mouseW.sub(cameraPos).normalize());

        plane.intersectsRay(ray, point);
    }

    /**
     * @private
     * @param {Vec2} pos - The screen position.
     */
    _pan(pos) {
        if (!this.enablePan) {
            return;
        }

        const start = new Vec3();
        const end = new Vec3();

        this._screenToWorldPan(this._lastPosition, start);
        this._screenToWorldPan(pos, end);

        tmpV1.sub2(start, end);
        this._origin.add(tmpV1);

        this._lastPosition.copy(pos);
    }

    /**
     * @private
     * @param {number} delta - The delta.
     */
    _zoom(delta) {
        if (!this.enableOrbit && !this.enablePan) {
            return;
        }

        if (!this._camera) {
            return;
        }
        const distNormalized = this._zoomDist / (ZOOM_SCALE_SCENE_MULT * this.sceneSize);
        const scale = math.clamp(distNormalized, this.zoomScaleMin, 1);
        this._zoomDist += (delta * this.wheelSpeed * this.sceneSize * scale);
        this._zoomDist = this._clampZoom(this._zoomDist);
    }

    /**
     * @private
     * @param {number} dt - The delta time.
     */
    _smoothZoom(dt) {
        const a = dt === -1 ? 1 : lerpRate(this.moveDamping, dt);
        this._cameraDist = math.lerp(this._cameraDist, this._zoomDist, a);
        this._cameraTransform.setTranslate(0, 0, this._cameraDist);
    }

    /**
     * @private
     * @param {number} dt - The delta time.
     */
    _smoothTransform(dt) {
        const a = dt === -1 ? 1 : lerpRate(this.lookDamping, dt);
        this._angles.x = math.lerp(this._angles.x, this._dir.x, a);
        this._angles.y = math.lerp(this._angles.y, this._dir.y, a);
        this._position.lerp(this._position, this._origin, a);
        this._baseTransform.setTRS(this._position, tmpQ1.setFromEulerAngles(this._angles), Vec3.ONE);
    }

    /**
     * @private
     */
    _updateTransform() {
        tmpM1.copy(this._baseTransform).mul(this._cameraTransform);
        this._camera.entity.setPosition(tmpM1.getTranslation());
        this._camera.entity.setEulerAngles(tmpM1.getEulerAngles());
    }

    /**
     * Focus the camera on a point.
     *
     * @param {Vec3} point - The point.
     * @param {Vec3} [start] - The start.
     * @param {boolean} [smooth] - Whether to smooth the focus.
     */
    focus(point, start, smooth = true) {
        if (!this._camera) {
            return;
        }
        if (this._flying) {
            return;
        }
        if (!start) {
            this._origin.copy(point);
            if (!smooth) {
                this._position.copy(point);
            }
            return;
        }

        tmpV1.sub2(start, point);
        const elev = Math.atan2(tmpV1.y, Math.sqrt(tmpV1.x * tmpV1.x + tmpV1.z * tmpV1.z)) * math.RAD_TO_DEG;
        const azim = Math.atan2(tmpV1.x, tmpV1.z) * math.RAD_TO_DEG;
        this._dir.set(this._clampPitch(-elev), azim);

        this._origin.copy(point);

        this._cameraTransform.setTranslate(0, 0, 0);

        const pos = this._camera.entity.getPosition();
        const rot = this._camera.entity.getRotation();
        this._baseTransform.setTRS(pos, rot, Vec3.ONE);

        this._zoomDist = this._clampZoom(tmpV1.length());

        if (!smooth) {
            this._smoothZoom(-1);
            this._smoothTransform(-1);
        }

        this._updateTransform();
    }

    /**
     * Reset the zoom. For orbit and panning only.
     *
     * @param {number} [zoomDist] - The zoom distance.
     * @param {boolean} [smooth] - Whether to smooth the zoom.
     */
    resetZoom(zoomDist = 0, smooth = true) {
        this._zoomDist = zoomDist;
        if (!smooth) {
            this._cameraDist = zoomDist;
        }
    }

    /**
     * Refocus the camera.
     *
     * @param {Vec3} point - The point.
     * @param {Vec3} [start] - The start.
     * @param {number} [zoomDist] - The zoom distance.
     * @param {boolean} [smooth] - Whether to smooth the refocus.
     */
    refocus(point, start = null, zoomDist, smooth = true) {
        if (typeof zoomDist === 'number') {
            this.resetZoom(zoomDist, smooth);
        }
        this.focus(point, start, smooth);
    }

    /**
     * @param {CameraComponent} camera - The camera component.
     */
    attach(camera) {
        this._camera = camera;

        // Attach events to canvas instead of window
        this._element.addEventListener('wheel', this._onWheel, PASSIVE);
        this._element.addEventListener('pointerdown', this._onPointerDown);
        this._element.addEventListener('pointermove', this._onPointerMove);
        this._element.addEventListener('pointerup', this._onPointerUp);
        this._element.addEventListener('contextmenu', this._onContextMenu);

        // These can stay on window since they're keyboard events
        window.addEventListener('keydown', this._onKeyDown, false);
        window.addEventListener('keyup', this._onKeyUp, false);
    }

    detach() {
        // Remove from canvas instead of window
        this._element.removeEventListener('wheel', this._onWheel, PASSIVE);
        this._element.removeEventListener('pointermove', this._onPointerMove);
        this._element.removeEventListener('pointerdown', this._onPointerDown);
        this._element.removeEventListener('pointerup', this._onPointerUp);
        this._element.removeEventListener('contextmenu', this._onContextMenu);

        // Remove keyboard events from window
        window.removeEventListener('keydown', this._onKeyDown, false);
        window.removeEventListener('keyup', this._onKeyUp, false);

        this._camera = null;

        this._dir.x = this._angles.x;
        this._dir.y = this._angles.y;
        this._origin.copy(this._position);

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
     * @param {number} dt - The delta time.
     */
    update(dt) {
        if (this.app.xr?.active) {
            return;
        }

        if (!this._camera) {
            return;
        }

        this._move(dt);

        if (!this._flying) {
            this._smoothZoom(dt);
        }
        this._smoothTransform(dt);
        this._updateTransform();
    }

    destroy() {
        this.detach();
    }
}

export { CameraControls };
