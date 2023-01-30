import { getGamepads } from '../../core/platform.js';
import * as constants from './constants.js';

/**
 * An object defining the order of buttons and axes for a HTML5 Gamepad.
 *
 * @typedef {object} ButtonsAxes
 * @property {string[]} buttons - Order of PAD_FACE_1, PAD_FACE_2, ...
 * @property {string[]} axes - Order of PAD_L_STICK_X, PAD_L_STICK_Y, ...
 */

/**
 * An object containing a HTML5 Gamepad object and a map for remapping buttons and axes.
 *
 * @typedef {object} GamepadButtonsAxes
 * @property {Gamepad} pad - The HTML5 Gamepad object.
 * @property {ButtonsAxes} map - The map which defines the remapping.
 */

/**
 * @readonly
 * @type {Record<string, ButtonsAxes>}
 */
const MAPS = {
    DEFAULT: {
        buttons: [
            // Face buttons
            'PAD_FACE_1',
            'PAD_FACE_2',
            'PAD_FACE_3',
            'PAD_FACE_4',

            // Shoulder buttons
            'PAD_L_SHOULDER_1',
            'PAD_R_SHOULDER_1',
            'PAD_L_SHOULDER_2',
            'PAD_R_SHOULDER_2',

            // Other buttons
            'PAD_SELECT',
            'PAD_START',
            'PAD_L_STICK_BUTTON',
            'PAD_R_STICK_BUTTON',

            // D Pad
            'PAD_UP',
            'PAD_DOWN',
            'PAD_LEFT',
            'PAD_RIGHT',

             // Vendor specific button
            'PAD_VENDOR'
        ],

        axes: [
            // Analogue Sticks
            'PAD_L_STICK_X',
            'PAD_L_STICK_Y',
            'PAD_R_STICK_X',
            'PAD_R_STICK_Y'
        ]
    },

    PS3: {
        buttons: [
            // X, O, TRI, SQ
            'PAD_FACE_1',
            'PAD_FACE_2',
            'PAD_FACE_4',
            'PAD_FACE_3',

            // Shoulder buttons
            'PAD_L_SHOULDER_1',
            'PAD_R_SHOULDER_1',
            'PAD_L_SHOULDER_2',
            'PAD_R_SHOULDER_2',

            // Other buttons
            'PAD_SELECT',
            'PAD_START',
            'PAD_L_STICK_BUTTON',
            'PAD_R_STICK_BUTTON',

            // D Pad
            'PAD_UP', // 12
            'PAD_DOWN', // 13
            'PAD_LEFT', // 14
            'PAD_RIGHT', // 15

            'PAD_VENDOR'
        ],

        axes: [
            // Analogue Sticks
            'PAD_L_STICK_X',
            'PAD_L_STICK_Y',
            'PAD_R_STICK_X',
            'PAD_R_STICK_Y'
        ]
    }
};

const PRODUCT_CODES = {
    'Product: 0268': 'PS3',
    'Product: 09cc': 'PS3'
};

/**
 * Input handler for accessing GamePad input.
 */
class GamePads {
    deadZone = 0.25;

    /** @type {GamepadButtonsAxes[]} */
    current = [];

    /** @type {boolean[][]} */
    previous = [];

    /**
     * Update the current and previous state of the gamepads. This must be called every frame for
     * `wasPressed` to work.
     */
    update() {
        const { current, previous } = this;
        // move current buttons status into previous array
        for (let i = 0, l = current.length; i < l; i++) {
            const { buttons } = current[i].pad;
            const { length } = buttons;
            const prevPressed = previous[i] = previous[i] || [];
            for (let j = 0; j < length; j++) {
                prevPressed[j] = buttons[j].pressed;
            }
        }

        // update current
        this.poll(current);
    }

    /**
     * Poll for the latest data from the gamepad API.
     *
     * @param {GamepadButtonsAxes[]} [pads] - An optional array used to receive the gamepads
     * mapping. This array will be returned by this function.
     * @returns {GamepadButtonsAxes[]} An array of gamepads and mappings for the model of gamepad
     * that is attached.
     * @example
     * var gamepads = new pc.GamePads();
     * var pads = gamepads.poll();
     */
    poll(pads = []) {
        if (pads.length > 0) {
            pads.length = 0;
        }
        const padDevices = getGamepads();
        for (let i = 0, len = padDevices.length; i < len; i++) {
            if (padDevices[i]) {
                pads.push({
                    map: this.getMap(padDevices[i]),
                    pad: padDevices[i]
                });
            }
        }
        return pads;
    }

    /**
     * @param {Gamepad} pad - The HTML5 Gamepad object.
     * @returns {ButtonsAxes} Object defining the order of buttons and axes for given HTML5 Gamepad.
     */
    getMap(pad) {
        for (const code in PRODUCT_CODES) {
            if (pad.id.includes(code)) {
                return MAPS[PRODUCT_CODES[code]];
            }
        }
        return MAPS.DEFAULT;
    }

    /**
     * Returns true if the button on the pad requested is pressed.
     *
     * @param {number} index - The index of the pad to check, use constants {@link PAD_1},
     * {@link PAD_2}, etc.
     * @param {number} button - The button to test, use constants {@link PAD_FACE_1}, etc.
     * @returns {boolean} True if the button is pressed.
     */
    isPressed(index, button) {
        const obj = this.current[index];
        if (!obj) {
            return false;
        }
        const key = obj.map.buttons[button];
        // eslint-disable-next-line
        const i = constants[key];
        return obj.pad.buttons[i].pressed;
    }

    /**
     * Returns true if the button was pressed since the last frame.
     *
     * @param {number} index - The index of the pad to check, use constants {@link PAD_1},
     * {@link PAD_2}, etc.
     * @param {number} button - The button to test, use constants {@link PAD_FACE_1}, etc.
     * @returns {boolean} True if the button was pressed since the last frame.
     */
    wasPressed(index, button) {
        const obj = this.current[index];
        if (!obj) {
            return false;
        }
        const key = obj.map.buttons[button];
        // eslint-disable-next-line
        const i = constants[key];
        const prevObj = this.previous[index];
        // Previous pad buttons may not have been populated yet
        // If this is the first time frame a pad has been detected
        return obj.pad.buttons[i].pressed && !(prevObj && prevObj[i]);
    }

    /**
     * Returns true if the button was released since the last frame.
     *
     * @param {number} index - The index of the pad to check, use constants {@link PAD_1},
     * {@link PAD_2}, etc.
     * @param {number} button - The button to test, use constants {@link PAD_FACE_1}, etc.
     * @returns {boolean} True if the button was released since the last frame.
     */
    wasReleased(index, button) {
        const obj = this.current[index];
        if (!obj) {
            return false;
        }
        const key = obj.map.buttons[button];
        // eslint-disable-next-line
        const i = constants[key];
        const prevObj = this.previous[index];
        // Previous pad buttons may not have been populated yet
        // If this is the first time frame a pad has been detected
        return !obj.pad.buttons[i].pressed && (prevObj && prevObj[i]);
    }

    /**
     * Get the value of one of the analogue axes of the pad.
     *
     * @param {number} index - The index of the pad to check, use constants {@link PAD_1},
     * {@link PAD_2}, etc.
     * @param {number} axes - The axes to get the value of, use constants {@link PAD_L_STICK_X},
     * etc.
     * @returns {number} The value of the axis between -1 and 1.
     */
    getAxis(index, axes) {
        const obj = this.current[index];
        if (!obj) {
            return 0;
        }
        const key = obj.map.axes[axes];
        // eslint-disable-next-line
        const i = constants[key];
        const value = obj.pad.axes[i];
        if (Math.abs(value) < this.deadZone) {
            return 0;
        }
        return value;
    }
}

export { GamePads };
