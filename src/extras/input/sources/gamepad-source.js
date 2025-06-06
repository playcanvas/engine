import { InputSource } from '../input.js';

/**
 * Game pad input source class
 *
 * @category Input Source
 * @alpha
 *
 * @augments {InputSource<{ leftStick: number, rightStick: number }>}
 */
class GamepadSource extends InputSource {
    constructor() {
        super({
            leftStick: 2,
            rightStick: 2
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
    flush() {
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

        return super.flush();
    }
}

export { GamepadSource };
