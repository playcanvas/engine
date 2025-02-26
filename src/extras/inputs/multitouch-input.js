import { Vec2 } from '../../core/math/vec2.js';
import { Delta, Input } from './input.js';

/** @type {AddEventListenerOptions & EventListenerOptions} */
const PASSIVE = { passive: false };

const tmpVa = new Vec2();

class MultiTouchInput extends Input {
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
     * @type {boolean}
     * @private
     */
    _multi = false;

    /**
     * @type {number}
     * @private
     */
    _pinchDist = -1;

    /**
     * @override
     */
    deltas = {
        touch: new Delta(2),
        multi: new Delta(),
        pinch: new Delta()
    };

    constructor() {
        super();

        this._onWheel = this._onWheel.bind(this);
        this._onPointerDown = this._onPointerDown.bind(this);
        this._onPointerMove = this._onPointerMove.bind(this);
        this._onPointerUp = this._onPointerUp.bind(this);
        this._onContextMenu = this._onContextMenu.bind(this);
    }

    /**
     * @param {WheelEvent} event - The wheel event.
     * @private
     */
    _onWheel(event) {
        event.preventDefault();
        this.deltas.zoom.add(event.deltaY);
    }

    /**
     * @param {PointerEvent} event - The pointer event.
     * @private
     */
    _onPointerDown(event) {
        this._element?.setPointerCapture(event.pointerId);

        this._pointerEvents.set(event.pointerId, event);

        this._multi = this._pointerEvents.size > 1;
        if (this._multi) {
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
        if (event.target !== this._element) {
            return;
        }
        if (this._pointerEvents.size === 0) {
            return;
        }
        this._pointerEvents.set(event.pointerId, event);

        this._multi = this._pointerEvents.size > 1;
        if (this._multi) {
            // pan
            const mid = this._getMidPoint(tmpVa);
            this.deltas.touch.add(mid.x - this._pointerPos.x, mid.y - this._pointerPos.y);
            this._pointerPos.copy(mid);

            // pinch
            const pinchDist = this._getPinchDist();
            if (this._pinchDist > 0) {
                this.deltas.pinch.add(this._pinchDist - pinchDist);
            }
            this._pinchDist = pinchDist;
        } else {
            this.deltas.touch.add(event.movementX, event.movementY);
        }
    }

    /**
     * @param {PointerEvent} event - The pointer event.
     * @private
     */
    _onPointerUp(event) {
        this._element?.releasePointerCapture(event.pointerId);

        this._pointerEvents.delete(event.pointerId);

        this._multi = this._pointerEvents.size > 1;
        if (!this._multi) {
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
        if (this._element) {
            this.detach();
        }
        this._element = element;
        this._element.addEventListener('wheel', this._onWheel, PASSIVE);
        this._element.addEventListener('pointerdown', this._onPointerDown);
        this._element.addEventListener('pointermove', this._onPointerMove);
        this._element.addEventListener('pointerup', this._onPointerUp);
        this._element.addEventListener('pointerout', this._onPointerUp);
        this._element.addEventListener('contextmenu', this._onContextMenu);
    }

    detach() {
        if (!this._element) {
            return;
        }
        this._element.removeEventListener('wheel', this._onWheel, PASSIVE);
        this._element.removeEventListener('pointerdown', this._onPointerDown);
        this._element.removeEventListener('pointermove', this._onPointerMove);
        this._element.removeEventListener('pointerup', this._onPointerUp);
        this._element.removeEventListener('pointerout', this._onPointerUp);
        this._element.removeEventListener('contextmenu', this._onContextMenu);

        this._element = null;

        this._pointerEvents.clear();
    }

    /**
     * @override
     */
    frame() {
        this.deltas.multi.add(+this._multi);

        return super.frame();
    }

    destroy() {
        this.detach();
    }
}

export { MultiTouchInput };
