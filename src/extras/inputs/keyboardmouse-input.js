import { Delta, Input } from './input.js';

/** @type {AddEventListenerOptions & EventListenerOptions} */
const PASSIVE = { passive: false };

const array3 = new Array(3).fill(0);
const array8 = new Array(8).fill(0);

class KeyboardMouseInput extends Input {
    /**
     * @type {number}
     * @private
     */
    _pointerId = 0;

    /**
     * @type {number[]}
     * @private
     */
    _keyPrev = new Array(8).fill(0);

    /**
     * @type {number[]}
     * @private
     */
    _keyNow = new Array(8).fill(0);

    /**
     * @override
     */
    deltas = {
        key: new Delta(8),
        button: new Delta(3),
        mouse: new Delta(2),
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

    /**
     * @param {WheelEvent} event - The wheel event.
     * @private
     */
    _onWheel(event) {
        event.preventDefault();
        this.deltas.wheel.add([event.deltaY]);
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

        array3.fill(0);
        array3[event.button] = 1;
        this.deltas.button.add(array3);
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
        this.deltas.mouse.add([event.movementX, event.movementY]);
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

        array3.fill(0);
        array3[event.button] = -1;
        this.deltas.button.add(array3);
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
                this._keyNow[0] = 1;
                break;
            case 's':
            case 'arrowdown':
                this._keyNow[1] = 1;
                break;
            case 'a':
            case 'arrowleft':
                this._keyNow[2] = 1;
                break;
            case 'd':
            case 'arrowright':
                this._keyNow[3] = 1;
                break;
            case 'q':
                this._keyNow[4] = 1;
                break;
            case 'e':
                this._keyNow[5] = 1;
                break;
            case 'shift':
                this._keyNow[6] = 1;
                break;
            case 'control':
                this._keyNow[7] = 1;
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
                this._keyNow[0] = 0;
                break;
            case 's':
            case 'arrowdown':
                this._keyNow[1] = 0;
                break;
            case 'a':
            case 'arrowleft':
                this._keyNow[2] = 0;
                break;
            case 'd':
            case 'arrowright':
                this._keyNow[3] = 0;
                break;
            case 'q':
                this._keyNow[4] = 0;
                break;
            case 'e':
                this._keyNow[5] = 0;
                break;
            case 'shift':
                this._keyNow[6] = 0;
                break;
            case 'control':
                this._keyNow[7] = 0;
                break;
        }
    }

    /**
     * @param {HTMLElement} element - The element.
     */
    attach(element) {
        super.attach(element);

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

        window.removeEventListener('keydown', this._onKeyDown, false);
        window.removeEventListener('keyup', this._onKeyUp, false);

        this._keyNow.fill(0);
        this._keyPrev.fill(0);

        super.detach();
    }

    /**
     * @override
     * @returns {{ [K in keyof KeyboardMouseInput["deltas"]]: number[] }} - The deltas.
     */
    frame() {
        for (let i = 0; i < array8.length; i++) {
            array8[i] = this._keyNow[i] - this._keyPrev[i];
            this._keyPrev[i] = this._keyNow[i];
        }
        this.deltas.key.add(array8);

        return super.frame();
    }
}

export { KeyboardMouseInput };
