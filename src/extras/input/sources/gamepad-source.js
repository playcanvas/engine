import { InputSource } from '../input.js';

/**
 * Game pad input source class
 *
 * @category Input Source
 * @alpha
 *
 * @typedef {object} GamepadSourceDeltas
 * @property {number[]} buttons - The button deltas, represented as an array of button states (0 or 1).
 * @property {number[]} leftStick - The left stick deltas, represented as an array of [x, y] coordinates.
 * @property {number[]} rightStick - The right stick deltas, represented as an array of [x, y] coordinates.
 * @augments {InputSource<GamepadSourceDeltas>}
 */
class GamepadSource extends InputSource {
    /**
     * The button codes (based on Xbox controller layout).
     *
     * @readonly
     */
    static buttoncode = {
        A: 0,
        B: 1,
        X: 2,
        Y: 3,
        LB: 4,
        RB: 5,
        LT: 6,
        RT: 7,
        SELECT: 8,
        START: 9,
        LEFT_STICK: 10,
        RIGHT_STICK: 11
    };

    /**
     * @type {number[]}
     * @private
     */
    _buttonPrev = Array(11).fill(0);

    constructor() {
        super({
            buttons: Array(11).fill(0),
            leftStick: [0, 0],
            rightStick: [0, 0]
        });
    }

    /**
     * @param {HTMLElement} element - The element.
     */
    attach(element) {
        super.attach(element);
    }

    detach() {
        if (!this._element) {
            return;
        }

        super.detach();
    }

    /**
     * @override
     */
    read() {
        const gamepads = navigator.getGamepads();
        for (let i = 0; i < gamepads.length; i++) {
            const gp = gamepads[i];

            // check if gamepad is connected
            if (!gp) {
                continue;
            }

            // check if gamepad is a standard gamepad
            if (gp.mapping !== 'standard') {
                continue;
            }

            // check if gamepad has two sticks
            if (gp.axes.length < 4) {
                continue;
            }

            // check if gamepad has enough buttons
            if (gp.buttons.length < 12) {
                continue;
            }

            const { buttons, axes } = gp;

            // buttons
            for (let j = 0; j < this._buttonPrev.length; j++) {
                const state = +buttons[j].pressed;
                this.deltas.buttons[j] = state - this._buttonPrev[j];
                this._buttonPrev[j] = state;
            }

            // sticks
            this.deltas.leftStick.append([axes[0], axes[1]]);
            this.deltas.rightStick.append([axes[2], axes[3]]);
        }

        return super.read();
    }
}

export { GamepadSource };
