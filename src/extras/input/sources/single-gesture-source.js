import { DOUBLE_TAP_THRESHOLD, DOUBLE_TAP_VARIANCE } from '../constants.js';
import { InputSource } from '../input.js';
import { VirtualJoystick } from './virtual-joystick.js';

/**
 * Single gesture input source.
 *
 * @category Input Source
 * @alpha
 *
 * @typedef {object} SingleGestureSourceDeltas
 * @property {number[]} input - The input deltas, represented as an array of [x, y] coordinates.
 * @property {number[]} doubleTap - The double tap delta.
 * @augments {InputSource<SingleGestureSourceDeltas>}
 */
class SingleGestureSource extends InputSource {
    /**
     * @type {'joystick' | 'touch'}
     * @private
     */
    _layout = 'joystick';

    /**
     * @type {Map<number, { x: number, y: number }>}
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
    _joystick;

    constructor() {
        super({
            input: [0, 0],
            doubleTap: [0]
        });

        this._joystick = new VirtualJoystick();

        this._onPointerDown = this._onPointerDown.bind(this);
        this._onPointerMove = this._onPointerMove.bind(this);
        this._onPointerUp = this._onPointerUp.bind(this);
    }

    /**
     * The layout of the single touch input source. The layout can be one of the following:
     *
     * - `joystick`: A virtual joystick.
     * - `touch`: A touch.
     *
     * Default is `joystick`.
     *
     * @type {'joystick' | 'touch'}
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

    get joystick() {
        return this._joystick;
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

        this._pointerData.set(pointerId, {
            x: clientX,
            y: clientY
        });

        const now = Date.now();
        const sqrDist = (this._lastPointer.x - clientX) ** 2 + (this._lastPointer.y - clientY) ** 2;
        if (sqrDist < DOUBLE_TAP_VARIANCE && now - this._lastPointer.time < DOUBLE_TAP_THRESHOLD) {
            this.deltas.doubleTap.append([1]);
        }
        this._lastPointer.x = clientX;
        this._lastPointer.y = clientY;
        this._lastPointer.time = now;

        if (this._layout === 'joystick') {
            this.fire('joystick:position', this._joystick.down(clientX, clientY));
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
        data.x = clientX;
        data.y = clientY;

        if (this._layout === 'joystick') {
            this.fire('joystick:position', this._joystick.move(clientX, clientY));
        } else {
            this.deltas.input.append([movementX, movementY]);
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
        this._pointerData.delete(pointerId);

        if (this._layout === 'joystick') {
            this.fire('joystick:position', this._joystick.up());
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
        this.deltas.input.append([this._joystick.value.x, this._joystick.value.y]);

        return super.read();
    }

    destroy() {
        this._joystick.up();

        super.destroy();
    }
}

export { SingleGestureSource };
