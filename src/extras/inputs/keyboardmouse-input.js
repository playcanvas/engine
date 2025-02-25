import { Vec2 } from '../../core/math/vec2.js';
import { Delta, Input } from './input.js';

/** @type {AddEventListenerOptions & EventListenerOptions} */
const PASSIVE = { passive: false };

const tmpVa = new Vec2();

class KeyboardMouseInput extends Input {
    /**
     * @type {Map<number, { x: number, y: number }>}
     * @private
     */
    _pointerData = new Map();

    /**
     * @type {Vec2}
     * @private
     */
    _startPosition = new Vec2();

    /**
     * @type {Record<string, number>}
     * @private
     */
    _key = {
        forward: 0,
        backward: 0,
        left: 0,
        right: 0,
        up: 0,
        down: 0,
        sprint: 0,
        crouch: 0
    };

    /**
     * @type {Record<string, number>}
     * @private
     */
    _mouse = {
        rotate: 1,
        pan: 2
    };

    /**
     * @type {boolean}
     * @private
     */
    _panning = false;

    /**
     * @type {number}
     */
    sprintMult = 2;

    /**
     * @type {number}
     */
    crouchMult = 0.5;

    /**
     * @override
     */
    deltas = {
        translate: new Delta(3),
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
        this._onKeyDown = this._onKeyDown.bind(this);
        this._onKeyUp = this._onKeyUp.bind(this);
    }

    get moveMult() {
        return this._key.sprint ? this.sprintMult : this._key.crouch ? this.crouchMult : 1;
    }

    /**
     * @private
     * @param {WheelEvent} event - The wheel event.
     */
    _onWheel(event) {
        event.preventDefault();
        this.deltas.zoom.add(event.deltaY);
    }

    /**
     * @private
     * @param {PointerEvent} event - The pointer event.
     */
    _onPointerDown(event) {
        this._element?.setPointerCapture(event.pointerId);

        this._pointerData.set(event.pointerId, {
            x: event.clientX,
            y: event.clientY
        });

        if (event.buttons === this._mouse.pan) {
            this._startPosition.set(event.clientX, event.clientY);
            this._panning = true;
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
        data.x = event.clientX;
        data.y = event.clientY;

        if (this._panning) {
            const dv = tmpVa.set(event.clientX, event.clientY).sub(this._startPosition);
            this._startPosition.set(event.clientX, event.clientY);
            this.deltas.pan.add(dv.x, dv.y);
        } else {
            this.deltas.rotate.add(event.movementX, event.movementY);
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
        this._pointerData.delete(event.pointerId);

        this._startPosition.set(0, 0);

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
     * @private
     * @param {KeyboardEvent} event - The keyboard event.
     */
    _onKeyDown(event) {
        event.stopPropagation();
        switch (event.key.toLowerCase()) {
            case 'w':
            case 'arrowup':
                this._key.forward = 1;
                break;
            case 's':
            case 'arrowdown':
                this._key.backward = 1;
                break;
            case 'a':
            case 'arrowleft':
                this._key.left = 1;
                break;
            case 'd':
            case 'arrowright':
                this._key.right = 1;
                break;
            case 'q':
                this._key.up = 1;
                break;
            case 'e':
                this._key.down = 1;
                break;
            case 'shift':
                this._key.sprint = 1;
                break;
            case 'control':
                this._key.crouch = 1;
                break;
        }
    }

    /**
     * @private
     * @param {KeyboardEvent} event - The keyboard event.
     */
    _onKeyUp(event) {
        event.stopPropagation();
        switch (event.key.toLowerCase()) {
            case 'w':
            case 'arrowup':
                this._key.forward = 0;
                break;
            case 's':
            case 'arrowdown':
                this._key.backward = 0;
                break;
            case 'a':
            case 'arrowleft':
                this._key.left = 0;
                break;
            case 'd':
            case 'arrowright':
                this._key.right = 0;
                break;
            case 'q':
                this._key.up = 0;
                break;
            case 'e':
                this._key.down = 0;
                break;
            case 'shift':
                this._key.sprint = 0;
                break;
            case 'control':
                this._key.crouch = 0;
                break;
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
        this._element.addEventListener('wheel', this._onWheel, PASSIVE);
        this._element.addEventListener('pointerdown', this._onPointerDown);
        this._element.addEventListener('pointermove', this._onPointerMove);
        this._element.addEventListener('pointerup', this._onPointerUp);
        this._element.addEventListener('contextmenu', this._onContextMenu);

        window.addEventListener('keydown', this._onKeyDown, false);
        window.addEventListener('keyup', this._onKeyUp, false);
    }

    detach() {
        if (!this._element) {
            return;
        }
        this._element.removeEventListener('wheel', this._onWheel, PASSIVE);
        this._element.removeEventListener('pointerdown', this._onPointerDown);
        this._element.removeEventListener('pointermove', this._onPointerMove);
        this._element.removeEventListener('pointerup', this._onPointerUp);
        this._element.removeEventListener('contextmenu', this._onContextMenu);

        this._element = null;

        window.removeEventListener('keydown', this._onKeyDown, false);
        window.removeEventListener('keyup', this._onKeyUp, false);

        this._pointerData.clear();

        this._key = {
            forward: 0,
            backward: 0,
            left: 0,
            right: 0,
            up: 0,
            down: 0,
            sprint: 0,
            crouch: 0
        };
    }

    /**
     * @override
     */
    frame() {
        const x = (this._key.right - this._key.left) * this.moveMult;
        const y = (this._key.up - this._key.down) * this.moveMult;
        const z = (this._key.forward - this._key.backward) * this.moveMult;
        this.deltas.translate.add(x, y, z);

        this.deltas.pointer.add(this._startPosition.x, this._startPosition.y);

        return super.frame();
    }

    destroy() {
        this.detach();
    }
}

export { KeyboardMouseInput };
