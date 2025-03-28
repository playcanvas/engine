import { Delta, Input } from './input.js';

/** @type {AddEventListenerOptions & EventListenerOptions} */
const PASSIVE = { passive: false };

const array9 = new Array(9).fill(0);

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
    _keyPrev = new Array(9).fill(0);

    /**
     * @type {number[]}
     * @private
     */
    _keyNow = new Array(9).fill(0);

    /**
     * @type {number[]}
     */
    _button = new Array(3).fill(0);

    /**
     * @override
     */
    deltas = {
        key: new Delta(9),
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
        if (event.pointerType !== 'mouse') {
            return;
        }
        this._element?.setPointerCapture(event.pointerId);

        for (let i = 0; i < this._button.length; i++) {
            if (this._button[i] === 1) {
                this._button[i] = -1;
                continue;
            }
            this._button[i] = 0;
        }
        this._button[event.button] = 1;
        this.deltas.button.add(this._button);

        if (this._pointerId) {
            return;
        }
        this._pointerId = event.pointerId;
    }

    /**
     * @param {PointerEvent} event - The pointer event.
     * @private
     */
    _onPointerMove(event) {
        if (event.pointerType !== 'mouse') {
            return;
        }
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
        if (event.pointerType !== 'mouse') {
            return;
        }
        this._element?.releasePointerCapture(event.pointerId);

        for (let i = 0; i < this._button.length; i++) {
            if (this._button[i] === 1) {
                this._button[i] = -1;
                continue;
            }
            this._button[i] = 0;
        }
        this.deltas.button.add(this._button);

        if (this._pointerId !== event.pointerId) {
            return;
        }
        this._pointerId = 0;
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
        this._setKey(event.code, 1);
    }

    /**
     * @param {KeyboardEvent} event - The keyboard event.
     * @private
     */
    _onKeyUp(event) {
        event.stopPropagation();
        this._setKey(event.code, 0);
    }

    /**
     * @param {string} code - The code.
     * @param {number} value - The value.
     * @private
     */
    _setKey(code, value) {
        switch (code) {
            case 'KeyW':
            case 'ArrowUp':
                this._keyNow[0] = value;
                break;
            case 'KeyS':
            case 'ArrowDown':
                this._keyNow[1] = value;
                break;
            case 'KeyA':
            case 'ArrowLeft':
                this._keyNow[2] = value;
                break;
            case 'KeyD':
            case 'ArrowRight':
                this._keyNow[3] = value;
                break;
            case 'KeyQ':
                this._keyNow[4] = value;
                break;
            case 'KeyE':
                this._keyNow[5] = value;
                break;
            case 'Space':
                this._keyNow[6] = value;
                break;
            case 'ShiftLeft':
            case 'ShiftRight':
                this._keyNow[7] = value;
                break;
            case 'ControlLeft':
            case 'ControlRight':
                this._keyNow[8] = value;
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
        for (let i = 0; i < array9.length; i++) {
            array9[i] = this._keyNow[i] - this._keyPrev[i];
            this._keyPrev[i] = this._keyNow[i];
        }
        this.deltas.key.add(array9);

        return super.frame();
    }
}

export { KeyboardMouseInput };
