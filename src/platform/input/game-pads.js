import { EventHandler } from '../../core/event-handler.js';

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

let deadZone = 0.25;

/**
 * Input handler for accessing GamePad input.
 *
 * @augments EventHandler
 */
class GamePads extends EventHandler {
    /**
     * Create a new GamePads instance.
     */
    constructor() {
        super();

        /**
         * Whether gamepads are supported by this device.
         *
         * @type {boolean}
         */
        this.gamepadsSupported = !!navigator.getGamepads || !!navigator.webkitGetGamepads;

        /**
         * The list of current gamepads.
         *
         * @type {GamePad[]}
         */
        this.current = [];

        /**
         * The list of previous button states.
         *
         * @type {boolean[][]}
         */
        this.previous = [];

        window.addEventListener('gamepadconnected', event => {
            const pad = new GamePad(event.gamepad, this.getMap(event.gamepad));

            while(this.current.findIndex(gp => gp.index === pad.index) !== -1) {
                this.current.splice(this.current.findIndex(gp => gp.index === pad.index), 1);
            }

            this.current.push(pad);
            this.fire('gamepadconnected', pad);
        });

        window.addEventListener('gamepaddisconnected', event => {
            const padIndex = this.current.findIndex(gp => gp.index === event.gamepad.index);

            if (padIndex !== -1) {
                this.fire('gamepaddisconnected', this.current[padIndex]);
                this.current.splice(padIndex, 1);
            }
        });
    }

    /**
     * Fired when a gamepad is connected.
     *
     * @event GamePads#gamepadconnected
     * @param {GamePad} gamepad - The gamepad that was just connected.
     * @example
     * var onPadConnected = function (pad) {
     *     // Make the gamepad pulse.
     * };
     * app.keyboard.on("gamepadconnected", onPadConnected, this);
     */

    /**
     * Fired when a gamepad is disconnected.
     *
     * @event GamePads#gamepaddisconnected
     * @param {GamePad} gamepad - The gamepad that was just disconnected.
     * @example
     * var onPadDisconnected = function (pad) {
     *     // Pause the game.
     * };
     * app.keyboard.on("gamepaddisconnected", onPadDisconnected, this);
     */

    /**
     * @type {number} Threshold for axes to return values. Must be between 0 and 1.
     * @ignore
     */
    get deadZone() {
        return deadZone;
    }

    set deadZone(value) {
        deadZone = value;
    }

    /**
     * Update the current and previous state of the gamepads. This must be called every frame for
     * `wasPressed` to work.
     */
    update() {
        for (let i = 0, l = this.current.length; i < l; i++) {
            for (let j = 0, m = this.current[i].buttons.length; j < m; j++) {
                if (this.previous[i] === undefined) {
                    this.previous[i] = [];
                }

                this.current[i].buttons[j]._wasPressed = this.current[i].buttons[j].isPressed();
                this.current[i].buttons[j]._wasTouched = this.current[i].buttons[j].isTouched();
                this.previous[i][j] = this.current[i].buttons[j]._wasPressed;
            }
        }

        this.previous.length = this.current.length;
        this.poll();
    }

    /**
     * Poll for the latest data from the gamepad API.
     *
     * @param {GamePad[]} [pads] - An optional array used to receive the gamepads mapping. This
     * array will be returned by this function.
     * @returns {GamePad[]} An array of gamepads and mappings for the model of gamepad that is
     * attached.
     * @example
     * var gamepads = new pc.GamePads();
     * var pads = gamepads.poll();
     */
    poll(pads = []) {
        if (pads.length > 0) {
            pads.length = 0;
        }

        if (this.gamepadsSupported) {
            const padDevices = navigator.getGamepads ? navigator.getGamepads() : navigator.webkitGetGamepads();

            for (let i = 0, len = padDevices.length; i < len; i++) {
                if (padDevices[i]) {
                    let pad = this.findByIndex(padDevices[i].index);
                    pads.push(pad._update(padDevices[i], this.getMap(padDevices[i])));
                }
            }
        }

        return pads;
    }

    getMap(pad) {
        for (const code in PRODUCT_CODES) {
            if (pad.id.indexOf(code) >= 0) {
                return MAPS[PRODUCT_CODES[code]];
            }
        }

        return MAPS.DEFAULT;
    }

    /**
     * Returns true if the button on the pad requested is pressed.
     *
     * @param {number} index - The index of the pad to check, use constants {@link PAD_1}, {@link PAD_2}, etc.
     * @param {number} button - The button to test, use constants {@link PAD_FACE_1}, etc.
     * @returns {boolean} True if the button is pressed.
     */
    isPressed(index, button) {
        return this.current[index] && this.current[index].isPressed(button);
    }

    /**
     * Returns true if the button was pressed since the last frame.
     *
     * @param {number} index - The index of the pad to check, use constants {@link PAD_1}, {@link PAD_2}, etc.
     * @param {number} button - The button to test, use constants {@link PAD_FACE_1}, etc.
     * @returns {boolean} True if the button was pressed since the last frame.
     */
    wasPressed(index, button) {
        return this.current[index] && this.current[index].wasPressed(button);
    }

    /**
     * Returns true if the button was released since the last frame.
     *
     * @param {number} index - The index of the pad to check, use constants {@link PAD_1}, {@link PAD_2}, etc.
     * @param {number} button - The button to test, use constants {@link PAD_FACE_1}, etc.
     * @returns {boolean} True if the button was released since the last frame.
     */
    wasReleased(index, button) {
        return this.current[index] && this.current[index].wasReleased(button);
    }

    /**
     * Get the value of one of the analogue axes of the pad.
     *
     * @param {number} index - The index of the pad to check, use constants {@link PAD_1}, {@link PAD_2}, etc.
     * @param {number} axis - The axis to get the value of, use constants {@link PAD_L_STICK_X}, etc.
     * @returns {number} The value of the axis between -1 and 1.
     */
    getAxis(index, axis) {
        return this.current[index] ? this.current[index].getAxis(axis) : 0;
    }

    /**
     * Find a connected {@link GamePad} from its identifier.
     *
     * @param {string} id - The identifier to search for.
     * @returns {GamePad|null} The {@link GamePad} with the matching identifier or null if no gamepad is found or the gamepad is not connected.
     */
    findById(id) {
        return this.current.find(gp => gp && gp.id === id) || null;
    }

    /**
     * Find a connected {@link GamePad} from its device index.
     *
     * @param {number} index - The device index to search for.
     * @returns {GamePad|null} The {@link GamePad} with the matching device index or null if no gamepad is found or the gamepad is not connected.
     */
    findByIndex(index) {
        return this.current.find(gp => gp && gp.index === index) || null;
    }
}

/**
 * A GamePad stores information about a gamepad from the Gamepad API.
 */
class GamePad {
    /**
     * Create a new GamePad Instance.
     *
     * @param {Gamepad} gamepad - The original Gamepad API gamepad.
     * @param {object} map - The buttons and axes map.
     * @hideconstructor
     */
    constructor(gamepad, map) {
        /**
         * The identifier for the gamepad. Its structure depends on device.
         *
         * @type {string}
         */
        this.id = gamepad.id;

        /**
         * The index for this controller. A gamepad that is disconnected and reconnected will retain the same index.
         *
         * @type {number}
         */
        this.index = gamepad.index;

        /**
         * The buttons present on the GamePad.
         *
         * @type {GamePadButton[]}
         * @readonly
         */
        this.buttons = gamepad.buttons.map(b => new GamePadButton(b));

        /**
         * The gamepad mapping detected by the browser. Value is either "standard" or "xr-standard".
         *
         * @type {string}
         */
        this.mapping = gamepad.mapping === 'xr-standard' ? 'xr-standard' : 'standard';

        /**
         * The buttons and axes map.
         *
         * @type {object}
         */
        this.map = map;

        /**
         * The original Gamepad API gamepad.
         *
         * @type {Gamepad}
         * @ignore
         */
        this.pad = gamepad;
    }

    /**
     * Update the existing GamePad Instance.
     *
     * @param {Gamepad} gamepad - The original Gamepad API gamepad.
     * @param {object} map - The buttons and axes map.
     * @ignore
     */
    _update(gamepad, map) {
        this.id = gamepad.id;
        this.index = gamepad.index;
        this.mapping = gamepad.mapping === 'xr-standard' ? 'xr-standard' : 'standard';
        this.map = map;
        this.pad = gamepad;

        for (let i = 0, l = this.buttons.length; i < l; i++) {
            this.buttons[i]._update(gamepad.buttons[i]);
        }

        return this;
    }

    /**
     * @type {number[]} - The values from analog axes present on the GamePad. Values are between -1 and 1.
     * @readonly
     */
    get axes() {
        return this.pad.axes;
    }

    /**
     * Make the gamepad vibrate.
     *
     * @param {number} intensity - Intensity for the vibrations, must be between 0 and 1.
     * @param {number} duration - Duration for the vibration, in miliseconds.
     * @param {object} [options] - Options for special vibration patern.
     * @param {string} [options.type] - Type of patern. Available types are "dual-rumble" and "vibration". Defaults to "vibration".
     * @param {number} [options.startDelay] - Delay before the patern starts, in miliseconds. Defaults to 0.
     * @param {number} [options.strongMagnitude] - Intensity for strong actuators, must be between 0 and 1. Defaults to intensity.
     * @param {number} [options.weakMagnitude] - Intensity for weak actuators, must be between 0 and 1. Defaults to intensity.
     * @returns {Promise<boolean>} Return a Promise resulting in true if the pulse was successfully completed.
     */
    pulse(intensity, duration, options) {
        const actuator = this.pad.vibrationActuator;

        if (actuator) {
            if (actuator.playEffect) {
                if (options) {
                    return actuator.playEffect(options.type === 'dual-rumble' ? 'dual-rumble' : 'vibration', {
                        'duration': duration,
                        'startDelay': options.startDelay || 0,
                        'strongMagnitude': typeof options.strongMagnitude === 'number' ? options.strongMagnitude : intensity,
                        'weakMagnitude':  typeof options.weakMagnitude === 'number' ? options.weakMagnitude : intensity
                    });
                } else {
                    return actuator.playEffect('vibration', {
                        'duration': duration,
                        'startDelay': 0,
                        'strongMagnitude': intensity,
                        'weakMagnitude': intensity
                    });
                }
            } else if (actuator.pulse) {
                if (options && options.startDelay) {
                    // Custom delay
                    return new Promise(function(resolve, reject) {
                        setTimeout(function() {
                            actuator.pulse(intensity, duration).then(resolve).catch(reject);
                        }, options.startDelay);
                    });
                } else {
                    return actuator.pulse(intensity, duration);
                }
            }
        }

        return new Promise(resolve => resolve(false));
    }

    /**
     * Return true if the gamepad is connected.
     *
     * @returns {boolean} Return true if the gamepad is connected.
     */
    isConnected() {
        return this.pad.connected;
    }

    /**
     * Returns true if the button is pressed.
     *
     * @param {number} button - The button to test, use constants {@link PAD_FACE_1}, etc.
     * @returns {boolean} True if the button is pressed.
     */
    isPressed(button) {
        return this.buttons[button] ? this.buttons[button].isPressed() : false;
    }

    /**
     * Return true if the button was pressed since the last update.
     *
     * @param {number} button - The button to test, use constants {@link PAD_FACE_1}, etc.
     * @returns {boolean} Return true if the button was pressed, false if not.
     */
    wasPressed(button) {
        return this.buttons[button] ? this.buttons[button].wasPressed() : false;
    }

    /**
     * Return true if the button was released since the last update.
     *
     * @param {number} button - The button to test, use constants {@link PAD_FACE_1}, etc.
     * @returns {boolean} Return true if the button was released, false if not.
     */
    wasReleased(button) {
        return this.buttons[button] ? this.buttons[button].wasReleased() : false;
    }

    /**
     * Returns true if the button is touched.
     *
     * @param {number} button - The button to test, use constants {@link PAD_FACE_1}, etc.
     * @returns {boolean} True if the button is touched.
     */
    isTouched(button) {
        return this.buttons[button] ? this.buttons[button].isTouched() : false;
    }

    /**
     * Return true if the button was touched since the last update.
     *
     * @param {number} button - The button to test, use constants {@link PAD_FACE_1}, etc.
     * @returns {boolean} Return true if the button was touched, false if not.
     */
    wasTouched(button) {
        return this.buttons[button] ? this.buttons[button].wasTouched() : false;
    }

    /**
     * Returns the value of a button between 0 and 1, with 0 representing a button that is not pressed, and 1 representing a button that is fully pressed.
     *
     * @param {number} button - The button to retrieve, use constants {@link PAD_FACE_1}, etc.
     * @returns {number} The value of the button between 0 and 1, with 0 representing a button that is not pressed, and 1 representing a button that is fully pressed.
     */
    getValue(button) {
        return this.buttons[button] ? this.buttons[button].value : 0;
    }

    /**
     * Get the value of one of the analogue axes of the pad.
     *
     * @param {number} axis - The axis to get the value of, use constants {@link PAD_L_STICK_X}, etc.
     * @returns {number} The value of the axis between -1 and 1.
     */
    getAxis(axis) {
        return this.axes[axis] && Math.abs(this.axes[axis]) > deadZone ? this.axes[axis] : 0;
    }
}

/**
 * A GamePadButton stores information about a button from the Gamepad API.
 */
class GamePadButton {
    /**
     * Create a new GamePadButton instance.
     *
     * @param {GamepadButton} button - The original Gamepad API gamepad button.
     * @hideconstructor
     */
    constructor(button) {
        /**
         * Whether this button was pressed on last frame.
         *
         * @type {boolean}
         * @ignore
         */
        this._wasPressed = button.pressed;

        /**
         * Whether this button was touched on last frame.
         *
         * @type {boolean}
         * @ignore
         */
        this._wasTouched = typeof button.touched === 'boolean' ? button.touched : button.value > 0;

        /**
         * The original Gamepad API gamepad button.
         *
         * @type {GamepadButton}
         * @ignore
         */
        this._button = button;
    }

    /**
     * Update the existing GamePadButton Instance.
     *
     * @param {GamepadButton} button - The original Gamepad API gamepad button.
     * @ignore
     */
    _update(button) {
        this._button = button;
    }

    /**
     * @type {number} - The value for the button between 0 and 1, with 0 representing a button that is not pressed, and 1 representing a button that is fully pressed.
     * @readonly
     */
    get value() {
        return this._button.value;
    }

    /**
     * Return true if the button is currently down.
     *
     * @returns {boolean} Return true if the button is currently down.
     */
    isPressed() {
        return this._button.pressed;
    }

    /**
     * Return true if the button was pressed since the last update.
     *
     * @returns {boolean} Return true if the button was pressed, false if not.
     */
    wasPressed() {
        return this._wasPressed === false && this.isPressed();
    }

    /**
     * Return true if the button was released since the last update.
     *
     * @returns {boolean} Return true if the button was released, false if not.
     */
    wasReleased() {
        return this._wasPressed === true && !this.isPressed();
    }

    /**
     * Return true if the button is currently touched.
     *
     * @returns {boolean} Return true if the button is currently touched.
     */
    isTouched() {
        return typeof this._button.touched === 'boolean' ? this._button.touched : this._button.value > 0;
    }

    /**
     * Return true if the button was touched since the last update.
     *
     * @returns {boolean} Return true if the button was touched, false if not.
     */
    wasTouched() {
        return this._wasTouched === false && this.isTouched();
    }
}

export { GamePads, GamePad, GamePadButton };
