import { InputSource } from '../input.js';

/** @type {AddEventListenerOptions & EventListenerOptions} */
const PASSIVE = { passive: false };

const array12 = Array(12).fill(0);

/**
 * Keyboard and mouse input source class
 *
 * @category Input Source
 * @alpha
 *
 * @typedef {object} KeyboardMouseSourceDeltas
 * @property {number[]} key - The key deltas.
 * @property {number[]} button - The button deltas.
 * @property {number[]} mouse - The mouse deltas.
 * @property {number[]} wheel - The wheel deltas.
 * @augments {InputSource<KeyboardMouseSourceDeltas>}
 */
class KeyboardMouseSource extends InputSource {
    /**
     * The keycodes.
     *
     * @readonly
     */
    static keycode = {
        W: 0,
        S: 1,
        A: 2,
        D: 3,
        Q: 4,
        E: 5,
        UP: 6,
        DOWN: 7,
        LEFT: 8,
        RIGHT: 9,
        SPACE: 10,
        SHIFT: 11,
        CTRL: 12
    };

    /**
     * @type {number}
     * @private
     */
    _pointerId = 0;

    /**
     * @type {number[]}
     * @private
     */
    _keyPrev = Array(12).fill(0);

    /**
     * @type {number[]}
     * @private
     */
    _keyNow = Array(12).fill(0);

    /**
     * @type {number[]}
     */
    _button = Array(3).fill(0);

    constructor() {
        super({
            key: Array(12).fill(0),
            button: [0, 0, 0],
            mouse: [0, 0],
            wheel: [0]
        });

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
        this.deltas.wheel.append([event.deltaY]);
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

        this._clearButtons();
        this._button[event.button] = 1;
        this.deltas.button.append(this._button);

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
        this.deltas.mouse.append([event.movementX, event.movementY]);
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

        this._clearButtons();
        this.deltas.button.append(this._button);

        if (this._pointerId !== event.pointerId) {
            return;
        }
        this._pointerId = 0;
    }

    /**
     * @param {MouseEvent} event - The mouse event.
     * @private
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
     * @private
     */
    _clearButtons() {
        for (let i = 0; i < this._button.length; i++) {
            if (this._button[i] === 1) {
                this._button[i] = -1;
                continue;
            }
            this._button[i] = 0;
        }
    }

    /**
     * @param {string} code - The code.
     * @param {number} value - The value.
     * @private
     */
    _setKey(code, value) {
        const id = KeyboardMouseSource.keycode;
        switch (code) {
            case 'KeyW':
                this._keyNow[id.W] = value;
                break;
            case 'KeyS':
                this._keyNow[id.S] = value;
                break;
            case 'KeyA':
                this._keyNow[id.A] = value;
                break;
            case 'KeyD':
                this._keyNow[id.D] = value;
                break;
            case 'KeyQ':
                this._keyNow[id.Q] = value;
                break;
            case 'KeyE':
                this._keyNow[id.E] = value;
                break;
            case 'ArrowUp':
                this._keyNow[id.UP] = value;
                break;
            case 'ArrowDown':
                this._keyNow[id.DOWN] = value;
                break;
            case 'ArrowLeft':
                this._keyNow[id.LEFT] = value;
                break;
            case 'ArrowRight':
                this._keyNow[id.RIGHT] = value;
                break;
            case 'Space':
                this._keyNow[id.SPACE] = value;
                break;
            case 'ShiftLeft':
            case 'ShiftRight':
                this._keyNow[id.SHIFT] = value;
                break;
            case 'ControlLeft':
            case 'ControlRight':
                this._keyNow[id.CTRL] = value;
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
        this._element.addEventListener('pointercancel', this._onPointerUp);
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
        this._element.removeEventListener('pointercancel', this._onPointerUp);
        this._element.removeEventListener('contextmenu', this._onContextMenu);

        window.removeEventListener('keydown', this._onKeyDown, false);
        window.removeEventListener('keyup', this._onKeyUp, false);

        this._keyNow.fill(0);
        this._keyPrev.fill(0);

        super.detach();
    }

    /**
     * @override
     */
    read() {
        for (let i = 0; i < array12.length; i++) {
            array12[i] = this._keyNow[i] - this._keyPrev[i];
            this._keyPrev[i] = this._keyNow[i];
        }
        this.deltas.key.append(array12);

        return super.read();
    }
}

export { KeyboardMouseSource };
