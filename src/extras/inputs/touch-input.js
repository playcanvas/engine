import { Vec2 } from '../../core/math/vec2.js';
import { Delta, Input } from './input.js';

/** @type {AddEventListenerOptions & EventListenerOptions} */
const PASSIVE = { passive: false };

const tmpVa = new Vec2();

class TouchInput extends Input {
    /**
     * @type {Map<number, { x: number, y: number }>}
     * @private
     */
    _pointerData = new Map();

    /**
     * @type {Vec2}
     * @private
     */
    _pointerPos = new Vec2();

    /**
     * @type {boolean}
     * @private
     */
    _panning = false;

    /**
     * @override
     */
    deltas = {
        rotate: new Delta(2),
        pointer: new Delta(2),
        pan: new Delta(2),
        zoom: new Delta()
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
        console.log(event.pointerId);
        this._element?.setPointerCapture(event.pointerId);

        this._pointerData.set(event.pointerId, {
            x: event.clientX,
            y: event.clientY
        });
    }

    /**
     * @param {PointerEvent} event - The pointer event.
     * @private
     */
    _onPointerMove(event) {
        if (event.target !== this._element) {
            return;
        }
        const data = this._pointerData.get(event.pointerId);
        if (!data) {
            return;
        }
        data.x = event.clientX;
        data.y = event.clientY;

        if (this._panning) {
            this._pointerPos.set(event.clientX, event.clientY);
            this.deltas.pan.add(event.movementX, event.movementY);
        } else {
            this.deltas.rotate.add(event.movementX, event.movementY);
        }
    }

    /**
     * @param {PointerEvent} event - The pointer event.
     * @private
     */
    _onPointerUp(event) {
        this._element?.releasePointerCapture(event.pointerId);

        const data = this._pointerData.get(event.pointerId);
        if (!data) {
            return;
        }
        this._pointerData.delete(event.pointerId);

        this._pointerPos.set(0, 0);

        if (this._panning) {
            this._panning = false;
        }
    }

    /**
     * @private
     * @param {MouseEvent} event - The mouse event.
     */
    _onContextMenu(event) {
        event.preventDefault();
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

        this._pointerData.clear();
    }

    /**
     * @override
     */
    frame() {
        this.deltas.pointer.add(this._pointerPos.x, this._pointerPos.y);

        return super.frame();
    }

    destroy() {
        this.detach();
    }
}

export { TouchInput };
