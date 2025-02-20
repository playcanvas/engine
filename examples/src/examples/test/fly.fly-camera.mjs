import { Vec2, Vec3, Mat4, Quat, math, EventHandler } from 'playcanvas';

const tmpVa = new Vec2();
const tmpV1 = new Vec3();
const tmpV2 = new Vec3();
const tmpQ1 = new Quat();

/** @type {AddEventListenerOptions & EventListenerOptions} */
const PASSIVE = { passive: false };

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

    /**
     * @param {number} [size] - The size of the joystick.
     */
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

    /**
     * @param {number} x - The x position.
     * @param {number} y - The y position.
     */
    setBase(x, y) {
        this._basePos.set(x, y);
        this._base.style.left = `${this._basePos.x - this._size * 0.5}px`;
        this._base.style.top = `${this._basePos.y - this._size * 0.5}px`;
    }

    /**
     * @param {number} x - The x position.
     * @param {number} y - The y position.
     */
    setInner(x, y) {
        this._innerPos.set(x, y);
        tmpVa.sub2(this._innerPos, this._basePos);
        const dist = tmpVa.length();
        if (dist > this._innerMaxDist) {
            tmpVa.normalize().mulScalar(this._innerMaxDist);
            this._innerPos.add2(this._basePos, tmpVa);
        }
        this._inner.style.left = `${this._innerPos.x - this._size * this._innerScale * 0.5}px`;
        this._inner.style.top = `${this._innerPos.y - this._size * this._innerScale * 0.5}px`;

        const vx = math.clamp(tmpVa.x / this._innerMaxDist, -1, 1);
        const vy = math.clamp(tmpVa.y / this._innerMaxDist, -1, 1);
        this._value.set(vx, vy);
    }
}

class Input extends EventHandler {
    /**
     * @private
     * @type {HTMLElement | null}
     */
    _element = null;

    /**
     * @type {Map<number, { x: number, y: number, left: boolean }>}
     * @private
     */
    _pointerData = new Map();

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
     * @type {JoyStick}
     * @private
     */
    _joystick = new JoyStick();

    /**
     * @type {number}
     */
    sprintMult = 2;

    /**
     * @type {number}
     */
    crouchMult = 0.5;

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

    get speedMult() {
        return this._key.sprint ? this.sprintMult : this._key.crouch ? this.crouchMult : 1;
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

        const left = event.clientX < window.innerWidth * 0.5;
        this._pointerData.set(event.pointerId, {
            x: event.clientX,
            y: event.clientY,
            left
        });

        if (this.isMobile) {
            // manage left and right touch
            if (left) {
                this._joystick.hidden = false;
                this._joystick.setBase(event.clientX, event.clientY);
                this._joystick.setInner(event.clientX, event.clientY);
            } else {
                this.fire('rotate:start', event);
            }
        } else {
            this.fire('rotate:start', event);
        }
    }

    /**
     * @private
     * @param {PointerEvent} event - The pointer event.
     */
    _onPointerMove(event) {
        const data = this._pointerData.get(event.pointerId);
        if (!data) {
            return;
        }
        const { left } = data;
        data.x = event.clientX;
        data.y = event.clientY;

        if (this.isMobile) {

            // move joystick or fire move event
            if (left) {
                this._joystick.setInner(event.clientX, event.clientY);
            } else {
                this.fire('rotate:move', event);
            }
        } else {
            this.fire('rotate:move', event);
        }

    }

    /**
     * @private
     * @param {PointerEvent} event - The pointer event.
     */
    _onPointerUp(event) {
        this._element?.releasePointerCapture(event.pointerId);

        const data = this._pointerData.get(event.pointerId);
        if (!data) {
            return;
        }
        const { left } = data;
        this._pointerData.delete(event.pointerId);

        if (this._pointerData.size < 2) {
            this._lastPinchDist = -1;
        }

        if (this.isMobile) {
            if (left) {
                this._joystick.hidden = true;
            } else {
                this.fire('rotate:end', event);
            }
        } else {
            this.fire('rotate:end', event);
        }

    }

    /**
     * @private
     * @param {MouseEvent} event - The wheel event.
     */
    _onContextMenu(event) {
        event.preventDefault();
    }

    /**
     * @private
     * @param {KeyboardEvent} event - The keyboard event.
     */
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

    /**
     * @private
     * @param {KeyboardEvent} event - The keyboard event.
     */
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
     * @returns {number} - The z axis input.
     */
    getZ() {
        if (this.isMobile) {
            return -this._joystick.value.y;
        }
        return (this._key.forward - this._key.backward) * this.speedMult;
    }

    /**
     * @returns {number} - The x axis input.
     */
    getX() {
        if (this.isMobile) {
            return this._joystick.value.x;
        }
        return (this._key.right - this._key.left) * this.speedMult;
    }

    /**
     * @returns {number} - The y axis input.
     */
    getY() {
        if (this.isMobile) {
            return 0;
        }
        return (this._key.up - this._key.down) * this.speedMult;
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

        this._pointerData.clear();

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

class FlyCamera extends EventHandler {
    /**
     * @type {HTMLElement | null}
     * @private
     */
    _element = null;

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
     * @private
     * @type {Vec2}
     */
    _pitchRange = new Vec2(-90, 90);

    /**
     * @type {Input}
     * @private
     */
    _input = new Input();

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

    constructor() {
        super();

        this._input.on('rotate:move', (event) => {
            this._look(event.movementX, event.movementY, event.target);
        });
    }

    /**
     * The multiplier for the fast movement speed.
     *
     * @type {number}
     */
    set moveFastMult(value) {
        this._input.sprintMult = value;
    }

    get moveFastMult() {
        return this._input.sprintMult;
    }

    /**
     * The multiplier for the slow movement speed.
     *
     * @type {number}
     */
    set moveSlowMult(value) {
        this._input.crouchMult = value;
    }

    get moveSlowMult() {
        return this._input.crouchMult;
    }

    /**
     * The camera's pitch range. Having a value of -360 means no minimum pitch and 360
     * means no maximum pitch.
     *
     * @type {Vec2}
     */
    set pitchRange(value) {
        if (!(value instanceof Vec2)) {
            return;
        }
        this._pitchRange.copy(value);
        this._smoothTransform(-1);
    }

    get pitchRange() {
        return this._pitchRange;
    }

    /**
     * @private
     * @param {number} x - The x value.
     * @param {number} y - The y value.
     * @param {EventTarget | null} target - The target.
     */
    _look(x, y, target) {
        if (target !== this._element) {
            return;
        }
        this._targetAngles.x -= (y || 0) * this.rotateSpeed;
        this._targetAngles.y -= (x || 0) * this.rotateSpeed;
    }

    /**
     * @param {number} dt - The delta time.
     */
    _move(dt) {
        const back = this._transform.getZ();
        const right = this._transform.getX();
        const up = this._transform.getY();

        tmpV1.set(0, 0, 0);
        tmpV1.sub(tmpV2.copy(back).mulScalar(this._input.getZ()));
        tmpV1.add(tmpV2.copy(right).mulScalar(this._input.getX()));
        tmpV1.add(tmpV2.copy(up).mulScalar(this._input.getY()));
        tmpV1.mulScalar(this.moveSpeed * dt);

        this._targetPosition.add(tmpV1);
    }

    /**
     * @private
     * @param {number} dt - The delta time.
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
     * @param {HTMLElement} element - The element.
     * @param {Mat4} transform - The transform.
     */
    attach(element, transform) {
        if (this._element) {
            this.detach();
        }
        this._element = element;
        this._input.attach(this._element);

        this._position.copy(transform.getTranslation());
        this._targetPosition.copy(this._position);

        this._angles.copy(transform.getEulerAngles());
        this._targetAngles.copy(this._angles);

        this._transform.copy(transform);
    }

    detach() {
        if (!this._element) {
            return;
        }
        this._element = null;
        this._input.detach();

        this._cancelSmoothTransform();
    }

    /**
     * @param {number} dt - The delta time.
     * @returns {Mat4} - The camera transform.
     */
    update(dt) {
        if (!this._element) {
            return this._transform;
        }

        this._move(dt);

        this._smoothTransform(dt);

        return this._transform;
    }

    destroy() {
        this.detach();
        this._input.off();
    }
}

export { FlyCamera };
