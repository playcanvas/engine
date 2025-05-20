import { InputDelta, InputSource } from '../input.js';
import { Joystick } from './virtual-joystick.js';

/**
 * Dual touch input source.
 *
 * @category Input
 * @alpha
 */
class DualTouch extends InputSource {
    /**
     * @type {'joystick' | 'touch'}
     * @private
     */
    _leftType;

    /**
     * @type {'joystick' | 'touch'}
     * @private
     */
    _rightType;

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
        left: new InputDelta(2),
        right: new InputDelta(2)
    };

    /**
     * @param {'joystick' | 'touch'} leftType - The type of the left joystick.
     * @param {'joystick' | 'touch'} rightType - The type of the right joystick.
     */
    constructor(leftType, rightType) {
        super();

        this._leftType = leftType;
        this._rightType = rightType;

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
        if (event.pointerType !== 'touch') {
            return;
        }
        this._element?.setPointerCapture(event.pointerId);

        const left = event.clientX < window.innerWidth * 0.5;
        this._pointerData.set(event.pointerId, {
            x: event.clientX,
            y: event.clientY,
            left
        });

        if (left && this._leftType === 'joystick') {
            this._leftJoystick.setBase(event.clientX, event.clientY);
            this._leftJoystick.setStick(event.clientX, event.clientY);
        }
        if (!left && this._rightType === 'joystick') {
            this._rightJoystick.setBase(event.clientX, event.clientY);
            this._rightJoystick.setStick(event.clientX, event.clientY);
        }
    }

    /**
     * @param {PointerEvent} event - The pointer event.
     * @private
     */
    _onPointerMove(event) {
        if (event.pointerType !== 'touch') {
            return;
        }
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
            if (this._leftType === 'joystick') {
                this._leftJoystick.setStick(event.clientX, event.clientY);
            } else {
                this.deltas.right.add([event.movementX, event.movementY]);
            }
        } else {
            if (this._rightType === 'joystick') {
                this._rightJoystick.setStick(event.clientX, event.clientY);
            } else {
                this.deltas.right.add([event.movementX, event.movementY]);
            }
        }
    }

    /**
     * @param {PointerEvent} event - The pointer event.
     * @private
     */
    _onPointerUp(event) {
        if (event.pointerType !== 'touch') {
            return;
        }
        this._element?.releasePointerCapture(event.pointerId);

        const data = this._pointerData.get(event.pointerId);
        if (!data) {
            return;
        }
        const { left } = data;
        this._pointerData.delete(event.pointerId);

        if (left && this._leftType === 'joystick') {
            this._leftJoystick.reset();
        }
        if (!left && this._rightType === 'joystick') {
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
        this._element.addEventListener('pointercancel', this._onPointerUp);
    }

    detach() {
        if (!this._element) {
            return;
        }
        this._element.removeEventListener('pointerdown', this._onPointerDown);
        this._element.removeEventListener('pointermove', this._onPointerMove);
        this._element.removeEventListener('pointerup', this._onPointerUp);
        this._element.removeEventListener('pointercancel', this._onPointerUp);

        this._pointerData.clear();

        this._camera = null;

        super.detach();
    }

    /**
     * @returns {{ [K in keyof DualTouch["deltas"]]: number[] }} - The deltas.
     * @override
     */
    frame() {
        this.deltas.left.add([this._leftJoystick.value.x, this._leftJoystick.value.y]);
        this.deltas.right.add([this._rightJoystick.value.x, this._rightJoystick.value.y]);

        return super.frame();
    }

    destroy() {
        this._leftJoystick.reset();
        this._rightJoystick.reset();

        super.destroy();
    }
}

export { DualTouch };
