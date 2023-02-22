import { EventHandler } from '../../core/event-handler.js';
import { EVENT_GAMEPADCONNECTED, EVENT_GAMEPADDISCONNECTED, PAD_FACE_1, PAD_FACE_2, PAD_FACE_3, PAD_FACE_4, PAD_L_SHOULDER_1, PAD_R_SHOULDER_1, PAD_L_SHOULDER_2, PAD_R_SHOULDER_2, PAD_SELECT, PAD_START, PAD_L_STICK_BUTTON, PAD_R_STICK_BUTTON, PAD_UP, PAD_DOWN, PAD_LEFT, PAD_RIGHT, PAD_VENDOR, XRPAD_TRIGGER, XRPAD_SQUEEZE, XRPAD_TOUCHPAD_BUTTON, XRPAD_STICK_BUTTON, XRPAD_A, XRPAD_B, PAD_L_STICK_X, PAD_L_STICK_Y, PAD_R_STICK_X, PAD_R_STICK_Y, XRPAD_TOUCHPAD_X, XRPAD_TOUCHPAD_Y, XRPAD_STICK_X, XRPAD_STICK_Y } from './constants.js';
import { math } from '../../core/math/math.js';

const gamepadsEmpty = [];
/**
 * Fetch Gamepads from API.
 *
 * @type {Function}
 * @returns {Gamepad[]} Retrieved gamepads from the device.
 * @ignore
 */
let fetchGamepads = function () {
    return gamepadsEmpty;
};

if (typeof navigator !== 'undefined') {
    fetchGamepads = (navigator.getGamepads || navigator.webkitGetGamepads || fetchGamepads).bind(navigator);
}

const MAPS_INDEXES = {
    buttons: {
        PAD_FACE_1,
        PAD_FACE_2,
        PAD_FACE_3,
        PAD_FACE_4,
        PAD_L_SHOULDER_1,
        PAD_R_SHOULDER_1,
        PAD_L_SHOULDER_2,
        PAD_R_SHOULDER_2,
        PAD_SELECT,
        PAD_START,
        PAD_L_STICK_BUTTON,
        PAD_R_STICK_BUTTON,
        PAD_UP,
        PAD_DOWN,
        PAD_LEFT,
        PAD_RIGHT,
        PAD_VENDOR,
        XRPAD_TRIGGER,
        XRPAD_SQUEEZE,
        XRPAD_TOUCHPAD_BUTTON,
        XRPAD_STICK_BUTTON,
        XRPAD_A,
        XRPAD_B
    },
    axes: {
        PAD_L_STICK_X,
        PAD_L_STICK_Y,
        PAD_R_STICK_X,
        PAD_R_STICK_Y,
        XRPAD_TOUCHPAD_X,
        XRPAD_TOUCHPAD_Y,
        XRPAD_STICK_X,
        XRPAD_STICK_Y
    }
};

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
            // Analog Sticks
            'PAD_L_STICK_X',
            'PAD_L_STICK_Y',
            'PAD_R_STICK_X',
            'PAD_R_STICK_Y'
        ]
    },

    DEFAULT_DUAL: {
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

             // Vendor specific button
            'PAD_VENDOR'
        ],

        axes: [
            // Analog Sticks
            'PAD_L_STICK_X',
            'PAD_L_STICK_Y',
            'PAD_R_STICK_X',
            'PAD_R_STICK_Y'
        ],

        synthesizedButtons: {
            PAD_UP: { axis: 0, min: 0, max: 1 },
            PAD_DOWN: { axis: 0, min: -1, max: 0 },
            PAD_LEFT: { axis: 0, min: -1, max: 0 },
            PAD_RIGHT: { axis: 0, min: 0, max: 1 }
        }
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
            // Analog Sticks
            'PAD_L_STICK_X',
            'PAD_L_STICK_Y',
            'PAD_R_STICK_X',
            'PAD_R_STICK_Y'
        ],

        mapping: 'standard'
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
            // Analog Sticks
            'XRPAD_TOUCHPAD_X',
            'XRPAD_TOUCHPAD_Y',
            'XRPAD_STICK_X',
            'XRPAD_STICK_Y'
        ],

        mapping: 'xr-standard'
    }
};

const PRODUCT_CODES = {
    'Product: 0268': 'PS3'
};

const custom_maps = {};

/**
 * Retrieve the order for buttons and axes for given HTML5 Gamepad.
 *
 * @param {Gamepad} pad - The HTML5 Gamepad object.
 * @returns {object} Object defining the order of buttons and axes for given HTML5 Gamepad.
 */
function getMap(pad) {
    const custom = custom_maps[pad.id];
    if (custom) {
        return custom;
    }

    for (const code in PRODUCT_CODES) {
        if (pad.id.indexOf(code) !== -1) {
            const product = PRODUCT_CODES[code];

            if (!pad.mapping) {
                const raw = MAPS['RAW_' + product];

                if (raw) {
                    return raw;
                }
            }

            return MAPS[product];
        }
    }

    if (pad.mapping === 'xr-standard') {
        return MAPS.DEFAULT_XR;
    }

    const defaultmap = MAPS.DEFAULT;
    const map = pad.buttons.length < defaultmap.buttons.length ? MAPS.DEFAULT_DUAL : defaultmap;
    map.mapping = pad.mapping;
    return map;
}

let deadZone = 0.25;

/**
 * @param {number} ms - Number of milliseconds to sleep for.
 * @returns {Promise<void>}
 */
function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

/**
 * A GamePadButton stores information about a button from the Gamepad API.
 */
class GamePadButton {
    /**
     * The value for the button between 0 and 1, with 0 representing a button that is not pressed, and 1 representing a button that is fully pressed.
     *
     * @type {number}
     */
    value;

    /**
     * Whether the button is currently down.
     *
     * @type {boolean}
     */
    pressed;

    /**
     * Whether the button is currently touched.
     *
     * @type {boolean}
     */

    touched;

    /**
     * Whether this button was pressed on last frame.
     *
     * @type {boolean}
     * @ignore
     */
    _previouslyPressed;

    /**
     * Whether this button was touched on last frame.
     *
     * @type {boolean}
     * @ignore
     */
    _previouslyTouched;

    /**
     * Create a new GamePadButton instance.
     *
     * @param {number|GamepadButton} current - The original Gamepad API gamepad button.
     * @param {number|GamepadButton} [previous] - The previous Gamepad API gamepad button.
     * @hideconstructor
     */
    constructor(current, previous) {
        if (typeof current === 'number') {
            this.value = current;
            this.pressed = current === 1;
            this.touched = current > 0;
        } else {
            this.value = current.value;
            this.pressed = current.pressed;
            this.touched = current.touched ?? current.value > 0;
        }

        if (previous) {
            if (typeof previous === 'number') {
                this._previouslyPressed = previous === 1;
                this._previouslyTouched = previous > 0;
            } else {
                this._previouslyPressed = previous.pressed;
                this._previouslyTouched = previous.touched ?? previous.value > 0;
            }
        } else {
            this.updatePrevious();
        }
    }

    /**
     * Update the existing GamePadButton Instance.
     *
     * @param {GamepadButton} button - The original Gamepad API gamepad button.
     * @ignore
     */
    update(button) {
        this.updatePrevious();

        this.value = button.value;
        this.pressed = button.pressed;
        this.touched = button.touched ?? button.value > 0;
    }

    /**
     * Update the previous values for this button.
     *
     * @ignore
     */
    updatePrevious() {
        this._previouslyPressed = this.pressed;
        this._previouslyTouched = this.touched;
    }

    /**
     * Whether the button was pressed.
     *
     * @type {boolean}
     */
    get wasPressed() {
        return !this._previouslyPressed && this.pressed;
    }

    /**
     * Whether the button was released since the last update.
     *
     * @type {boolean}
     */
    get wasReleased() {
        return this._previouslyPressed && !this.pressed;
    }

    /**
     * Whether the button was touched since the last update.
     *
     * @type {boolean}
     */
    get wasTouched() {
        return !this._previouslyTouched && this.touched;
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
            return new GamePadButton(b);
        });

        /**
         * The axes values from the GamePad. Order is provided by API, use GamePad#axes instead.
         *
         * @type {number[]}
         * @ignore
         */
        this._axes = [...gamepad.axes];

        /**
         * Previous value for the analog axes present on the gamepad. Values are between -1 and 1.
         *
         * @type {number[]}
         * @ignore
         */
        this._previousAxes = [...gamepad.axes];

        /**
         * The gamepad mapping detected by the browser. Value is either "standard", "xr-standard", "" or "custom". When empty string, you may need to update the mapping yourself. "custom" means you updated the mapping.
         *
         * @type {string}
         */
        this.mapping = map.mapping;

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
     * Whether the gamepad is connected
     *
     * @type {boolean}
     */
    get connected() {
        return this.pad.connected;
    }

    /**
     * Update the existing GamePad Instance.
     *
     * @param {Gamepad} gamepad - The original Gamepad API gamepad.
     * @ignore
     */
    update(gamepad) {
        this.pad = gamepad;

        // Store previous values for axes for dual buttons.
        const previousAxes = this._previousAxes;
        previousAxes.length = 0;
        previousAxes.push(...this._axes);

        // Update axes
        const axes = this._axes;
        axes.length = 0;
        this._axes.push(...gamepad.axes);

        // Update buttons
        const buttons = this._buttons;
        for (let i = 0, l = buttons.length; i < l; i++) {
            const button = buttons[i];

            if (button) {
                button.update(gamepad.buttons[i]);
            }
        }

        return this;
    }

    /**
     * Update the map for this gamepad.
     *
     * @param {object} map - The new mapping for this gamepad.
     * @param {string[]} map.buttons - Buttons mapping for this gamepad.
     * @param {string[]} map.axes - Axes mapping for this gamepad.
     * @param {object} [map.synthesizedButtons] - Information about buttons to pull from axes for this gamepad. Requires definition of axis index, min value and max value.
     * @param {"custom"} [map.mapping] - New mapping format. Will be forced into "custom".
     * @example
     * this.pad.updateMap({
     *     buttons: [[
     *         'PAD_FACE_1',
     *         'PAD_FACE_2',
     *         'PAD_FACE_3',
     *         'PAD_FACE_4',
     *         'PAD_L_SHOULDER_1',
     *         'PAD_R_SHOULDER_1',
     *         'PAD_L_SHOULDER_2',
     *         'PAD_R_SHOULDER_2',
     *         'PAD_SELECT',
     *         'PAD_START',
     *         'PAD_L_STICK_BUTTON',
     *         'PAD_R_STICK_BUTTON',
     *         'PAD_VENDOR'
     *     ],
     *     axes: [
     *         'PAD_L_STICK_X',
     *         'PAD_L_STICK_Y',
     *         'PAD_R_STICK_X',
     *         'PAD_R_STICK_Y'
     *     ],
     *     synthesizedButtons: {
     *         PAD_UP: { axis: 0, min: 0, max: 1 },
     *         PAD_DOWN: { axis: 0, min: -1, max: 0 },
     *         PAD_LEFT: { axis: 0, min: -1, max: 0 },
     *         PAD_RIGHT: { axis: 0, min: 0, max: 1 }
     *     }
     * });
     */
    updateMap(map) {
        map.mapping = 'custom';

        // Save the map in case of disconnection.
        custom_maps[this.id] = map;

        this.map = map;
        this.mapping = 'custom';
    }

    /**
     * Reset gamepad mapping to default.
     */
    resetMap() {
        if (custom_maps[this.id]) {
            delete custom_maps[this.id];

            const map = getMap(this.pad);
            this.map = map;
            this.mapping = map.mapping;
        }
    }

    /**
     * The values from analog axes present on the GamePad. Values are between -1 and 1.
     *
     * @type {number[]}
     */
    get axes() {
        return this.map.axes ? this.map.axes.map(a => this.pad.axes[MAPS_INDEXES.axes[a]] || 0) : [];
    }

    /**
     * The buttons present on the GamePad. Some buttons may be null.
     *
     * @type {GamePadButton[]}
     */
    get buttons() {
        return this.map.buttons ? this.map.buttons.map(b => this._getButton(b)) : [];
    }

    /**
     * Make the gamepad vibrate.
     *
     * @param {number} intensity - Intensity for the vibration in the range 0 to 1.
     * @param {number} duration - Duration for the vibration in milliseconds.
     * @param {object} [options] - Options for special vibration pattern.
     * @param {number} [options.startDelay] - Delay before the pattern starts, in milliseconds. Defaults to 0.
     * @param {number} [options.strongMagnitude] - Intensity for strong actuators in the range 0 to 1. Defaults to intensity.
     * @param {number} [options.weakMagnitude] - Intensity for weak actuators in the range 0 to 1. Defaults to intensity.
     * @returns {Promise<boolean>} Return a Promise resulting in true if the pulse was successfully completed.
     */
    async pulse(intensity, duration, options) {
        const actuators = this.pad.vibrationActuator ? [this.pad.vibrationActuator] : this.pad.hapticActuators || [];

        if (actuators.length) {
            const startDelay = options?.startDelay ?? 0;
            const strongMagnitude = options?.strongMagnitude ?? intensity;
            const weakMagnitude = options?.weakMagnitude ?? intensity;

            const results = await Promise.all(
                actuators.map(async (actuator) => {
                    if (!actuator) {
                        return true;
                    }

                    if (actuator.playEffect) {
                        return actuator.playEffect(actuator.type, {
                            duration,
                            startDelay,
                            strongMagnitude,
                            weakMagnitude
                        });
                    } else if (actuator.pulse) {
                        await sleep(startDelay);
                        return actuator.pulse(intensity, duration);
                    }

                    return false;
                })
            );

            return results.some(r => r === true || r === 'complete');
        }

        return false;
    }

    /**
     * Retrieve a button from its index name.
     *
     * @param {string} indexName - The index name to return the button for.
     * @returns {GamePadButton|null} The button for the searched index. Can be null.
     * @ignore
     */
    _getButton(indexName) {
        const synthesizedButton = this.map.synthesizedButtons[indexName];
        if (synthesizedButton) {
            const { axis, max, min } = synthesizedButton;

            return new GamePadButton(
                Math.abs(math.clamp(this._axes[axis] ?? 0, min, max)),
                Math.abs(math.clamp(this._previousAxes[axis] ?? 0, min, max))
            );
        }

        const button = this._buttons[MAPS_INDEXES.buttons[indexName]];

        if (button) {
            return button;
        }


        return null;
    }

    /**
     * Retrieve a button from its index.
     *
     * @param {number} index - The index to return the button for.
     * @returns {GamePadButton|null} The button for the searched index. Can be null.
     */
    getButton(index) {
        const buttons = this.map.buttons;
        return buttons && buttons[index] ? this._getButton(buttons[index]) : null;
    }

    /**
     * Returns true if the button is pressed.
     *
     * @param {number} button - The button to test, use constants {@link PAD_FACE_1}, etc.
     * @returns {boolean} True if the button is pressed.
     */
    isPressed(button) {
        return this.getButton(button)?.pressed || false;
    }

    /**
     * Return true if the button was pressed since the last update.
     *
     * @param {number} button - The button to test, use constants {@link PAD_FACE_1}, etc.
     * @returns {boolean} Return true if the button was pressed, false if not.
     */
    wasPressed(button) {
        return this.getButton(button)?.wasPressed || false;
    }

    /**
     * Return true if the button was released since the last update.
     *
     * @param {number} button - The button to test, use constants {@link PAD_FACE_1}, etc.
     * @returns {boolean} Return true if the button was released, false if not.
     */
    wasReleased(button) {
        return this.getButton(button)?.wasReleased || false;
    }

    /**
     * Returns true if the button is touched.
     *
     * @param {number} button - The button to test, use constants {@link PAD_FACE_1}, etc.
     * @returns {boolean} True if the button is touched.
     */
    isTouched(button) {
        return this.getButton(button)?.touched || false;
    }

    /**
     * Return true if the button was touched since the last update.
     *
     * @param {number} button - The button to test, use constants {@link PAD_FACE_1}, etc.
     * @returns {boolean} Return true if the button was touched, false if not.
     */
    wasTouched(button) {
        return this.getButton(button)?.wasTouched || false;
    }

    /**
     * Returns the value of a button between 0 and 1, with 0 representing a button that is not pressed, and 1 representing a button that is fully pressed.
     *
     * @param {number} button - The button to retrieve, use constants {@link PAD_FACE_1}, etc.
     * @returns {number} The value of the button between 0 and 1.
     */
    getValue(button) {
        return this.getButton(button)?.value || 0;
    }

    /**
     * Get the value of one of the analog axes of the pad.
     *
     * @param {number} axis - The axis to get the value of, use constants {@link PAD_L_STICK_X}, etc.
     * @returns {number} The value of the axis between -1 and 1.
     */
    getAxis(axis) {
        const a = this.axes[axis];
        return a && Math.abs(a) > deadZone ? a : 0;
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
        this.gamepadsSupported = typeof navigator !== 'undefined' ? !!navigator.getGamepads || !!navigator.webkitGetGamepads : false;

        /**
         * The list of current gamepads.
         *
         * @type {GamePad[]}
         */
        this.current = [];

        /**
         * The list of previous buttons states
         *
         * @type {boolean[][]}
         * @ignore
         */
        this._previous = [];

        this._ongamepadconnectedHandler = this._ongamepadconnected.bind(this);
        this._ongamepaddisconnectedHandler = this._ongamepaddisconnected.bind(this);

        window.addEventListener('gamepadconnected', this._ongamepadconnectedHandler, false);
        window.addEventListener('gamepaddisconnected', this._ongamepaddisconnectedHandler, false);

        this.poll();
    }

    /**
     * Fired when a gamepad is connected.
     *
     * @event GamePads#gamepadconnected
     * @param {GamePad} gamepad - The gamepad that was just connected.
     * @example
     * var onPadConnected = function (pad) {
     *     if (!pad.mapping) {
     *         // Map the gamepad as the system could not find the proper map.
     *     } else {
     *         // Make the gamepad pulse.
     *     }
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
     * Threshold for axes to return values. Must be between 0 and 1.
     *
     * @type {number}
     * @ignore
     */
    get deadZone() {
        return deadZone;
    }

    /**
     * The list of previous buttons states.
     *
     * @type {boolean[][]}
     * @ignore
     */
    get previous() {
        const current = this.current;

        for (let i = 0, l = current.length; i < l; i++) {
            const buttons = current[i]._buttons;

            if (!this._previous[i]) {
                this._previous[i] = [];
            }

            for (let j = 0, m = buttons.length; j < m; j++) {
                this._previous[i][j] = buttons[i]?._previouslyPressed || false;
            }
        }

        this._previous.length = this.current.length;
        return this._previous;
    }

    /**
     * Callback function when a gamepad is connecting.
     *
     * @param {GamepadEvent} event - The event containing the connecting gamepad.
     * @ignore
     */
    _ongamepadconnected(event) {
        const pad = new GamePad(event.gamepad, this.getMap(event.gamepad));
        const current = this.current;

        let padIndex = current.findIndex(gp => gp.index === pad.index);
        while (padIndex !== -1) {
            current.splice(padIndex, 1);
            padIndex = current.findIndex(gp => gp.index === pad.index);
        }

        current.push(pad);
        this.fire(EVENT_GAMEPADCONNECTED, pad);
    }

    /**
     * Callback function when a gamepad is disconnecting.
     *
     * @param {GamepadEvent} event - The event containing the disconnecting gamepad.
     * @ignore
     */
    _ongamepaddisconnected(event) {
        const current = this.current;
        const padIndex = current.findIndex(gp => gp.index === event.gamepad.index);

        if (padIndex !== -1) {
            this.fire(EVENT_GAMEPADDISCONNECTED, current[padIndex]);
            current.splice(padIndex, 1);
        }
    }

    /**
     * Update the previous state of the gamepads. This must be called every frame for
     * `wasPressed` and `wasTouched` to work.
     *
     * @ignore
     */
    update() {
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
            const padDevices = fetchGamepads();

            for (let i = 0, len = padDevices.length; i < len; i++) {
                if (padDevices[i]) {
                    const pad = this.findByIndex(padDevices[i].index);

                    if (pad) {
                        pads.push(pad.update(padDevices[i]));
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

    /**
     * Destroy the event listeners.
     *
     * @ignore
     */
    destroy() {
        window.removeEventListener('gamepadconnected', this._ongamepadconnectedHandler, false);
        window.removeEventListener('gamepaddisconnected', this._ongamepaddisconnectedHandler, false);
    }

    /**
     * Retrieve the order for buttons and axes for given HTML5 Gamepad.
     *
     * @param {Gamepad} pad - The HTML5 Gamepad object.
     * @returns {object} Object defining the order of buttons and axes for given HTML5 Gamepad.
     */
    getMap(pad) {
        return getMap(pad);
    }

    /**
     * Returns true if the button on the pad requested is pressed.
     *
     * @param {number} orderIndex - The order index of the pad to check, use constants {@link PAD_1}, {@link PAD_2}, etc. For gamepad index call the function from the pad.
     * @param {number} button - The button to test, use constants {@link PAD_FACE_1}, etc.
     * @returns {boolean} True if the button is pressed.
     */
    isPressed(orderIndex, button) {
        return this.current[orderIndex]?.isPressed(button) || false;
    }

    /**
     * Returns true if the button was pressed since the last frame.
     *
     * @param {number} orderIndex - The index of the pad to check, use constants {@link PAD_1}, {@link PAD_2}, etc. For gamepad index call the function from the pad.
     * @param {number} button - The button to test, use constants {@link PAD_FACE_1}, etc.
     * @returns {boolean} True if the button was pressed since the last frame.
     */
    wasPressed(orderIndex, button) {
        return this.current[orderIndex]?.wasPressed(button) || false;
    }

    /**
     * Returns true if the button was released since the last frame.
     *
     * @param {number} orderIndex - The index of the pad to check, use constants {@link PAD_1}, {@link PAD_2}, etc. For gamepad index call the function from the pad.
     * @param {number} button - The button to test, use constants {@link PAD_FACE_1}, etc.
     * @returns {boolean} True if the button was released since the last frame.
     */
    wasReleased(orderIndex, button) {
        return this.current[orderIndex]?.wasReleased(button) || false;
    }

    /**
     * Get the value of one of the analog axes of the pad.
     *
     * @param {number} orderIndex - The index of the pad to check, use constants {@link PAD_1}, {@link PAD_2}, etc. For gamepad index call the function from the pad.
     * @param {number} axis - The axis to get the value of, use constants {@link PAD_L_STICK_X}, etc.
     * @returns {number} The value of the axis between -1 and 1.
     */
    getAxis(orderIndex, axis) {
        return this.current[orderIndex]?.getAxis(axis) || 0;
    }

    /**
     * Make the gamepad vibrate.
     *
     * @param {number} orderIndex - The index of the pad to check, use constants {@link PAD_1}, {@link PAD_2}, etc. For gamepad index call the function from the pad.
     * @param {number} intensity - Intensity for the vibration in the range 0 to 1.
     * @param {number} duration - Duration for the vibration in milliseconds.
     * @param {object} [options] - Options for special vibration pattern.
     * @param {number} [options.startDelay] - Delay before the pattern starts, in milliseconds. Defaults to 0.
     * @param {number} [options.strongMagnitude] - Intensity for strong actuators in the range 0 to 1. Defaults to intensity.
     * @param {number} [options.weakMagnitude] - Intensity for weak actuators in the range 0 to 1. Defaults to intensity.
     * @returns {Promise<boolean>} Return a Promise resulting in true if the pulse was successfully completed.
     */
    pulse(orderIndex, intensity, duration, options) {
        const pad = this.current[orderIndex];
        return pad ? pad.pulse(intensity, duration, options) : Promise.resolve(false);
    }

    /**
     * Make all gamepads vibrate.
     *
     * @param {number} intensity - Intensity for the vibration in the range 0 to 1.
     * @param {number} duration - Duration for the vibration in milliseconds.
     * @param {object} [options] - Options for special vibration pattern.
     * @param {number} [options.startDelay] - Delay before the pattern starts, in milliseconds. Defaults to 0.
     * @param {number} [options.strongMagnitude] - Intensity for strong actuators in the range 0 to 1. Defaults to intensity.
     * @param {number} [options.weakMagnitude] - Intensity for weak actuators in the range 0 to 1. Defaults to intensity.
     * @returns {Promise<boolean[]>} Return a Promise resulting in an array of booleans defining if the pulse was successfully completed for every gamepads.
     */
    pulseAll(intensity, duration, options) {
        return Promise.all(
            this.current.map(pad => pad.pulse(intensity, duration, options))
        );
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
