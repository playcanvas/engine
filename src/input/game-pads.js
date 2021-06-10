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
            'PAD_UP',
            'PAD_DOWN',
            'PAD_LEFT',
            'PAD_RIGHT',

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
    'Product: 0268': 'PS3'
};

/**
 * @class
 * @name GamePads
 * @classdesc Input handler for accessing GamePad input.
 */
class GamePads {
    constructor() {
        this.gamepadsSupported = !!navigator.getGamepads || !!navigator.webkitGetGamepads;

        this.current = [];
        this.previous = [];

        this.deadZone = 0.25;
    }

    /**
     * @function
     * @name GamePads#update
     * @description Update the current and previous state of the gamepads. This must be called every frame for wasPressed()
     * to work.
     */
    update() {
        var i, j, l;
        var buttons, buttonsLen;

        // move current buttons status into previous array
        for (i = 0, l = this.current.length; i < l; i++) {
            buttons = this.current[i].pad.buttons;
            buttonsLen = buttons.length;
            for (j = 0; j < buttonsLen; j++) {
                if (this.previous[i] === undefined) {
                    this.previous[i] = [];
                }
                this.previous[i][j] = buttons[j].pressed;
            }
        }

        // update current
        this.poll(this.current);
    }

    /**
     * @function
     * @name GamePads#poll
     * @description Poll for the latest data from the gamepad API.
     * @param {object[]} [pads] - An optional array used to receive the gamepads mapping. This array will be
     * returned by this function.
     * @returns {object[]} An array of gamepads and mappings for the model of gamepad that is attached.
     * @example
     * var gamepads = new pc.GamePads();
     * var pads = gamepads.poll();
     */
    poll(pads = []) {
        if (pads.length > 0) {
            pads.length = 0;
        }

        if (this.gamepadsSupported) {
            var padDevices = navigator.getGamepads ? navigator.getGamepads() : navigator.webkitGetGamepads();
            var i, len = padDevices.length;
            for (i = 0; i < len; i++) {
                if (padDevices[i]) {
                    pads.push({
                        map: this.getMap(padDevices[i]),
                        pad: padDevices[i]
                    });
                }
            }
        }
        return pads;
    }

    getMap(pad) {
        for (var code in PRODUCT_CODES) {
            if (pad.id.indexOf(code) >= 0) {
                return MAPS[PRODUCT_CODES[code]];
            }
        }

        return MAPS.DEFAULT;
    }

    /**
     * @function
     * @name GamePads#isPressed
     * @description Returns true if the button on the pad requested is pressed.
     * @param {number} index - The index of the pad to check, use constants {@link PAD_1}, {@link PAD_2}, etc.
     * @param {number} button - The button to test, use constants {@link PAD_FACE_1}, etc.
     * @returns {boolean} True if the button is pressed.
     */
    isPressed(index, button) {
        if (!this.current[index]) {
            return false;
        }

        var key = this.current[index].map.buttons[button];
        return this.current[index].pad.buttons[pc[key]].pressed;
    }

    /**
     * @function
     * @name GamePads#wasPressed
     * @description Returns true if the button was pressed since the last frame.
     * @param {number} index - The index of the pad to check, use constants {@link PAD_1}, {@link PAD_2}, etc.
     * @param {number} button - The button to test, use constants {@link PAD_FACE_1}, etc.
     * @returns {boolean} True if the button was pressed since the last frame.
     */
    wasPressed(index, button) {
        if (!this.current[index]) {
            return false;
        }

        var key = this.current[index].map.buttons[button];
        var i = pc[key];

        // Previous pad buttons may not have been populated yet
        // If this is the first time frame a pad has been detected
        return this.current[index].pad.buttons[i].pressed && !(this.previous[index] && this.previous[index][i]);
    }

    /**
     * @function
     * @name GamePads#wasReleased
     * @description Returns true if the button was released since the last frame.
     * @param {number} index - The index of the pad to check, use constants {@link PAD_1}, {@link PAD_2}, etc.
     * @param {number} button - The button to test, use constants {@link PAD_FACE_1}, etc.
     * @returns {boolean} True if the button was released since the last frame.
     */
    wasReleased(index, button) {
        if (!this.current[index]) {
            return false;
        }

        var key = this.current[index].map.buttons[button];
        var i = pc[key];

        // Previous pad buttons may not have been populated yet
        // If this is the first time frame a pad has been detected
        return !this.current[index].pad.buttons[i].pressed && (this.previous[index] && this.previous[index][i]);
    }

    /**
     * @function
     * @name GamePads#getAxis
     * @description Get the value of one of the analogue axes of the pad.
     * @param {number} index - The index of the pad to check, use constants {@link PAD_1}, {@link PAD_2}, etc.
     * @param {number} axes - The axes to get the value of, use constants {@link PAD_L_STICK_X}, etc.
     * @returns {number} The value of the axis between -1 and 1.
     */
    getAxis(index, axes) {
        if (!this.current[index]) {
            return 0;
        }

        var key = this.current[index].map.axes[axes];
        var value = this.current[index].pad.axes[pc[key]];

        if (Math.abs(value) < this.deadZone) {
            value = 0;
        }
        return value;
    }
}

export { GamePads };
