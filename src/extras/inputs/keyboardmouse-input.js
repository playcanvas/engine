import { Vec2 } from '../../core/math/vec2.js';
import { Delta, Input } from './input.js';

/** @type {AddEventListenerOptions & EventListenerOptions} */
const PASSIVE = { passive: false };

class KeyboardMouseInput extends Input {
    /**
     * @type {number}
     * @private
     */
    _pointerId = 0;

    /**
     * @type {Vec2}
     * @private
     */
    _pointerPos = new Vec2();

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
        key: new Delta(3),
        mouse: new Delta(2),
        pointer: new Delta(2),
        wheel: new Delta()
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
     * @param {WheelEvent} event - The wheel event.
     * @private
     */
    _onWheel(event) {
        event.preventDefault();
        this.deltas.wheel.add(event.deltaY);
    }

    /**
     * @param {PointerEvent} event - The pointer event.
     * @private
     */
    _onPointerDown(event) {
        this._element?.setPointerCapture(event.pointerId);

        if (this._pointerId) {
            return;
        }
        this._pointerId = event.pointerId;

        if (event.buttons === this._mouse.pan) {
            this._pointerPos.set(event.clientX, event.clientY);
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
        if (this._pointerId !== event.pointerId) {
            return;
        }
        if (event.buttons === this._mouse.pan) {
            this._pointerPos.set(event.clientX, event.clientY);
        }
        this.deltas.mouse.add(event.movementX, event.movementY);
    }

    /**
     * @param {PointerEvent} event - The pointer event.
     * @private
     */
    _onPointerUp(event) {
        this._element?.releasePointerCapture(event.pointerId);

        if (this._pointerId !== event.pointerId) {
            return;
        }
        this._pointerId = 0;
        this._pointerPos.set(0, 0);
    }

    /**
     * @private
     * @param {MouseEvent} event - The mouse event.
     */
    _onContextMenu(event) {
        event.preventDefault();
    }

    /**
     * @param {KeyboardEvent} event - The keyboard event.
     * @private
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
     * @param {KeyboardEvent} event - The keyboard event.
     * @private
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
        this._element.addEventListener('pointerout', this._onPointerUp);
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
        this._element.removeEventListener('pointerout', this._onPointerUp);
        this._element.removeEventListener('contextmenu', this._onContextMenu);

        this._element = null;

        window.removeEventListener('keydown', this._onKeyDown, false);
        window.removeEventListener('keyup', this._onKeyUp, false);

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
        this.deltas.key.add(x, y, z);

        this.deltas.pointer.add(this._pointerPos.x, this._pointerPos.y);

        return super.frame();
    }

    destroy() {
        this.detach();
    }
}

export { KeyboardMouseInput };
