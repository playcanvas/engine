import { Vec2 } from '../../../core/math/vec2.js';
import { InputSource } from '../input.js';

const tmpVa = new Vec2();

/**
 * Multi-touch input source class
 *
 * @category Input Source
 * @alpha
 *
 * @typedef {object} MultiTouchSourceDeltas
 * @property {number[]} touch - The touch deltas, represented as an array of [x, y] coordinates.
 * @property {number[]} count - The count deltas, represented as an array of integers.
 * @property {number[]} pinch - The pinch deltas, represented as an array of integers.
 * @augments {InputSource<MultiTouchSourceDeltas>}
 */
class MultiTouchSource extends InputSource {
    /**
     * @type {Map<number, PointerEvent>}
     * @private
     */
    _pointerEvents = new Map();

    /**
     * @type {Vec2}
     * @private
     */
    _pointerPos = new Vec2();

    /**
     * @type {number}
     * @private
     */
    _pinchDist = -1;

    constructor() {
        super({
            touch: [0, 0],
            count: [0],
            pinch: [0]
        });

        this._onPointerDown = this._onPointerDown.bind(this);
        this._onPointerMove = this._onPointerMove.bind(this);
        this._onPointerUp = this._onPointerUp.bind(this);
        this._onContextMenu = this._onContextMenu.bind(this);
    }

    /**
     * @param {PointerEvent} event - The pointer event.
     * @private
     */
    _onPointerDown(event) {
        if (event.pointerType !== 'touch') {
            return;
        }
        this._element?.setPointerCapture(event.pointerId);

        this._pointerEvents.set(event.pointerId, event);

        this.deltas.count.append([1]);
        if (this._pointerEvents.size > 1) {
            // pan
            this._getMidPoint(this._pointerPos);

            // pinch
            this._pinchDist = this._getPinchDist();
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
        if (this._pointerEvents.size === 0) {
            return;
        }
        this._pointerEvents.set(event.pointerId, event);

        if (this._pointerEvents.size > 1) {
            // pan
            const mid = this._getMidPoint(tmpVa);
            this.deltas.touch.append([mid.x - this._pointerPos.x, mid.y - this._pointerPos.y]);
            this._pointerPos.copy(mid);

            // pinch
            const pinchDist = this._getPinchDist();
            if (this._pinchDist > 0) {
                this.deltas.pinch.append([this._pinchDist - pinchDist]);
            }
            this._pinchDist = pinchDist;
        } else {
            this.deltas.touch.append([event.movementX, event.movementY]);
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

        this._pointerEvents.delete(event.pointerId);

        this.deltas.count.append([-1]);
        if (this._pointerEvents.size < 2) {
            this._pinchDist = -1;
        }

        this._pointerPos.set(0, 0);
    }

    /**
     * @param {MouseEvent} event - The mouse event.
     * @private
     */
    _onContextMenu(event) {
        event.preventDefault();
    }

    /**
     * @param {Vec2} out - The output vector.
     * @returns {Vec2} The mid point.
     * @private
     */
    _getMidPoint(out) {
        const [a, b] = this._pointerEvents.values();
        const dx = a.clientX - b.clientX;
        const dy = a.clientY - b.clientY;
        return out.set(b.clientX + dx * 0.5, b.clientY + dy * 0.5);
    }

    /**
     * @returns {number} The pinch distance.
     * @private
     */
    _getPinchDist() {
        const [a, b] = this._pointerEvents.values();
        const dx = a.clientX - b.clientX;
        const dy = a.clientY - b.clientY;
        return Math.sqrt(dx * dx + dy * dy);
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
        this._element.addEventListener('contextmenu', this._onContextMenu);
    }

    detach() {
        if (!this._element) {
            return;
        }
        this._element.removeEventListener('pointerdown', this._onPointerDown);
        this._element.removeEventListener('pointermove', this._onPointerMove);
        this._element.removeEventListener('pointerup', this._onPointerUp);
        this._element.removeEventListener('pointercancel', this._onPointerUp);
        this._element.removeEventListener('contextmenu', this._onContextMenu);

        this._pointerEvents.clear();

        super.detach();
    }
}

export { MultiTouchSource };
