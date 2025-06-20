import { InputSource } from '../input.js';

/**
 * Game pad input source class
 *
 * @category Input Source
 * @alpha
 *
 * @typedef {object} GamepadSourceDeltas
 * @property {number[]} leftStick - The left stick deltas, represented as an array of [x, y] coordinates.
 * @property {number[]} rightStick - The right stick deltas, represented as an array of [x, y] coordinates.
 * @augments {InputSource<GamepadSourceDeltas>}
 */
class GamepadSource extends InputSource {
    constructor() {
        super({
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
            if (!gp) {
                continue;
            }

            const { axes } = gp;
            this.deltas.leftStick.append([axes[0], axes[1]]);
            this.deltas.rightStick.append([axes[2], axes[3]]);
        }

        return super.read();
    }
}

export { GamepadSource };
