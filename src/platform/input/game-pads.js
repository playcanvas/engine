import { EventHandler } from '../../core/event-handler.js';
import { EVENT_GAMEPADCONNECTED, EVENT_GAMEPADDISCONNECTED, PAD_FACE_1, PAD_FACE_2, PAD_FACE_3, PAD_FACE_4, PAD_L_SHOULDER_1, PAD_R_SHOULDER_1, PAD_L_SHOULDER_2, PAD_R_SHOULDER_2, PAD_SELECT, PAD_START, PAD_L_STICK_BUTTON, PAD_R_STICK_BUTTON, PAD_UP, PAD_DOWN, PAD_LEFT, PAD_RIGHT, PAD_VENDOR, XRPAD_TRIGGER, XRPAD_SQUEEZE, XRPAD_TOUCHPAD_BUTTON, XRPAD_STICK_BUTTON, XRPAD_A, XRPAD_B, PAD_L_STICK_X, PAD_L_STICK_Y, PAD_R_STICK_X, PAD_R_STICK_Y, XRPAD_TOUCHPAD_X, XRPAD_TOUCHPAD_Y, XRPAD_STICK_X, XRPAD_STICK_Y } from './constants.js';

const MAPS = {
    INDEXES: {
        buttons: {
            'PAD_FACE_1': PAD_FACE_1,
            'PAD_FACE_2': PAD_FACE_2,
            'PAD_FACE_3': PAD_FACE_3,
            'PAD_FACE_4': PAD_FACE_4,
            'PAD_L_SHOULDER_1': PAD_L_SHOULDER_1,
            'PAD_R_SHOULDER_1': PAD_R_SHOULDER_1,
            'PAD_L_SHOULDER_2': PAD_L_SHOULDER_2,
            'PAD_R_SHOULDER_2': PAD_R_SHOULDER_2,
            'PAD_SELECT': PAD_SELECT,
            'PAD_START': PAD_START,
            'PAD_L_STICK_BUTTON': PAD_L_STICK_BUTTON,
            'PAD_R_STICK_BUTTON': PAD_R_STICK_BUTTON,
            'PAD_UP': PAD_UP,
            'PAD_DOWN': PAD_DOWN,
            'PAD_LEFT': PAD_LEFT,
            'PAD_RIGHT': PAD_RIGHT,
            'PAD_VENDOR': PAD_VENDOR,
            'XRPAD_TRIGGER': XRPAD_TRIGGER,
            'XRPAD_SQUEEZE': XRPAD_SQUEEZE,
            'XRPAD_TOUCHPAD_BUTTON': XRPAD_TOUCHPAD_BUTTON,
            'XRPAD_STICK_BUTTON': XRPAD_STICK_BUTTON,
            'XRPAD_A': XRPAD_A,
            'XRPAD_B': XRPAD_B
        },
        axes: {
            'PAD_L_STICK_X': PAD_L_STICK_X,
            'PAD_L_STICK_Y': PAD_L_STICK_Y,
            'PAD_R_STICK_X': PAD_R_STICK_X,
            'PAD_R_STICK_Y': PAD_R_STICK_Y,
            'XRPAD_TOUCHPAD_X': XRPAD_TOUCHPAD_X,
            'XRPAD_TOUCHPAD_Y': XRPAD_TOUCHPAD_Y,
            'XRPAD_STICK_X': XRPAD_STICK_X,
            'XRPAD_STICK_Y': XRPAD_STICK_Y
        }
    },
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
    },

    DEFAULT_XR: {
        buttons: [
            // Back buttons
            'XRPAD_TRIGGER',
            'XRPAD_SQUEEZE',

            // Axes buttons
            'XRPAD_TOUCHPAD_BUTTON',
            'XRPAD_STICK_BUTTON',

            // Face buttons
            'XRPAD_A',
            'XRPAD_B'
        ],

        axes: [
            // Analogue Sticks
            'XRPAD_TOUCHPAD_X',
            'XRPAD_TOUCHPAD_Y',
            'XRPAD_STICK_X',
            'XRPAD_STICK_Y'
        ]
    }
};

const PRODUCT_CODES = {
    'Product: 0268': 'PS3'
};

let deadZone = 0.25;

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
         * The buttons present on the GamePad. Some buttons may be null. Order is provided by API, use GamePad#buttons instead.
         *
         * @type {GamePadButton[]}
         * @ignore
         */
        this._buttons = gamepad.buttons.map((b) => {
            return b ? new GamePadButton(b) : null;
        });

        /**
         * Previous value for the analog axes present on the gamepad. Values are between -1 and 1.
         *
         * @type {number[]}
         * @ignore
         */
        this._previousAxes = [...gamepad.axes];

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
         * The hand this gamepad is usually handled on. Only relevant for XR pads. Value is either "left", "right" or "none".
         *
         * @type {string}
         */
        this.hand = gamepad.hand || 'none';

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
     * @ignore
     */
    _update(gamepad) {
        this.mapping = gamepad.mapping === 'xr-standard' ? 'xr-standard' : 'standard';
        this.hand = gamepad.hand || 'none';

        // Store previous values for axes for dual buttons.
        this._previousAxes.length = 0;
        this._previousAxes.push(...this.pad.axes);

        this.pad = gamepad;

        for (let i = 0, l = this.buttons.length; i < l; i++) {
            if (this._buttons[i])
                this._buttons[i]._update(gamepad.buttons[i]);
        }

        return this;
    }

    /**
     * @type {number[]} - The values from analog axes present on the GamePad. Values are between -1 and 1.
     */
    get axes() {
        return this.map.axes ? this.map.axes.map(a => this.pad.axes[MAPS.INDEXES.axes[a]] || 0) : [];
    }

    /**
     * @type {GamePadButton[]} - The buttons present on the GamePad. Some buttons may be null.
     */
    get buttons() {
        return this.map.buttons ? this.map.buttons.map((b) => {
            const button = this._buttons[MAPS.INDEXES.buttons[b]];

            if (button) {
                return button;
            }

            if (this.map.dualButtons) {
                const dualIndex = this.map.dualButtons.findIndex(a => a.indexOf(b) !== -1);
                if (dualIndex !== -1) {
                    const index = this.map.dualButtons[dualIndex].indexOf(b);
                    const max = index === 0 ? 0 : 1;
                    const min = index === 0 ? -1 : 0;

                    const value = Math.abs(Math.max(min, Math.max(this.axes[dualIndex], max)));
                    const axisButton = new GamePadButton({
                        'pressed': value === 1,
                        'touched': value > 0,
                        'value': value
                    });

                    const previousValue = Math.abs(Math.max(min, Math.max(this._previousAxes[dualIndex], max)));
                    axisButton._wasPressed = previousValue === 1;
                    axisButton._wasTouched = previousValue > 0;

                    return axisButton;
                }
            }

            return null;
        }) : [];
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
                        'weakMagnitude': typeof options.weakMagnitude === 'number' ? options.weakMagnitude : intensity
                    });
                }

                return actuator.playEffect('vibration', {
                    'duration': duration,
                    'startDelay': 0,
                    'strongMagnitude': intensity,
                    'weakMagnitude': intensity
                });
            } else if (actuator.pulse) {
                if (options && options.startDelay) {
                    // Custom delay
                    return new Promise(function (resolve, reject) {
                        setTimeout(function () {
                            actuator.pulse(intensity, duration).then(resolve).catch(reject);
                        }, options.startDelay);
                    });
                }

                return actuator.pulse(intensity, duration);
            }
        }

        return Promise.resolve(false);
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

        window.addEventListener('gamepadconnected', (event) => {
            const pad = new GamePad(event.gamepad, this.getMap(event.gamepad));

            while (this.current.findIndex(gp => gp.index === pad.index) !== -1) {
                this.current.splice(this.current.findIndex(gp => gp.index === pad.index), 1);
            }

            this.current.push(pad);
            this.fire(EVENT_GAMEPADCONNECTED, pad);
        });

        window.addEventListener('gamepaddisconnected', (event) => {
            const padIndex = this.current.findIndex(gp => gp.index === event.gamepad.index);

            if (padIndex !== -1) {
                this.fire(EVENT_GAMEPADDISCONNECTED, this.current[padIndex]);
                this.current.splice(padIndex, 1);
            }
        });

        this.poll();
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

    set deadZone(value) {
        deadZone = value;
    }

    /**
     * @type {number} Threshold for axes to return values. Must be between 0 and 1.
     * @ignore
     */
    get deadZone() {
        return deadZone;
    }

    /**
     * @type {number[][]} The list of previous button states.
     * @ignore
     */
    get previous() {
        return this.current.map((c) => {
            return c.buttons.map((b) => {
                return b ? b._wasPressed : false;
            });
        });
    }

    /**
     * Update the previous state of the gamepads. This must be called every frame for
     * `wasPressed` as `wasTouched` to work.
     */
    update() {
        for (let i = 0, l = this.current.length; i < l; i++) {
            for (let j = 0, m = this.current[i].buttons.length; j < m; j++) {
                this.current[i].buttons[j]._wasPressed = this.current[i].buttons[j].isPressed();
                this.current[i].buttons[j]._wasTouched = this.current[i].buttons[j].isTouched();
            }
        }

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
                    const pad = this.findByIndex(padDevices[i].index);

                    if (pad) {
                        pads.push(pad._update(padDevices[i]));
                    } else {
                        const nPad = new GamePad(padDevices[i], this.getMap(padDevices[i]));
                        this.current.push(nPad);
                        pads.push(nPad);
                    }
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

        if (pad.mapping === 'xr-standard')
            return MAPS.DEFAULT_XR;

        return MAPS.DEFAULT;
    }

    /**
     * Returns true if the button on the pad requested is pressed.
     *
     * @param {number} orderIndex - The order index of the pad to check, use constants {@link PAD_1}, {@link PAD_2}, etc. For gamepad index call the function from the pad.
     * @param {number} button - The button to test, use constants {@link PAD_FACE_1}, etc.
     * @returns {boolean} True if the button is pressed.
     */
    isPressed(orderIndex, button) {
        return this.current[orderIndex] && this.current[orderIndex].isPressed(button);
    }

    /**
     * Returns true if the button was pressed since the last frame.
     *
     * @param {number} orderIndex - The index of the pad to check, use constants {@link PAD_1}, {@link PAD_2}, etc. For gamepad index call the function from the pad.
     * @param {number} button - The button to test, use constants {@link PAD_FACE_1}, etc.
     * @returns {boolean} True if the button was pressed since the last frame.
     */
    wasPressed(orderIndex, button) {
        return this.current[orderIndex] && this.current[orderIndex].wasPressed(button);
    }

    /**
     * Returns true if the button was released since the last frame.
     *
     * @param {number} orderIndex - The index of the pad to check, use constants {@link PAD_1}, {@link PAD_2}, etc. For gamepad index call the function from the pad.
     * @param {number} button - The button to test, use constants {@link PAD_FACE_1}, etc.
     * @returns {boolean} True if the button was released since the last frame.
     */
    wasReleased(orderIndex, button) {
        return this.current[orderIndex] && this.current[orderIndex].wasReleased(button);
    }

    /**
     * Get the value of one of the analogue axes of the pad.
     *
     * @param {number} orderIndex - The index of the pad to check, use constants {@link PAD_1}, {@link PAD_2}, etc. For gamepad index call the function from the pad.
     * @param {number} axis - The axis to get the value of, use constants {@link PAD_L_STICK_X}, etc.
     * @returns {number} The value of the axis between -1 and 1.
     */
    getAxis(orderIndex, axis) {
        return this.current[orderIndex] ? this.current[orderIndex].getAxis(axis) : 0;
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

export { GamePads, GamePad, GamePadButton };
