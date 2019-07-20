Object.assign(pc, function () {
    /**
     * @constructor
     * @name pc.KeyboardEvent
     * @classdesc The KeyboardEvent is passed into all event callbacks from the {@link pc.Keyboard}. It corresponds to a key press or release.
     * @description Create a new KeyboardEvent
     * @param {pc.Keyboard} keyboard The keyboard object which is firing the event.
     * @param {KeyboardEvent} event The original browser event that was fired.
     * @property {Number} key The keyCode of the key that has changed. See the pc.KEY_* constants.
     * @property {Element} element The element that fired the keyboard event.
     * @property {KeyboardEvent} event The original browser event which was fired.
     * @example
     * var onKeyDown = function (e) {
     *     if (e.key === pc.KEY_SPACE) {
     *         // space key pressed
     *     }
     *     e.event.preventDefault(); // Use original browser event to prevent browser action.
     * };
     * app.keyboard.on("keydown", onKeyDown, this);
     */
    var KeyboardEvent = function (keyboard, event) {
        if (event) {
            this.key = event.keyCode;
            this.element = event.target;
            this.event = event;
        } else {
            this.key = null;
            this.element = null;
            this.event = null;
        }
    };

    // internal global keyboard events
    var _keyboardEvent = new KeyboardEvent();

    function makeKeyboardEvent(event) {
        _keyboardEvent.key = event.keyCode;
        _keyboardEvent.element = event.target;
        _keyboardEvent.event = event;
        return _keyboardEvent;
    }

    /**
     * @private
     * @function
     * @name pc.toKeyCode
     * @description Convert a string or keycode to a keycode
     * @param {String | Number} s Either a character code or the key character.
     * @returns {Number} The character code.
     */
    function toKeyCode(s){
        if (typeof s === "string") {
            return s.toUpperCase().charCodeAt(0);
        }
        return s;
    }

    var _keyCodeToKeyIdentifier = {
        '9': 'Tab',
        '13': 'Enter',
        '16': 'Shift',
        '17': 'Control',
        '18': 'Alt',
        '27': 'Escape',

        '37': 'Left',
        '38': 'Up',
        '39': 'Right',
        '40': 'Down',

        '46': 'Delete',

        '91': 'Win'
    };

    /**
     * @event
     * @name pc.Keyboard#keydown
     * @description Event fired when a key is pressed.
     * @param {pc.KeyboardEvent} event The Keyboard event object. Note, this event is only valid for the current callback.
     * @example
     * var onKeyDown = function (e) {
     *     if (e.key === pc.KEY_SPACE) {
     *         // space key pressed
     *     }
     *     e.event.preventDefault(); // Use original browser event to prevent browser action.
     * };
     * app.keyboard.on("keydown", onKeyDown, this);
     */

    /**
     * @event
     * @name pc.Keyboard#keyup
     * @description Event fired when a key is released.
     * @param {pc.KeyboardEvent} event The Keyboard event object. Note, this event is only valid for the current callback.
     * @example
     * var onKeyUp = function (e) {
     *     if (e.key === pc.KEY_SPACE) {
     *         // space key released
     *     }
     *     e.event.preventDefault(); // Use original browser event to prevent browser action.
     * };
     * app.keyboard.on("keyup", onKeyUp, this);
     */

    /**
     * @constructor
     * @name pc.Keyboard
     * @classdesc A Keyboard device bound to an Element. Allows you to detect the state of the key presses.
     * Note, Keyboard object must be attached to an Element before it can detect any key presses.
     * @description Create a new Keyboard object
     * @param {Element} [element] Element to attach Keyboard to. Note that elements like &lt;div&gt; can't
     * accept focus by default. To use keyboard events on an element like this it must have a value of 'tabindex' e.g. tabindex="0". For more details: <a href="http://www.w3.org/WAI/GL/WCAG20/WD-WCAG20-TECHS/SCR29.html">http://www.w3.org/WAI/GL/WCAG20/WD-WCAG20-TECHS/SCR29.html</a>
     * @param {Object} [options] Optional options object.
     * @param {Boolean} [options.preventDefault] Call preventDefault() in key event handlers. This stops the default action of the event occurring. e.g. Ctrl+T will not open a new browser tab
     * @param {Boolean} [options.stopPropagation] Call stopPropagation() in key event handlers. This stops the event bubbling up the DOM so no parent handlers will be notified of the event
     * @example
     * var keyboard = new pc.Keyboard(window); // attach keyboard listeners to the window
     */
    var Keyboard = function (element, options) {
        options = options || {};
        this._element = null;

        this._keyDownHandler = this._handleKeyDown.bind(this);
        this._keyUpHandler = this._handleKeyUp.bind(this);
        this._keyPressHandler = this._handleKeyPress.bind(this);

        pc.events.attach(this);

        this._keymap = {};
        this._lastmap = {};

        if (element) {
            this.attach(element);
        }

        this.preventDefault = options.preventDefault || false;
        this.stopPropagation = options.stopPropagation || false;
    };

    /**
     * @function
     * @name pc.Keyboard#attach
     * @description Attach the keyboard event handlers to an Element
     * @param {Element} element The element to listen for keyboard events on.
     */
    Keyboard.prototype.attach = function (element) {
        if (this._element) {
            // remove previous attached element
            this.detach();
        }
        this._element = element;
        this._element.addEventListener("keydown", this._keyDownHandler, false);
        this._element.addEventListener("keypress", this._keyPressHandler, false);
        this._element.addEventListener("keyup", this._keyUpHandler, false);
    };

    /**
     * @function
     * @name pc.Keyboard#detach
     * @description Detach the keyboard event handlers from the element it is attached to.
     */
    Keyboard.prototype.detach = function () {
        this._element.removeEventListener("keydown", this._keyDownHandler);
        this._element.removeEventListener("keypress", this._keyPressHandler);
        this._element.removeEventListener("keyup", this._keyUpHandler);
        this._element = null;
    };

    /**
     * @private
     * @function
     * @name pc.Keyboard#toKeyIdentifier
     * @description Convert a key code into a key identifier
     * @param {Number} keyCode The key code.
     * @returns {String} The key identifier.
     */
    Keyboard.prototype.toKeyIdentifier = function (keyCode){
        keyCode = toKeyCode(keyCode);
        var count;
        var hex;
        var length;
        var id = _keyCodeToKeyIdentifier[keyCode.toString()];

        if (id) {
            return id;
        }

        // Convert to hex and add leading 0's
        hex = keyCode.toString(16).toUpperCase();
        length = hex.length;
        for (count = 0; count < (4 - length); count++) {
            hex = '0' + hex;
        }

        return 'U+' + hex;
    };

    Keyboard.prototype._handleKeyDown = function (event) {
        var code = event.keyCode || event.charCode;

        // Google Chrome auto-filling of login forms could raise a malformed event
        if (code === undefined) return;

        var id = this.toKeyIdentifier(code);

        this._keymap[id] = true;

        // Patch on the keyIdentifier property in non-webkit browsers
        // event.keyIdentifier = event.keyIdentifier || id;

        this.fire("keydown", makeKeyboardEvent(event));

        if (this.preventDefault) {
            event.preventDefault();
        }
        if (this.stopPropagation) {
            event.stopPropagation();
        }
    };

    Keyboard.prototype._handleKeyUp = function (event){
        var code = event.keyCode || event.charCode;

        // Google Chrome auto-filling of login forms could raise a malformed event
        if (code === undefined) return;

        var id = this.toKeyIdentifier(code);

        delete this._keymap[id];

        // Patch on the keyIdentifier property in non-webkit browsers
        // event.keyIdentifier = event.keyIdentifier || id;

        this.fire("keyup", makeKeyboardEvent(event));

        if (this.preventDefault) {
            event.preventDefault();
        }
        if (this.stopPropagation) {
            event.stopPropagation();
        }
    };

    Keyboard.prototype._handleKeyPress = function (event){
        this.fire("keypress", makeKeyboardEvent(event));

        if (this.preventDefault) {
            event.preventDefault();
        }
        if (this.stopPropagation) {
            event.stopPropagation();
        }
    };

    /**
     * @private
     * @function
     * @name pc.Keyboard#update
     * @description Called once per frame to update internal state.
     */
    Keyboard.prototype.update = function () {
        var prop;

        // clear all keys
        for (prop in this._lastmap) {
            delete this._lastmap[prop];
        }

        for (prop in this._keymap) {
            if (this._keymap.hasOwnProperty(prop)) {
                this._lastmap[prop] = this._keymap[prop];
            }
        }
    };

    /**
     * @function
     * @name pc.Keyboard#isPressed
     * @description Return true if the key is currently down.
     * @param {Number} key The keyCode of the key to test. See the pc.KEY_* constants.
     * @returns {Boolean} True if the key was pressed, false if not.
     */
    Keyboard.prototype.isPressed = function (key) {
        var keyCode = toKeyCode(key);
        var id = this.toKeyIdentifier(keyCode);

        return !!(this._keymap[id]);
    };

    /**
     * @function
     * @name pc.Keyboard#wasPressed
     * @description Returns true if the key was pressed since the last update.
     * @param {Number} key The keyCode of the key to test. See the pc.KEY_* constants.
     * @returns {Boolean} true if the key was pressed.
     */
    Keyboard.prototype.wasPressed = function (key) {
        var keyCode = toKeyCode(key);
        var id = this.toKeyIdentifier(keyCode);

        return (!!(this._keymap[id]) && !!!(this._lastmap[id]));
    };

    /**
     * @function
     * @name pc.Keyboard#wasReleased
     * @description Returns true if the key was released since the last update.
     * @param {Number} key The keyCode of the key to test. See the pc.KEY_* constants.
     * @returns {Boolean} true if the key was pressed.
     */
    Keyboard.prototype.wasReleased = function (key) {
        var keyCode = toKeyCode(key);
        var id = this.toKeyIdentifier(keyCode);

        return (!!!(this._keymap[id]) && !!(this._lastmap[id]));
    };

    return {
        Keyboard: Keyboard,
        KeyboardEvent: KeyboardEvent
    };
}());
