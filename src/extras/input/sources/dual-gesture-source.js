import { DOUBLE_TAP_THRESHOLD, DOUBLE_TAP_VARIANCE } from '../constants.js';
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
 * @typedef {object} DualGestureSourceDeltas
 * @property {number[]} leftInput - The left input deltas.
 * @property {number[]} rightInput - The right input deltas.
 * @property {number[]} doubleTap - The double tap delta.
 * @augments {InputSource<DualGestureSourceDeltas>}
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
     * @type {{ x: number, y: number, time: number }}
     * @private
     */
    _lastPointer = { x: 0, y: 0, time: 0 };

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
            leftInput: [0, 0],
            rightInput: [0, 0],
            doubleTap: [0]
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
        if (this._layout === value) {
            return;
        }
        this._layout = value;

        // reset deltas
        this.read();

        // reset pointer events
        this._pointerData.clear();
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
        const { pointerType, pointerId, clientX, clientY } = event;

        if (pointerType !== 'touch') {
            return;
        }
        this._element?.setPointerCapture(pointerId);

        const left = clientX < window.innerWidth * 0.5;
        this._pointerData.set(pointerId, {
            x: clientX,
            y: clientY,
            left
        });

        const now = Date.now();
        const sqrDist = (this._lastPointer.x - clientX) ** 2 + (this._lastPointer.y - clientY) ** 2;
        if (sqrDist < DOUBLE_TAP_VARIANCE && now - this._lastPointer.time < DOUBLE_TAP_THRESHOLD) {
            this.deltas.doubleTap.append([1]);
        }
        this._lastPointer.x = clientX;
        this._lastPointer.y = clientY;
        this._lastPointer.time = now;

        if (left && startsWith(this._layout, 'joystick')) {
            this.fire('joystick:position:left', this._leftJoystick.down(clientX, clientY));
        }
        if (!left && endsWith(this._layout, 'joystick')) {
            this.fire('joystick:position:right', this._rightJoystick.down(clientX, clientY));
        }
    }

    /**
     * @param {PointerEvent} event - The pointer event.
     * @private
     */
    _onPointerMove(event) {
        const { pointerType, pointerId, target, clientX, clientY, movementX, movementY } = event;

        if (pointerType !== 'touch') {
            return;
        }
        if (target !== this._element) {
            return;
        }
        const data = this._pointerData.get(pointerId);
        if (!data) {
            return;
        }
        const { left } = data;
        data.x = clientX;
        data.y = clientY;

        if (left) {
            if (startsWith(this._layout, 'joystick')) {
                this.fire('joystick:position:left', this._leftJoystick.move(clientX, clientY));
            } else {
                this.deltas.leftInput.append([movementX, movementY]);
            }
        } else {
            if (endsWith(this._layout, 'joystick')) {
                this.fire('joystick:position:right', this._rightJoystick.move(clientX, clientY));
            } else {
                this.deltas.rightInput.append([movementX, movementY]);
            }
        }
    }

    /**
     * @param {PointerEvent} event - The pointer event.
     * @private
     */
    _onPointerUp(event) {
        const { pointerType, pointerId } = event;

        if (pointerType !== 'touch') {
            return;
        }
        this._element?.releasePointerCapture(pointerId);

        const data = this._pointerData.get(pointerId);
        if (!data) {
            return;
        }
        const { left } = data;
        this._pointerData.delete(pointerId);

        if (left && startsWith(this._layout, 'joystick')) {
            this.fire('joystick:position:left', this._leftJoystick.up());
        }
        if (!left && endsWith(this._layout, 'joystick')) {
            this.fire('joystick:position:right', this._rightJoystick.up());
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
    read() {
        this.deltas.leftInput.append([this._leftJoystick.value.x, this._leftJoystick.value.y]);
        this.deltas.rightInput.append([this._rightJoystick.value.x, this._rightJoystick.value.y]);

        return super.read();
    }

    /**
     * @override
     */
    destroy() {
        this._leftJoystick.up();
        this._rightJoystick.up();

        super.destroy();
    }
}

export { DualGestureSource };
