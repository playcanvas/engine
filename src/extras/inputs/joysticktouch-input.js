import { math } from '../../core/math/math.js';
import { Vec2 } from '../../core/math/vec2.js';
import { Delta, Input } from './input.js';

const tmpVa = new Vec2();

class JoystickTouchInput extends Input {
    /**
     * @type {Map<number, { x: number, y: number, left: boolean }>}
     * @private
     */
    _pointerData = new Map();

    /**
     * @type {number}
     * @private
     */
    _scale = 100;

    /**
     * @type {number}
     * @private
     */
    _innerScaleMult = 0.6;

    /**
     * @type {number}
     * @private
     */
    _innerMaxDist = 70;

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
     * @type {Vec2}
     * @private
     */
    _value = new Vec2();

    /**
     * @override
     */
    deltas = {
        stick: new Delta(3),
        touch: new Delta(2)
    };

    /**
     * @param {object} options - The options.
     * @param {number} [options.scale] - The scale of the joystick.
     * @param {number} [options.innerScale] - The inner scale of the joystick.
     * @param {number} [options.innerMaxDist] - The inner max distance of the joystick.
     */
    constructor(options = {}) {
        super();

        this._scale = options.scale ?? this._scale;
        this._innerScaleMult = options.innerScale ?? this._innerScaleMult;
        this._innerMaxDist = options.innerMaxDist ?? this._innerMaxDist;

        this._base = document.createElement('div');
        this._base.id = 'joystick-base';
        Object.assign(this._base.style, {
            display: 'none',
            position: 'absolute',
            width: `${this._scale}px`,
            height: `${this._scale}px`,
            borderRadius: '50%',
            backgroundColor: 'rgba(255, 255, 255, 0.5)'
        });

        this._inner = document.createElement('div');
        this._inner.id = 'joystick-inner';
        Object.assign(this._inner.style, {
            display: 'none',
            position: 'absolute',
            width: `${this._scale * this._innerScaleMult}px`,
            height: `${this._scale * this._innerScaleMult}px`,
            borderRadius: '50%',
            backgroundColor: 'rgba(0, 0, 0, 0.5)'
        });

        document.body.append(this._base, this._inner);

        this._onPointerDown = this._onPointerDown.bind(this);
        this._onPointerMove = this._onPointerMove.bind(this);
        this._onPointerUp = this._onPointerUp.bind(this);
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

        if (left) {
            this.hidden = false;
            this._setBase(event.clientX, event.clientY);
            this._setInner(event.clientX, event.clientY);
        }
    }

    /**
     * @private
     * @param {PointerEvent} event - The pointer event.
     */
    _onPointerMove(event) {
        if (event.target !== this._element) {
            return;
        }
        const data = this._pointerData.get(event.pointerId);
        if (!data) {
            return;
        }
        const { left } = data;
        data.x = event.clientX;
        data.y = event.clientY;

        if (left) {
            this._setInner(event.clientX, event.clientY);
        } else {
            this.deltas.touch.add(event.movementX, event.movementY);
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

        if (left) {
            this.hidden = true;
            this._value.set(0, 0);
        }

    }

    /**
     * @param {number} x - The x position.
     * @param {number} y - The y position.
     * @private
     */
    _setBase(x, y) {
        this._basePos.set(x, y);
        this._base.style.left = `${this._basePos.x - this._scale * 0.5}px`;
        this._base.style.top = `${this._basePos.y - this._scale * 0.5}px`;
    }

    /**
     * @param {number} x - The x position.
     * @param {number} y - The y position.
     * @private
     */
    _setInner(x, y) {
        this._innerPos.set(x, y);
        tmpVa.sub2(this._innerPos, this._basePos);
        const dist = tmpVa.length();
        if (dist > this._innerMaxDist) {
            tmpVa.normalize().mulScalar(this._innerMaxDist);
            this._innerPos.add2(this._basePos, tmpVa);
        }
        this._inner.style.left = `${this._innerPos.x - this._scale * this._innerScaleMult * 0.5}px`;
        this._inner.style.top = `${this._innerPos.y - this._scale * this._innerScaleMult * 0.5}px`;

        const vx = math.clamp(tmpVa.x / this._innerMaxDist, -1, 1);
        const vy = math.clamp(tmpVa.y / this._innerMaxDist, -1, 1);
        this._value.set(vx, vy);
    }

    /**
     * @param {HTMLElement} element - The element.
     */
    attach(element) {
        if (this._element) {
            this.detach();
        }
        this._element = element;
        this._element.addEventListener('pointerdown', this._onPointerDown);
        this._element.addEventListener('pointermove', this._onPointerMove);
        this._element.addEventListener('pointerup', this._onPointerUp);
    }

    detach() {
        if (!this._element) {
            return;
        }
        this._element.removeEventListener('pointerdown', this._onPointerDown);
        this._element.removeEventListener('pointermove', this._onPointerMove);
        this._element.removeEventListener('pointerup', this._onPointerUp);

        this._pointerData.clear();

        this._element = null;
        this._camera = null;
    }

    /**
     * @override
     */
    frame() {
        this.deltas.stick.add(this._value.x, 0, -this._value.y);

        return super.frame();
    }

    destroy() {
        this.detach();

        this._base.remove();
        this._inner.remove();
    }
}

export { JoystickTouchInput };
