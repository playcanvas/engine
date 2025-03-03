import { Vec2 } from '../../core/math/vec2.js';

import { Delta, Input } from './input.js';
import { Joystick } from './joystick.js';

const tmpVa = new Vec2();
class JoystickTouchInput extends Input {
    /**
     * @type {Map<number, { x: number, y: number, left: boolean }>}
     * @private
     */
    _pointerData = new Map();

    /**
     * @type {Joystick}
     * @private
     */
    _joystick;

    /**
     * @override
     */
    deltas = {
        stick: new Delta(2),
        touch: new Delta(2)
    };

    constructor() {
        super();

        this._joystick = new Joystick();
        document.body.append(this._joystick.dom);

        this._onPointerDown = this._onPointerDown.bind(this);
        this._onPointerMove = this._onPointerMove.bind(this);
        this._onPointerUp = this._onPointerUp.bind(this);
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
            this._joystick.hidden = false;
            this._joystick.position = tmpVa.set(event.clientX, event.clientY);
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
            this._joystick.stickPosition = tmpVa.set(event.clientX, event.clientY);
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
            this._joystick.hidden = true;
        }

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
     * @returns {{ [K in keyof JoystickTouchInput["deltas"]]: number[] }} - The deltas.
     */
    frame() {
        this.deltas.stick.add(this._joystick.value.x, -this._joystick.value.y);

        return super.frame();
    }

    destroy() {
        this.detach();

        this._joystick.destroy();
    }
}

export { JoystickTouchInput };
