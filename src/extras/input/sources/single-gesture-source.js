import { InputSource } from '../input.js';
import { VirtualJoystick } from './virtual-joystick.js';

/**
 * Single gesture input source.
 *
 * @category Input Source
 * @alpha
 *
 * @augments {InputSource<{ input: number }>}
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
     * @type {VirtualJoystick}
     * @private
     */
    _joystick;

    constructor() {
        super({
            input: 2
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
        this._layout = value;
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
        if (event.pointerType !== 'touch') {
            return;
        }
        this._element?.setPointerCapture(event.pointerId);

        this._pointerData.set(event.pointerId, {
            x: event.clientX,
            y: event.clientY
        });

        if (this._layout === 'joystick') {
            this._joystick.down(event.clientX, event.clientY);
            this._joystick.move(event.clientX, event.clientY);
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
        data.x = event.clientX;
        data.y = event.clientY;

        if (this._layout === 'joystick') {
            this._joystick.move(event.clientX, event.clientY);
        } else {
            this.deltas.input.append([event.movementX, event.movementY]);
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
        this._pointerData.delete(event.pointerId);

        if (this._layout === 'joystick') {
            this._joystick.up();
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
        this.deltas.input.append([this._joystick.value.x, this._joystick.value.y]);

        return super.flush();
    }

    destroy() {
        this._joystick.up();

        super.destroy();
    }
}

export { SingleGestureSource };
