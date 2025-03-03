import { Vec2 } from '../../core/math/vec2.js';

import { Delta, Input } from './input.js';
import { Joystick } from './joystick.js';

const tmpVa = new Vec2();

class JoystickDoubleInput extends Input {
    /**
     * @type {Map<number, { x: number, y: number, left: boolean }>}
     * @private
     */
    _pointerData = new Map();

    /**
     * @type {Joystick}
     * @private
     */
    _leftJoystick;

    /**
     * @type {Joystick}
     * @private
     */
    _rightJoystick;

    /**
     * @override
     */
    deltas = {
        leftStick: new Delta(2),
        rightStick: new Delta(2)
    };

    constructor() {
        super();

        this._leftJoystick = new Joystick();
        document.body.append(this._leftJoystick.dom);

        this._rightJoystick = new Joystick();
        document.body.append(this._rightJoystick.dom);

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
            this._leftJoystick.hidden = false;
            this._leftJoystick.position = tmpVa.set(event.clientX, event.clientY);
        } else {
            this._rightJoystick.hidden = false;
            this._rightJoystick.position = tmpVa.set(event.clientX, event.clientY);
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
            this._leftJoystick.stickPosition = tmpVa.set(event.clientX, event.clientY);
        } else {
            this._rightJoystick.stickPosition = tmpVa.set(event.clientX, event.clientY);
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
            this._leftJoystick.hidden = true;
        } else {
            this._rightJoystick.hidden = true;
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
     * @returns {{ [K in keyof JoystickDoubleInput["deltas"]]: number[] }} - The deltas.
     */
    frame() {
        this.deltas.leftStick.add([this._leftJoystick.value.x, this._leftJoystick.value.y]);
        this.deltas.rightStick.add([this._rightJoystick.value.x, this._rightJoystick.value.y]);

        return super.frame();
    }

    destroy() {
        this.detach();

        this._leftJoystick.destroy();
        this._rightJoystick.destroy();
    }
}

export { JoystickDoubleInput };
