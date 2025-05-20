import { InputDelta, InputSource } from '../input.js';

/**
 * Game pad input source class
 *
 * @category Input Source
 * @alpha
 */
class GamepadSource extends InputSource {
    /**
     * @override
     */
    deltas = {
        leftStick: new InputDelta(2),
        rightStick: new InputDelta(2)
    };

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
     * @returns {{ [K in keyof GamepadSource["deltas"]]: number[] }} - The deltas.
     * @override
     */
    frame() {
        const gamepads = navigator.getGamepads();
        for (let i = 0; i < gamepads.length; i++) {
            const gp = gamepads[i];
            if (!gp) {
                continue;
            }

            const { axes } = gp;
            this.deltas.leftStick.add([axes[0], axes[1]]);
            this.deltas.rightStick.add([axes[2], axes[3]]);
        }

        return super.frame();
    }
}

export { GamepadSource };
