import { Delta, Input } from './input.js';
import { Joystick } from './joystick.js';

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
        this._rightJoystick = new Joystick();

        this._onPointerDown = this._onPointerDown.bind(this);
        this._onPointerMove = this._onPointerMove.bind(this);
        this._onPointerUp = this._onPointerUp.bind(this);
    }

    get leftJoystick() {
        return this._leftJoystick;
    }

    get rightJoystick() {
        return this._rightJoystick;
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
            this._leftJoystick.setBase(event.clientX, event.clientY);
            this._leftJoystick.setStick(event.clientX, event.clientY);
        } else {
            this._rightJoystick.setBase(event.clientX, event.clientY);
            this._rightJoystick.setStick(event.clientX, event.clientY);
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
            this._leftJoystick.setStick(event.clientX, event.clientY);
        } else {
            this._rightJoystick.setStick(event.clientX, event.clientY);
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
            this._leftJoystick.reset();
        } else {
            this._rightJoystick.reset();
        }

    }

    /**
     * @param {HTMLElement} element - The element.
     */
    attach(element) {
        super.attach(element);

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

        this._camera = null;

        super.detach();
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
        this._leftJoystick.reset();
        this._rightJoystick.reset();

        super.destroy();
    }
}

export { JoystickDoubleInput };
