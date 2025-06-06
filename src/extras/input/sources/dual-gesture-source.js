import { InputSource } from '../input.js';
import { VirtualJoystick } from './virtual-joystick.js';

/**
 * @param {string} str - The string to check.
 * @param {string} prefix - The prefix to check for.
 * @returns {boolean} - True if the string starts with the prefix, false otherwise.
 */
const startsWith = (str, prefix) => str.indexOf(prefix) === 0;

/**
 * @param {string} str - The string to check.
 * @param {string} suffix - The suffix to check for.
 * @returns {boolean} - True if the string ends with the suffix, false otherwise.
 */
const endsWith = (str, suffix) => str.indexOf(suffix, str.length - suffix.length) !== -1;

/**
 * Dual gesture input source.
 *
 * @category Input Source
 * @alpha
 *
 * @augments {InputSource<{ leftInput: number, rightInput: number }>}
 */
class DualGestureSource extends InputSource {
    /**
     * @type {`${'joystick' | 'touch'}-${'joystick' | 'touch'}`}
     * @private
     */
    _layout = 'joystick-touch';

    /**
     * @type {Map<number, { x: number, y: number, left: boolean }>}
     * @private
     */
    _pointerData = new Map();

    /**
     * @type {VirtualJoystick}
     * @private
     */
    _leftJoystick;

    /**
     * @type {VirtualJoystick}
     * @private
     */
    _rightJoystick;

    /**
     * @param {`${'joystick' | 'touch'}-${'joystick' | 'touch'}`} [layout] - The layout of the dual
     * gesture source.
     */
    constructor(layout) {
        super({
            leftInput: 2,
            rightInput: 2
        });

        if (layout) {
            this.layout = layout;
        }

        this._leftJoystick = new VirtualJoystick();
        this._rightJoystick = new VirtualJoystick();

        this._onPointerDown = this._onPointerDown.bind(this);
        this._onPointerMove = this._onPointerMove.bind(this);
        this._onPointerUp = this._onPointerUp.bind(this);
    }

    /**
     * @type {`${'joystick' | 'touch'}-${'joystick' | 'touch'}`}
     */
    set layout(value) {
        this._layout = value;
    }

    get layout() {
        return this._layout;
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

        if (left && startsWith(this._layout, 'joystick')) {
            this._leftJoystick.setBase(event.clientX, event.clientY);
            this._leftJoystick.setStick(event.clientX, event.clientY);
        }
        if (!left && endsWith(this._layout, 'joystick')) {
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
            if (startsWith(this._layout, 'joystick')) {
                this._leftJoystick.setStick(event.clientX, event.clientY);
            } else {
                this.deltas.leftInput.append([event.movementX, event.movementY]);
            }
        } else {
            if (endsWith(this._layout, 'joystick')) {
                this._rightJoystick.setStick(event.clientX, event.clientY);
            } else {
                this.deltas.rightInput.append([event.movementX, event.movementY]);
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

        if (left && startsWith(this._layout, 'joystick')) {
            this._leftJoystick.reset();
        }
        if (!left && endsWith(this._layout, 'joystick')) {
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

        super.detach();
    }

    /**
     * @override
     */
    flush() {
        this.deltas.leftInput.append([this._leftJoystick.value.x, this._leftJoystick.value.y]);
        this.deltas.rightInput.append([this._rightJoystick.value.x, this._rightJoystick.value.y]);

        return super.flush();
    }

    destroy() {
        this._leftJoystick.reset();
        this._rightJoystick.reset();

        super.destroy();
    }
}

export { DualGestureSource };
