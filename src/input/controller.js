Object.assign(pc, function () {

    /**
     * @class
     * @name pc.Controller
     * @classdesc A general input handler which handles both mouse and keyboard input assigned to named actions.
     * This allows you to define input handlers separately to defining keyboard/mouse configurations.
     * @description Create a new instance of a Controller.
     * @param {Element} [element] - Element to attach Controller to.
     * @param {object} [options] - Optional arguments.
     * @param {pc.Keyboard} [options.keyboard] - A Keyboard object to use.
     * @param {pc.Mouse} [options.mouse] - A Mouse object to use.
     * @param {pc.GamePads} [options.gamepads] - A Gamepads object to use.
     * @example
     * var c = new pc.Controller(document);
     *
     * // Register the "fire" action and assign it to both the Enter key and the Spacebar.
     * c.registerKeys("fire", [pc.KEY_ENTER, pc.KEY_SPACE]);
     */
    var Controller = function (element, options) {
        options = options || {};
        this._keyboard = options.keyboard || null;
        this._mouse = options.mouse || null;
        this._gamepads = options.gamepads || null;

        this._element = null;

        this._actions = {};
        this._axes = {};
        this._axesValues = {};

        if (element) {
            this.attach(element);
        }
    };

    /**
     * @function
     * @name pc.Controller#attach
     * @description Attach Controller to a Element, this is required before you can monitor for key/mouse inputs.
     * @param {Element} element - The element to attach mouse and keyboard event handler too.
     */
    Controller.prototype.attach = function (element) {
        this._element = element;
        if (this._keyboard) {
            this._keyboard.attach(element);
        }

        if (this._mouse) {
            this._mouse.attach(element);
        }
    };

    /**
     * @function
     * @name pc.Controller#detach
     * @description Detach Controller from an Element, this should be done before the Controller is destroyed.
     */
    Controller.prototype.detach = function () {
        if (this._keyboard) {
            this._keyboard.detach();
        }
        if (this._mouse) {
            this._mouse.detach();
        }
        this._element = null;
    };

    /**
     * @function
     * @name pc.Controller#disableContextMenu
     * @description Disable the context menu usually activated with the right mouse button.
     */
    Controller.prototype.disableContextMenu = function () {
        if (!this._mouse) {
            this._enableMouse();
        }

        this._mouse.disableContextMenu();
    };

    /**
     * @function
     * @name pc.Controller#enableContextMenu
     * @description Enable the context menu usually activated with the right mouse button. This is enabled by default.
     */
    Controller.prototype.enableContextMenu = function () {
        if (!this._mouse) {
            this._enableMouse();
        }

        this._mouse.enableContextMenu();
    };

    /**
     * @function
     * @name pc.Controller#update
     * @description Update the Keyboard and Mouse handlers.
     * @param {object} dt - The time since the last frame.
     */
    Controller.prototype.update = function (dt) {
        if (this._keyboard) {
            this._keyboard.update(dt);
        }

        if (this._mouse) {
            this._mouse.update(dt);
        }

        if (this._gamepads) {
            this._gamepads.update(dt);
        }

        // clear axes values
        this._axesValues = {};
        for (var key in this._axes) {
            this._axesValues[key] = [];
        }
    };

    /**
     * @function
     * @name pc.Controller#registerKeys
     * @description Create or update a action which is enabled when the supplied keys are pressed.
     * @param {string} action - The name of the action.
     * @param {number[]} keys - A list of keycodes.
     */
    Controller.prototype.registerKeys = function (action, keys) {
        if (!this._keyboard) {
            this._enableKeyboard();
        }
        if (this._actions[action]) {
            throw new Error(pc.string.format("Action: {0} already registered", action));
        }

        if (keys === undefined) {
            throw new Error('Invalid button');
        }

        // convert to an array
        if (!keys.length) {
            keys = [keys];
        }

        if (this._actions[action]) {
            this._actions[action].push({
                type: pc.ACTION_KEYBOARD,
                keys: keys
            });
        } else {
            this._actions[action] = [{
                type: pc.ACTION_KEYBOARD,
                keys: keys
            }];
        }
    };

    /**
     * @function
     * @name pc.Controller#registerMouse
     * @description Create or update an action which is enabled when the supplied mouse button is pressed.
     * @param {string} action - The name of the action.
     * @param {number} button - The mouse button.
     */
    Controller.prototype.registerMouse = function (action, button) {
        if (!this._mouse) {
            this._enableMouse();
        }

        if (button === undefined) {
            throw new Error('Invalid button');
        }

        // Mouse actions are stored as negative numbers to prevent clashing with keycodes.
        if (this._actions[action]) {
            this._actions[action].push({
                type: pc.ACTION_MOUSE,
                button: button
            });
        } else {
            this._actions[action] = [{
                type: pc.ACTION_MOUSE,
                button: -button
            }];
        }
    };

    /**
     * @function
     * @name pc.Controller#registerPadButton
     * @description Create or update an action which is enabled when the gamepad button is pressed.
     * @param {string} action - The name of the action.
     * @param {number} pad - The index of the pad to register (use pc.PAD_1, etc).
     * @param {number} button - The pad button.
     */
    Controller.prototype.registerPadButton = function (action, pad, button) {
        if (button === undefined) {
            throw new Error('Invalid button');
        }
        // Mouse actions are stored as negative numbers to prevent clashing with keycodes.
        if (this._actions[action]) {
            this._actions[action].push({
                type: pc.ACTION_GAMEPAD,
                button: button,
                pad: pad
            });
        } else {
            this._actions[action] = [{
                type: pc.ACTION_GAMEPAD,
                button: button,
                pad: pad
            }];
        }
    };

    /**
     * @function
     * @name pc.Controller#registerAxis
     * @param {object} [options] - Optional options object.
     * @param {object} [options.pad] - The index of the game pad to register for (use pc.PAD_1, etc).
     */
    Controller.prototype.registerAxis = function (options) {
        var name = options.name;
        if (!this._axes[name]) {
            this._axes[name] = [];
        }
        var i = this._axes[name].push(name);

        //
        options = options || {};
        options.pad = options.pad || pc.PAD_1;

        var bind = function (controller, source, value, key) {
            switch (source) {
                case 'mousex':
                    controller._mouse.on(pc.EVENT_MOUSEMOVE, function (e) {
                        controller._axesValues[name][i] = e.dx / 10;
                    });
                    break;
                case 'mousey':
                    controller._mouse.on(pc.EVENT_MOUSEMOVE, function (e) {
                        controller._axesValues[name][i] = e.dy / 10;
                    });
                    break;
                case 'key':
                    controller._axes[name].push(function () {
                        return controller._keyboard.isPressed(key) ? value : 0;
                    });
                    break;
                case 'padrx':
                    controller._axes[name].push(function () {
                        return controller._gamepads.getAxis(options.pad, pc.PAD_R_STICK_X);
                    });
                    break;
                case 'padry':
                    controller._axes[name].push(function () {
                        return controller._gamepads.getAxis(options.pad, pc.PAD_R_STICK_Y);
                    });
                    break;
                case 'padlx':
                    controller._axes[name].push(function () {
                        return controller._gamepads.getAxis(options.pad, pc.PAD_L_STICK_X);
                    });
                    break;
                case 'padly':
                    controller._axes[name].push(function () {
                        return controller._gamepads.getAxis(options.pad, pc.PAD_L_STICK_Y);
                    });
                    break;
                default:
                    throw new Error('Unknown axis');
            }
        };

        bind(this, options.positive, 1, options.positiveKey);
        if (options.negativeKey || options.negative !== options.positive) {
            bind(this, options.negative, -1, options.negativeKey);
        }

    };

    /**
     * @function
     * @name pc.Controller#isPressed
     * @description Returns true if the current action is enabled.
     * @param {string} actionName - The name of the action.
     * @returns {boolean} True if the action is enabled.
     */
    Controller.prototype.isPressed = function (actionName) {
        if (!this._actions[actionName]) {
            return false;
        }

        var action;
        var index = 0;
        var length = this._actions[actionName].length;

        for (index = 0; index < length; ++index) {
            action = this._actions[actionName][index];
            switch (action.type) {
                case pc.ACTION_KEYBOARD:
                    if (this._keyboard) {
                        var i, len = action.keys.length;
                        for (i = 0; i < len; i++) {
                            if (this._keyboard.isPressed(action.keys[i])) {
                                return true;
                            }
                        }
                    }
                    break;
                case pc.ACTION_MOUSE:
                    if (this._mouse && this._mouse.isPressed(action.button)) {
                        return true;
                    }
                    break;
                case pc.ACTION_GAMEPAD:
                    if (this._gamepads && this._gamepads.isPressed(action.pad, action.button)) {
                        return true;
                    }
                    break;
            }
        }
        return false;
    };

    /**
     * @function
     * @name pc.Controller#wasPressed
     * @description Returns true if the action was enabled this since the last update.
     * @param {string} actionName - The name of the action.
     * @returns {boolean} True if the action was enabled this since the last update.
     */
    Controller.prototype.wasPressed = function (actionName) {
        if (!this._actions[actionName]) {
            return false;
        }

        var index = 0;
        var length = this._actions[actionName].length;

        for (index = 0; index < length; ++index) {
            var action = this._actions[actionName][index];
            switch (action.type) {
                case pc.ACTION_KEYBOARD:
                    if (this._keyboard) {
                        var i, len = action.keys.length;
                        for (i = 0; i < len; i++) {
                            if (this._keyboard.wasPressed(action.keys[i])) {
                                return true;
                            }
                        }
                    }
                    break;
                case pc.ACTION_MOUSE:
                    if (this._mouse && this._mouse.wasPressed(action.button)) {
                        return true;
                    }
                    break;
                case pc.ACTION_GAMEPAD:
                    if (this._gamepads && this._gamepads.wasPressed(action.pad, action.button)) {
                        return true;
                    }
                    break;
            }
        }
        return false;
    };

    Controller.prototype.getAxis = function (name) {
        var value = 0;

        if (this._axes[name]) {
            var i, len = this._axes[name].length;
            for (i = 0; i < len; i++) {
                if (pc.type(this._axes[name][i]) === 'function') {
                    var v = this._axes[name][i]();
                    if (Math.abs(v) > Math.abs(value)) {
                        value = v;
                    }
                } else if (this._axesValues[name]) {
                    if (Math.abs(this._axesValues[name][i]) > Math.abs(value)) {
                        value = this._axesValues[name][i];
                    }
                }
            }
        }

        return value;
    };

    Controller.prototype._enableMouse = function () {
        this._mouse = new pc.Mouse();
        if (!this._element) {
            throw new Error("Controller must be attached to an Element");
        }
        this._mouse.attach(this._element);
    };

    Controller.prototype._enableKeyboard = function () {
        this._keyboard = new pc.Keyboard();
        if (!this._element) {
            throw new Error("Controller must be attached to an Element");
        }
        this._keyboard.attach(this._element);
    };

    return {
        Controller: Controller
    };
}());
