import { InputSource } from '../input.js';
import { movementState } from '../utils.js';

const PASSIVE = /** @type {AddEventListenerOptions & EventListenerOptions} */ ({ passive: false });
const KEY_CODES = /** @type {const} */ ({
    A: 0,
    B: 1,
    C: 2,
    D: 3,
    E: 4,
    F: 5,
    G: 6,
    H: 7,
    I: 8,
    J: 9,
    K: 10,
    L: 11,
    M: 12,
    N: 13,
    O: 14,
    P: 15,
    Q: 16,
    R: 17,
    S: 18,
    T: 19,
    U: 20,
    V: 21,
    W: 22,
    X: 23,
    Y: 24,
    Z: 25,
    '0': 26,
    '1': 27,
    '2': 28,
    '3': 29,
    '4': 30,
    '5': 31,
    '6': 32,
    '7': 33,
    '8': 34,
    '9': 35,
    UP: 36,
    DOWN: 37,
    LEFT: 38,
    RIGHT: 39,
    SPACE: 40,
    SHIFT: 41,
    CTRL: 42
});
const KEY_COUNT = Object.keys(KEY_CODES).length;

const array = Array(KEY_COUNT).fill(0);

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
     * @type {ReturnType<typeof movementState>}
     * @private
     */
    _movementState = movementState();

    /**
     * The key codes for the keyboard keys.
     *
     * @readonly
     */
    static keyCode = KEY_CODES;

    /**
     * @type {number}
     * @private
     */
    _pointerId = -1;

    /**
     * @type {boolean}
     * @private
     */
    _pointerLock;

    /**
     * @type {Map<string, number>}
     * @private
     */
    _keyMap = new Map();

    /**
     * @type {number[]}
     * @private
     */
    _keyPrev = Array(KEY_COUNT).fill(0);

    /**
     * @type {number[]}
     * @private
     */
    _keyNow = Array(KEY_COUNT).fill(0);

    /**
     * @type {number[]}
     */
    _button = Array(3).fill(0);

    /**
     * @param {object} [options] - The options.
     * @param {boolean} [options.pointerLock] - Whether to enable pointer lock.
     */
    constructor({ pointerLock = false } = {}) {
        super({
            key: Array(KEY_COUNT).fill(0),
            button: [0, 0, 0],
            mouse: [0, 0],
            wheel: [0]
        });

        this._pointerLock = pointerLock ?? false;

        const { keyCode } = KeyboardMouseSource;

        // Alphabetical keys
        for (let i = 0; i < 26; i++) {
            const code = `Key${String.fromCharCode('A'.charCodeAt(0) + i)}`;
            this._keyMap.set(code, keyCode.A + i);
        }

        // Numeric keys
        for (let i = 0; i < 10; i++) {
            const code = `Digit${i}`;
            this._keyMap.set(code, keyCode['0'] + i);
        }

        // Arrow keys
        this._keyMap.set('ArrowUp', keyCode.UP);
        this._keyMap.set('ArrowDown', keyCode.DOWN);
        this._keyMap.set('ArrowLeft', keyCode.LEFT);
        this._keyMap.set('ArrowRight', keyCode.RIGHT);

        // Special keys
        this._keyMap.set('Space', keyCode.SPACE);
        this._keyMap.set('ShiftLeft', keyCode.SHIFT);
        this._keyMap.set('ShiftRight', keyCode.SHIFT);
        this._keyMap.set('ControlLeft', keyCode.CTRL);
        this._keyMap.set('ControlRight', keyCode.CTRL);

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
        this._movementState.down(event);

        if (event.pointerType !== 'mouse') {
            return;
        }
        if (this._pointerLock) {
            if (document.pointerLockElement !== this._element) {
                this._element?.requestPointerLock();
            }
        } else {
            this._element?.setPointerCapture(event.pointerId);
        }

        this._clearButtons();
        this._button[event.button] = 1;
        this.deltas.button.append(this._button);

        if (this._pointerId !== -1) {
            return;
        }
        this._pointerId = event.pointerId;
    }

    /**
     * @param {PointerEvent} event - The pointer event.
     * @private
     */
    _onPointerMove(event) {
        const [movementX, movementY] = this._movementState.move(event);

        if (event.pointerType !== 'mouse') {
            return;
        }
        if (event.target !== this._element) {
            return;
        }
        if (this._pointerLock) {
            if (document.pointerLockElement !== this._element) {
                return;
            }
        } else {
            if (this._pointerId !== event.pointerId) {
                return;
            }
        }

        this.deltas.mouse.append([movementX, movementY]);
    }

    /**
     * @param {PointerEvent} event - The pointer event.
     * @private
     */
    _onPointerUp(event) {
        this._movementState.up(event);

        if (event.pointerType !== 'mouse') {
            return;
        }
        if (!this._pointerLock) {
            this._element?.releasePointerCapture(event.pointerId);
        }

        this._clearButtons();
        this.deltas.button.append(this._button);

        if (this._pointerId !== event.pointerId) {
            return;
        }
        this._pointerId = -1;
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
        if (this._pointerLock && document.pointerLockElement !== this._element) {
            return;
        }
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
        if (!this._keyMap.has(code)) {
            return;
        }
        this._keyNow[this._keyMap.get(code) ?? 0] = value;
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
        this._element.addEventListener('pointerleave', this._onPointerUp);
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
        this._element.removeEventListener('pointerleave', this._onPointerUp);
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
        for (let i = 0; i < array.length; i++) {
            array[i] = this._keyNow[i] - this._keyPrev[i];
            this._keyPrev[i] = this._keyNow[i];
        }
        this.deltas.key.append(array);

        return super.read();
    }
}

export { KeyboardMouseSource };
