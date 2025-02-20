import { Vec2, Vec3, Ray, Plane, Mat4, Quat, Script, math, EventHandler } from 'playcanvas';

/** @import { CameraComponent } from 'playcanvas' */

const tmpVa = new Vec2();
const tmpV1 = new Vec3();
const tmpV2 = new Vec3();
const tmpM1 = new Mat4();
const tmpQ1 = new Quat();
const tmpR1 = new Ray();
const tmpP1 = new Plane();

/** @type {AddEventListenerOptions & EventListenerOptions} */
const PASSIVE = { passive: false };
const ZOOM_SCALE_SCENE_MULT = 10;
const EPSILON = 0.0001;

/**
 * Calculate the lerp rate.
 *
 * @param {number} damping - The damping.
 * @param {number} dt - The delta time.
 * @returns {number} - The lerp rate.
 */
const lerpRate = (damping, dt) => 1 - Math.pow(damping, dt * 1000);

const MOBILE_SCREEN_SIZE = 768;

class JoyStick {
    /**
     * @type {number}
     * @private
     */
    _size = 100;

    /**
     * @type {HTMLDivElement}
     * @private
     */
    _base;

    /**
     * @type {HTMLDivElement}
     * @private
     */
    _inner;

    /**
     * @type {Vec2}
     * @private
     */
    _basePos = new Vec2();

    /**
     * @type {Vec2}
     * @private
     */
    _innerPos = new Vec2();

    /**
     * @type {number}
     * @private
     */
    _innerScale = 0.6;

    /**
     * @type {number}
     * @private
     */
    _innerMaxDist = 70;

    /**
     * @type {Vec2}
     * @private
     */
    _value = new Vec2();

    constructor(size) {
        this._size = size ?? this._size;

        this._base = document.createElement('div');
        this._base.id = 'joystick-base';
        Object.assign(this._base.style, {
            display: 'none',
            position: 'absolute',
            width: `${this._size}px`,
            height: `${this._size}px`,
            borderRadius: '50%',
            backgroundColor: 'rgba(255, 255, 255, 0.5)'
        });

        this._inner = document.createElement('div');
        this._inner.id = 'joystick-inner';
        Object.assign(this._inner.style, {
            display: 'none',
            position: 'absolute',
            width: `${this._size * this._innerScale}px`,
            height: `${this._size * this._innerScale}px`,
            borderRadius: '50%',
            backgroundColor: 'rgba(0, 0, 0, 0.5)'
        });
    }

    get dom() {
        return [this._base, this._inner];
    }

    set hidden(value) {
        const display = value ? 'none' : 'block';
        this._base.style.display = display;
        this._inner.style.display = display;
        this._value.set(0, 0);
    }

    get hidden() {
        return this._base.style.display === 'none';
    }

    get value() {
        return this._value;
    }

    setBase(x, y) {
        this._basePos.set(x, y);
        this._base.style.left = `${this._basePos.x - this._size * 0.5}px`;
        this._base.style.top = `${this._basePos.y - this._size * 0.5}px`;
    }

    setInner(x, y) {
        this._innerPos.set(x, y);
        tmpVa.sub2(this._innerPos, this._basePos);
        const dist = tmpVa.length();
        if (dist > this._innerMaxDist) {
            tmpVa.normalize().mulScalar(this._innerMaxDist);
            this._innerPos.add2(this._basePos, tmpVa);
        }
        const vx = math.clamp(tmpVa.x / this._innerMaxDist, -1, 1);
        const vy = math.clamp(tmpVa.y / this._innerMaxDist, -1, 1);
        this._value.set(vx, vy);
        this._inner.style.left = `${this._innerPos.x - this._size * this._innerScale * 0.5}px`;
        this._inner.style.top = `${this._innerPos.y - this._size * this._innerScale * 0.5}px`;
    }
}

class Input extends EventHandler {
    /**
     * @private
     * @type {HTMLElement | null}
     */
    _element = null;

    /**
     * @type {Map<number, PointerEvent>}
     * @private
     */
    _pointerEvents = new Map();

    /**
     * @type {Record<string, number>}
     * @private
     */
    _key = {
        forward: 0,
        backward: 0,
        left: 0,
        right: 0,
        up: 0,
        down: 0,
        sprint: 0,
        crouch: 0
    };

    /**
     * @type {number}
     * @private
     */
    _lastPinchDist = -1;

    /**
     * @type {JoyStick}
     * @private
     */
    _joystick = new JoyStick();

    constructor() {
        super();

        this._onWheel = this._onWheel.bind(this);
        this._onPointerDown = this._onPointerDown.bind(this);
        this._onPointerMove = this._onPointerMove.bind(this);
        this._onPointerUp = this._onPointerUp.bind(this);
        this._onContextMenu = this._onContextMenu.bind(this);
        this._onKeyDown = this._onKeyDown.bind(this);
        this._onKeyUp = this._onKeyUp.bind(this);

        if (this.isMobile) {
            document.body.append(...this._joystick.dom);
        }
    }

    get isMobile() {
        return Math.min(window.screen.width, window.screen.height) < MOBILE_SCREEN_SIZE;
    }

    /**
     * @private
     * @param {WheelEvent} event - The wheel event.
     */
    _onWheel(event) {
        event.preventDefault();
        this.fire('wheel', event.deltaY);
    }

    /**
     * @private
     * @param {PointerEvent} event - The pointer event.
     */
    _onPointerDown(event) {
        this._element?.setPointerCapture(event.pointerId);
        this._pointerEvents.set(event.pointerId, event);

        if (this._pointerEvents.size === 2) {
            this._lastPinchDist = this.getPinchDist();
        }

        if (this.isMobile) {
            if (event.clientX < window.innerWidth * 0.5) {
                this._joystick.hidden = false;
                this._joystick.setBase(event.clientX, event.clientY);
                this._joystick.setInner(event.clientX, event.clientY);
            } else {
                this.fire('start', event, this._pointerEvents.size);
            }
        } else {
            this.fire('start', event, this._pointerEvents.size);
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

        if (this._pointerEvents.size === 2) {
            const pinchDist = this.getPinchDist();
            if (this._lastPinchDist > 0) {
                const pinchDelta = this._lastPinchDist - pinchDist;
                this.fire('pinch', pinchDelta);
            }
            this._lastPinchDist = pinchDist;
        }

        if (this.isMobile) {
            this._joystick.setInner(event.clientX, event.clientY);

            if (event.clientX > window.innerWidth * 0.5) {
                this.fire('move', event, this._pointerEvents.size);
            }
        } else {
            this.fire('move', event, this._pointerEvents.size);
        }

    }

    /**
     * @private
     * @param {PointerEvent} event - The pointer event.
     */
    _onPointerUp(event) {
        this._element?.releasePointerCapture(event.pointerId);
        this._pointerEvents.delete(event.pointerId);

        if (this._pointerEvents.size < 2) {
            this._lastPinchDist = -1;
        }

        if (this.isMobile) {
            this._joystick.hidden = true;

            if (event.clientX > window.innerWidth * 0.5) {
                this.fire('end', event, this._pointerEvents.size);
            }
        } else {
            this.fire('end', event, this._pointerEvents.size);
        }

    }

    /**
     * @private
     * @param {MouseEvent} event - The wheel event.
     */
    _onContextMenu(event) {
        event.preventDefault();
    }

    _onKeyDown(event) {
        event.stopPropagation();
        switch (event.key.toLowerCase()) {
            case 'w':
            case 'arrowup':
                this._key.forward = 1;
                break;
            case 's':
            case 'arrowdown':
                this._key.backward = 1;
                break;
            case 'a':
            case 'arrowleft':
                this._key.left = 1;
                break;
            case 'd':
            case 'arrowright':
                this._key.right = 1;
                break;
            case 'q':
                this._key.up = 1;
                break;
            case 'e':
                this._key.down = 1;
                break;
            case 'shift':
                this._key.sprint = 1;
                break;
            case 'control':
                this._key.crouch = 1;
                break;
        }
    }

    _onKeyUp(event) {
        event.stopPropagation();
        switch (event.key.toLowerCase()) {
            case 'w':
            case 'arrowup':
                this._key.forward = 0;
                break;
            case 's':
            case 'arrowdown':
                this._key.backward = 0;
                break;
            case 'a':
            case 'arrowleft':
                this._key.left = 0;
                break;
            case 'd':
            case 'arrowright':
                this._key.right = 0;
                break;
            case 'q':
                this._key.up = 0;
                break;
            case 'e':
                this._key.down = 0;
                break;
            case 'shift':
                this._key.sprint = 0;
                break;
            case 'control':
                this._key.crouch = 0;
                break;
        }
    }

    /**
     * @param {string} name - The key name.
     * @returns {number} - The key value.
     */
    key(name) {
        if (this.isMobile) {
            switch (name) {
                case 'forward':
                    return Math.max(0, -this._joystick.value.y);
                case 'backward':
                    return Math.max(0, this._joystick.value.y);
                case 'left':
                    return Math.max(0, -this._joystick.value.x);
                case 'right':
                    return Math.max(0, this._joystick.value.x);
                default:
                    return 0;
            }
        }

        return +this._key[name];
    }

    /**
     * @param {Vec2} out - The output vector.
     * @returns {Vec2} The mid point.
     */
    getMidPoint(out) {
        const [a, b] = this._pointerEvents.values();
        const dx = a.clientX - b.clientX;
        const dy = a.clientY - b.clientY;
        return out.set(b.clientX + dx * 0.5, b.clientY + dy * 0.5);
    }

    /**
     * @returns {number} The pinch distance.
     */
    getPinchDist() {
        const [a, b] = this._pointerEvents.values();
        const dx = a.clientX - b.clientX;
        const dy = a.clientY - b.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * @param {HTMLElement} element - The element.
     */
    attach(element) {
        if (this._element) {
            this.detach();
        }
        this._element = element;
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
        if (!this._element) {
            return;
        }
        this._element.removeEventListener('wheel', this._onWheel, PASSIVE);
        this._element.removeEventListener('pointerdown', this._onPointerDown);
        this._element.removeEventListener('pointermove', this._onPointerMove);
        this._element.removeEventListener('pointerup', this._onPointerUp);
        this._element.removeEventListener('contextmenu', this._onContextMenu);

        window.removeEventListener('keydown', this._onKeyDown, false);
        window.removeEventListener('keyup', this._onKeyUp, false);

        this._pointerEvents.clear();

        this._key = {
            forward: 0,
            backward: 0,
            left: 0,
            right: 0,
            up: 0,
            down: 0,
            sprint: 0,
            crouch: 0
        };
    }
}

class CameraControls extends Script {
    /**
     * Fired to clamp the position (Vec3).
     *
     * @event
     * @example
     * cameraControls.on('clamp:position', (position) => {
     *     position.y = Math.max(0, position.y);
     * });
     */
    static EVENT_CLAMP_POSITION = 'clamp:position';

    /**
     * Fired to clamp the angles (Vec2).
     *
     * @event
     * @example
     * cameraControls.on('clamp:angles', (angles) => {
     *    angles.x = Math.max(-90, Math.min(90, angles.x));
     * });
     */
    static EVENT_CLAMP_ANGLES = 'clamp:angles';

    /**
     * @private
     * @type {CameraComponent | null}
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
     * @type {Input}
     * @private
     */
    _input = new Input();

    /**
     * @type {Vec2}
     * @private
     */
    _lastPosition = new Vec2();

    /**
     * @type {boolean}
     * @private
     */
    _orbiting = true;

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
     * @type {boolean}
     * @private
     */
    _moving = false;

    /**
     * @type {boolean}
     * @private
     */
    _focusing = false;

    /**
     * @type {HTMLElement}
     * @private
     */
    _element = this.app.graphicsDevice.canvas;

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
     * @attribute
     * @title Scene Size
     * @description The scene size. The zoom, pan and fly speeds are relative to this size.
     * @type {number}
     */
    sceneSize = 100;

    /**
     * Enable orbit camera controls.
     *
     * @attribute
     * @title Enable Orbit
     * @description Enable orbit camera controls.
     * @type {boolean}
     */
    enableOrbit = true;

    /**
     * @attribute
     * @title Enable Pan
     * @description Enable pan camera controls.
     * @type {boolean}
     */
    enablePan = true;

    /**
     * @attribute
     * @title Enable Fly
     * @description Enable fly camera controls.
     * @type {boolean}
     */
    enableFly = true;

    /**
     * @attribute
     * @title Focus Damping
     * @description The damping applied when calling {@link CameraControls#focus}. A higher value means
     * more damping. A value of 0 means no damping.
     * @type {number}
     */
    focusDamping = 0.98;

    /**
     * @attribute
     * @title Rotate Speed
     * @description The rotation speed.
     * @enabledif {enableOrbit}
     * @type {number}
     */
    rotateSpeed = 0.2;

    /**
     * @attribute
     * @title Rotate Damping
     * @description The rotation damping. A higher value means more damping. A value of 0 means no damping.
     * @enabledif {enableOrbit}
     * @type {number}
     */
    rotateDamping = 0.98;

    /**
     * @attribute
     * @title Move Speed
     * @description The fly move speed relative to the scene size.
     * @enabledif {enableFly || enablePan}
     * @type {number}
     */
    moveSpeed = 2;

    /**
     * @attribute
     * @title Move Fast Speed
     * @description The fast fly move speed relative to the scene size.
     * @enabledif {enableFly || enablePan}
     * @type {number}
     */
    moveFastSpeed = 4;

    /**
     * @attribute
     * @title Move Slow Speed
     * @description The slow fly move speed relative to the scene size.
     * @enabledif {enableFly || enablePan}
     * @type {number}
     */
    moveSlowSpeed = 1;

    /**
     * @attribute
     * @title Move Damping
     * @description The movement damping. A higher value means more damping. A value of 0 means no damping.
     * @enabledif {enableFly || enablePan}
     * @type {number}
     */
    moveDamping = 0.98;

    /**
     * @attribute
     * @title Zoom Speed
     * @description The zoom speed relative to the scene size.
     * @type {number}
     */
    zoomSpeed = 0.005;

    /**
     * @attribute
     * @title Zoom Pinch Sensitivity
     * @description The touch zoom pinch sensitivity.
     * @type {number}
     */
    zoomPinchSens = 5;

    /**
     * @attribute
     * @title Zoom Damping
     * @description The zoom damping. A higher value means more damping. A value of 0 means no damping.
     * @type {number}
     */
    zoomDamping = 0.98;

    /**
     * @attribute
     * @title Zoom Scale Min
     * @description The minimum scale the camera can zoom (absolute value).
     * @type {number}
     */
    zoomScaleMin = 0;

    initialize() {
        this._input.on('wheel', wheelDelta => this._zoom(wheelDelta));
        this._input.on('pinch', pinchDelta => this._zoom(pinchDelta * this.zoomPinchSens));
        this._input.on('start', this._onInputStart, this);
        this._input.on('move', this._onInputMove, this);
        this._input.on('end', this._onInputEnd, this);

        if (!this.entity.camera) {
            throw new Error('CameraControls script requires a camera component');
        }
        this.attach(this.entity.camera);

        this.focusPoint = this._origin ?? this.focusPoint;
        this.pitchRange = this._pitchRange ?? this.pitchRange;
        this.zoomMin = this._zoomMin ?? this.zoomMin;
        this.zoomMax = this._zoomMax ?? this.zoomMax;

        this.on('destroy', this.destroy, this);
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
        if (camera) {
            this.attach(camera);
        }
    }

    get element() {
        return this._element;
    }

    /**
     * @attribute
     * @title Focus Point
     * @description The camera's focus point.
     * @type {Vec3}
     * @default [0, 0, 0]
     */
    set focusPoint(point) {
        if (!this._camera) {
            if (point instanceof Vec3) {
                this._origin.copy(point);
            }
            return;
        }
        this.focus(point, this.entity.getPosition(), false);
    }

    get focusPoint() {
        return this._origin;
    }

    /**
     * @attribute
     * @title Pitch Range
     * @description The camera's pitch range. Having a value of -360 means no minimum pitch and 360
     * means no maximum pitch.
     * @type {Vec2}
     * @default [-360, 360]
     */
    set pitchRange(value) {
        if (!(value instanceof Vec2)) {
            return;
        }
        this._pitchRange.copy(value);
        this._clampAngles(this._dir);
        this._smoothTransform(-1);
    }

    get pitchRange() {
        return this._pitchRange;
    }

    /**
     * @attribute
     * @title Zoom Min
     * @description The minimum zoom distance relative to the scene size.
     * @type {number}
     * @default 0
     */
    set zoomMin(value) {
        this._zoomMin = value ?? this._zoomMin;
        this._zoomDist = this._clampZoom(this._zoomDist);
        this._smoothZoom(-1);
    }

    get zoomMin() {
        return this._zoomMin;
    }

    /**
     * @attribute
     * @title Zoom Max
     * @description The maximum zoom distance relative to the scene size. Having a value less than
     * or equal to zoomMin means no maximum zoom.
     * @type {number}
     * @default 0
     */
    set zoomMax(value) {
        this._zoomMax = value ?? this._zoomMax;
        this._zoomDist = this._clampZoom(this._zoomDist);
        this._smoothZoom(-1);

    }

    get zoomMax() {
        return this._zoomMax;
    }


    /**
     * @param {Vec3} out - The output vector.
     * @returns {Vec3} - The focus vector.
     */
    _focusDir(out) {
        return out.copy(this.entity.forward).mulScalar(this._zoomDist);
    }

    /**
     * @private
     * @param {Vec2} angles - The value to clamp.
     */
    _clampAngles(angles) {
        const min = this._pitchRange.x === -360 ? -Infinity : this._pitchRange.x;
        const max = this._pitchRange.y === 360 ? Infinity : this._pitchRange.y;
        angles.x = math.clamp(angles.x, min, max);

        // emit clamp event
        this.fire(CameraControls.EVENT_CLAMP_ANGLES, angles);
    }

    /**
     * @private
     * @param {Vec3} position - The position to clamp.
     */
    _clampPosition(position) {
        if (this._flying) {
            tmpV1.set(0, 0, 0);
        } else {
            this._focusDir(tmpV1);
        }

        // emit clamp event
        position.sub(tmpV1);
        this.fire(CameraControls.EVENT_CLAMP_POSITION, position);
        position.add(tmpV1);
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
     * @returns {boolean} Whether the switch to orbit was successful.
     */
    _switchToOrbit() {
        if (!this.enableOrbit) {
            return false;
        }
        if (this._flying) {
            this._flying = false;
            this._focusDir(tmpV1);
            this._origin.add(tmpV1);
            this._position.add(tmpV1);
        }
        this._orbiting = true;
        return true;
    }

    /**
     * @private
     * @returns {boolean} Whether the switch to fly was successful.
     */
    _switchToFly() {
        if (!this.enableFly) {
            return false;
        }
        if (this._orbiting) {
            this._orbiting = false;
            this._zoomDist = this._cameraDist;
            this._origin.copy(this.entity.getPosition());
            this._position.copy(this._origin);
            this._cameraTransform.setTranslate(0, 0, 0);
        }
        this._flying = true;
        return true;
    }

    /**
     * @private
     * @param {PointerEvent} event - The pointer event.
     * @param {number} pointerCount - The pointer count.
     */
    _onInputStart(event, pointerCount) {
        if (!this._camera) {
            return;
        }

        const startTouchPan = this.enablePan && pointerCount === 2;
        const startMousePan = this._isStartMousePan(event);
        const startFly = this._isStartFly(event);
        const startOrbit = this._isStartOrbit(event);

        if (this._focusing) {
            this._cancelSmoothTransform();
            this._focusing = false;
        }

        if (startTouchPan) {
            // start touch pan
            this._input.getMidPoint(this._lastPosition);
            this._panning = true;
        }
        if (startMousePan) {
            // start mouse pan
            this._lastPosition.set(event.clientX, event.clientY);
            this._panning = true;
        }
        if (startFly) {
            // start fly
            this._switchToFly();
        }
        if (startOrbit) {
            // start orbit
            this._switchToOrbit();
        }
    }

    /**
     * @private
     * @param {PointerEvent} event - The pointer event.
     * @param {number} pointerCount - Whether there is a single pointer.
     */
    _onInputMove(event, pointerCount) {
        if (this._focusing) {
            this._cancelSmoothTransform();
            this._focusing = false;
        }

        if (pointerCount === 1) {
            if (this._panning) {
                // mouse pan
                this._pan(tmpVa.set(event.clientX, event.clientY));
            } else if (this._orbiting || this._flying) {
                this._look(event.movementX, event.movementY, event.target);
            }
            return;
        }

        if (pointerCount === 2) {
            // touch pan
            if (this._panning) {
                this._pan(this._input.getMidPoint(tmpVa));
            }
        }

    }

    /**
     * @private
     * @param {PointerEvent} event - The pointer event.
     * @param {boolean} pointerCount - Whether there is a single pointer.
     */
    _onInputEnd(event, pointerCount) {
        if (this._panning) {
            this._panning = false;
        }
    }

    /**
     * @private
     * @param {number} x - The x value.
     * @param {number} y - The y value.
     * @param {EventTarget | null} target - The target.
     */
    _look(x, y, target) {
        if (target !== this.app.graphicsDevice.canvas) {
            return;
        }
        const movementX = x || 0;
        const movementY = y || 0;
        this._dir.x -= movementY * this.rotateSpeed;
        this._dir.y -= movementX * this.rotateSpeed;
        this._clampAngles(this._dir);
    }

    /**
     * @param {number} dt - The delta time.
     */
    _move(dt) {
        if (!this.enableFly) {
            return;
        }
        tmpV1.set(0, 0, 0);
        tmpV1.add(tmpV2.copy(this.entity.forward).mulScalar(this._input.key('forward')));
        tmpV1.sub(tmpV2.copy(this.entity.forward).mulScalar(this._input.key('backward')));
        tmpV1.sub(tmpV2.copy(this.entity.right).mulScalar(this._input.key('left')));
        tmpV1.add(tmpV2.copy(this.entity.right).mulScalar(this._input.key('right')));
        tmpV1.add(tmpV2.copy(this.entity.up).mulScalar(this._input.key('up')));
        tmpV1.sub(tmpV2.copy(this.entity.up).mulScalar(this._input.key('down')));
        this._moving = tmpV1.length() > 0;
        const speed = this._input.key('crouch') ? this.moveSlowSpeed : this._input.key('sprint') ? this.moveFastSpeed : this.moveSpeed;
        tmpV1.mulScalar(this.sceneSize * speed * dt);
        this._origin.add(tmpV1);

        // clamp movement if locked
        if (this._moving) {
            if (this._focusing) {
                this._cancelSmoothTransform();
                this._focusing = false;
            }

            this._clampPosition(this._origin);
        }
    }

    /**
     * @private
     * @param {Vec2} pos - The screen position.
     * @param {Vec3} point - The output point.
     */
    _screenToWorldPan(pos, point) {
        if (!this._camera) {
            return;
        }
        const mouseW = this._camera.screenToWorld(pos.x, pos.y, 1);
        const cameraPos = this.entity.getPosition();

        const focusDir = this._focusDir(tmpV1);
        const focalPos = tmpV2.add2(cameraPos, focusDir);
        const planeNormal = focusDir.mulScalar(-1).normalize();

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
        if (this._flying) {
            if (!this._switchToOrbit()) {
                return;
            }
        }

        if (!this._camera) {
            return;
        }
        const distNormalized = this._zoomDist / (ZOOM_SCALE_SCENE_MULT * this.sceneSize);
        const scale = math.clamp(distNormalized, this.zoomScaleMin, 1);
        this._zoomDist += (delta * this.zoomSpeed * this.sceneSize * scale);
        this._zoomDist = this._clampZoom(this._zoomDist);
    }

    /**
     * @private
     * @param {number} dt - The delta time.
     */
    _smoothZoom(dt) {
        const a = dt === -1 ? 1 : lerpRate(this.zoomDamping, dt);
        this._cameraDist = math.lerp(this._cameraDist, this._zoomDist, a);
        this._cameraTransform.setTranslate(0, 0, this._cameraDist);
    }

    /**
     * @private
     * @param {number} dt - The delta time.
     */
    _smoothTransform(dt) {
        const ar = dt === -1 ? 1 : lerpRate(this._focusing ? this.focusDamping : this.rotateDamping, dt);
        const am = dt === -1 ? 1 : lerpRate(this._focusing ? this.focusDamping : this.moveDamping, dt);
        this._angles.x = math.lerpAngle(this._angles.x % 360, this._dir.x % 360, ar);
        this._angles.y = math.lerpAngle(this._angles.y % 360, this._dir.y % 360, ar);
        this._position.lerp(this._position, this._origin, am);
        this._baseTransform.setTRS(this._position, tmpQ1.setFromEulerAngles(this._angles), Vec3.ONE);

        const focusDelta = this._position.distance(this._origin) +
            Math.abs(this._angles.x - this._dir.x) +
            Math.abs(this._angles.y - this._dir.y);
        if (this._focusing && focusDelta < EPSILON) {
            this._focusing = false;
        }
    }

    /**
     * @private
     */
    _cancelSmoothZoom() {
        this._cameraDist = this._zoomDist;
    }

    /**
     * @private
     */
    _cancelSmoothTransform() {
        this._origin.copy(this._position);
        this._dir.set(this._angles.x, this._angles.y);
    }

    /**
     * @private
     */
    _updateTransform() {
        tmpM1.copy(this._baseTransform).mul(this._cameraTransform);
        this.entity.setPosition(tmpM1.getTranslation());
        this.entity.setEulerAngles(tmpM1.getEulerAngles());
    }

    /**
     * Focus the camera on a point.
     *
     * @param {Vec3} point - The focus point.
     * @param {Vec3} [start] - The camera start position.
     * @param {boolean} [smooth] - Whether to smooth the focus.
     */
    focus(point, start, smooth = true) {
        if (!this._camera) {
            return;
        }
        if (this._flying) {
            if (!this._switchToOrbit()) {
                return;
            }
        }

        if (start) {
            tmpV1.sub2(start, point);
            const elev = Math.atan2(tmpV1.y, Math.sqrt(tmpV1.x * tmpV1.x + tmpV1.z * tmpV1.z)) * math.RAD_TO_DEG;
            const azim = Math.atan2(tmpV1.x, tmpV1.z) * math.RAD_TO_DEG;
            this._clampAngles(this._dir.set(-elev, azim));

            this._origin.copy(point);

            this._cameraTransform.setTranslate(0, 0, 0);

            const pos = this.entity.getPosition();
            const rot = this.entity.getRotation();
            this._baseTransform.setTRS(pos, rot, Vec3.ONE);

            this._zoomDist = this._clampZoom(tmpV1.length());

            if (!smooth) {
                this._smoothZoom(-1);
                this._smoothTransform(-1);
            }

            this._updateTransform();
        } else {
            this._origin.copy(point);
            if (!smooth) {
                this._position.copy(point);
            }
        }

        if (smooth) {
            this._focusing = true;
        }
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
    refocus(point, start, zoomDist, smooth = true) {
        if (typeof zoomDist === 'number') {
            this.resetZoom(zoomDist, smooth);
        }
        this.focus(point, start, smooth);
    }

    /**
     * @param {CameraComponent} camera - The camera component.
     */
    attach(camera) {
        if (this._camera === camera) {
            return;
        }
        this._camera = camera;
        this._input.attach(this._element);
    }

    detach() {
        if (!this._camera) {
            return;
        }
        this._camera = null;
        this._input.detach();

        this._cancelSmoothZoom();
        this._cancelSmoothTransform();

        this._lastPinchDist = -1;
        this._panning = false;
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
        this._input.off();
    }
}

export { CameraControls };
