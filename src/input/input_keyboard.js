pc.extend(pc.input, function(){
    
    /**
    * @name pc.input.KeyboardEvent
    * @class The KeyboardEvent is passed into all event callbacks from the {@link pc.input.Keyboard}. It corresponds to a key press or release.
    * @constructor Create a new KeyboardEvent
    * @param {pc.input.Keyboard} keyboard The keyboard object which is firing the event.
    * @param {KeyboardEvent} event The original browser event that was fired.
    * @property {pc.input.KEY} key The keyCode of the key that has changed.
    * @property {DOMElement} element The element that fired the keyboard event.
    * @property {KeyboardEvent} event The original browser event which was fired.
    */
    var KeyboardEvent = function (keyboard, event) {
        this.key = event.keyCode;
        this.element = event.target;
        this.event = event;
    };

    /**
     * @function
     * @name pc.input.toKeyCode
     * @description Convert a string or keycode to a keycode
     * @param {String | Number} s
     * @private
     */
    function toKeyCode(s){
        if (typeof(s) == "string") {
            return s.toUpperCase().charCodeAt(0);
        }
        else {
            return s;
        }
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
    * @name pc.input.Keyboard#keydown
    * @description Event fired when a key is pressed.
    * @param {pc.input.KeyboardEvent} event The Keyboard event object
    */

    /**
    * @event
    * @name pc.input.Keyboard#keyup
    * @description Event fired when a key is released.
    * @param {pc.input.KeyboardEvent} event The Keyboard event object
    */

    /**
     * @name pc.input.Keyboard
     * @class A Keyboard device bound to a DOMElement. Allows you to detect the state of the key presses. 
     * Note, Keyboard object must be attached to a DOMElement before it can detect any key presses. 
     * @constructor Create a new Keyboard object
     * @param {DOMElement} [element] Element to attach Keyboard to. <br />Note: Elements like <div> can't accept focus by default. To use keyboard events on an element like this it must have a value of 'tabindex' e.g. tabindex="0". For more details: <a href="http://www.w3.org/WAI/GL/WCAG20/WD-WCAG20-TECHS/SCR29.html">http://www.w3.org/WAI/GL/WCAG20/WD-WCAG20-TECHS/SCR29.html</a>
     * @param {Object} [options]
     * @param {Boolean} [options.preventDefault] Call preventDefault() in key event handlers. This stops the default action of the event occuring. e.g. Ctrl+T will not open a new browser tab
     * @param {Boolean} [options.stopPropagation] Call stopPropagation() in key event handlers. This stops the event bubbling up the DOM so no parent handlers will be notified of the event
     */
    var Keyboard = function(element, options) {
        options = options || {};
        this._element = null;
        
        this._keyDownHandler = this._handleKeyDown.bind(this);
        this._keyUpHandler = this._handleKeyUp.bind(this);
        this._keyPressHandler = this._handleKeyPress.bind(this);
        
        pc.extend(this, pc.events);
        
        this._keymap = {};
        this._lastmap = {};
        
        if(element) {
            this.attach(element);
        }
        
        this.preventDefault = options.preventDefault || false;
        this.stopPropagation = options.stopPropagation || false;
    };
    
    /**
    * @function
    * @name pc.input.Keyboard#attach
    * @description Attach the keyboard event handlers to a DOMElement
    * @param {DOMElement} element The element to listen for keyboard events on.
    */
    Keyboard.prototype.attach = function (element) {
        if(this._element) {
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
    * @name pc.input.Keyboard#detach
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
     * @name pc.input.Keyboard#toKeyIdentifier
     * @description Convert a key code into a key identifier
     * @param {Number} keyCode
     */
    Keyboard.prototype.toKeyIdentifier = function(keyCode){
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
    
    Keyboard.prototype._handleKeyDown = function(event) {
        var code = event.keyCode || event.charCode;
        var id = event.keyIdentifier || this.toKeyIdentifier(code);

        this._keymap[id] = true;
            
        // Patch on the keyIdentifier property in non-webkit browsers
        //event.keyIdentifier = event.keyIdentifier || id;
        
        this.fire("keydown", new KeyboardEvent(this, event));
        
        if (this.preventDefault) {
            event.preventDefault();
        }
        if (this.stopPropagation) {
            event.stopPropagation();
        }
    };
    
    Keyboard.prototype._handleKeyUp = function(event){
        var code = event.keyCode || event.charCode;
        var id = event.keyIdentifier || this.toKeyIdentifier(code);
        
        delete this._keymap[id];

        // Patch on the keyIdentifier property in non-webkit browsers
        //event.keyIdentifier = event.keyIdentifier || id;
        
        this.fire("keyup", new KeyboardEvent(this, event));

        if (this.preventDefault) {
            event.preventDefault();
        }
        if (this.stopPropagation) {
            event.stopPropagation();
        }
    };
    
    Keyboard.prototype._handleKeyPress = function(event){
        var code = event.keyCode || event.charCode;
        var id = event.keyIdentifier || this.toKeyIdentifier(code);
        
        // Patch on the keyIdentifier property in non-webkit browsers
        //event.keyIdentifier = event.keyIdentifier || id;
        
        this.fire("keypress", new KeyboardEvent(this, event));

        if (this.preventDefault) {
            event.preventDefault();
        }
        if (this.stopPropagation) {
            event.stopPropagation();
        }

    };
    
    /**
     * @function
     * @name pc.input.Keyboard#update
     * @description Called once per frame to update internal state
     */
    Keyboard.prototype.update = function (dt) {
        var prop;
        this._lastmap = {};
        for(prop in this._keymap) {
            if(this._keymap.hasOwnProperty(prop)) {
                this._lastmap[prop] = this._keymap[prop];
            }
        }             
    };
    
    /**
     * @function
     * @name pc.input.Keyboard#isPressed
     * @description Return true if the key is currently down
     * @param {pc.input.KEY} key The keyCode of the key to test.
     * @return {Boolean} True if the key was pressed, false if not
     */
    Keyboard.prototype.isPressed = function (key) {
        var keyCode = toKeyCode(key);
        var id = this.toKeyIdentifier(keyCode);
        
        return !!(this._keymap[id]);
    };
    
    /**
     * @function
     * @name pc.input.Keyboard#wasPressed
     * @description Returns true if the key was pressed since the last update.
     * @param {pc.input.KEY} key The keyCode of the key to test.
     * @return {Boolean} true if the key was pressed
     */
    Keyboard.prototype.wasPressed = function (key) {
        var keyCode = toKeyCode(key);
        var id = this.toKeyIdentifier(keyCode);
        
        return (!!(this._keymap[id]) && !!!(this._lastmap[id]));
    };

    return {
        Keyboard: Keyboard,
        /**
         * @enum pc.input.EVENT
         * @name pc.input.EVENT_KEYDOWN
         * @description Name of event fired when a key is pressed
         */
         EVENT_KEYDOWN: 'keydown',
        /**
         * @enum pc.input.EVENT
         * @name pc.input.EVENT_KEYUP
         * @description Name of event fired when a key is released
         */
         EVENT_KEYUP: 'keyup',

        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_BACKSPACE
         */        
        KEY_BACKSPACE: 8,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_TAB
         */
        KEY_TAB: 9,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_RETURN
         */
        KEY_RETURN: 13,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_ENTER
         */
        KEY_ENTER: 14,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_SHIFT
         */
        KEY_SHIFT: 16,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_CONTROL
         */
        KEY_CONTROL: 17,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_ALT
         */
        KEY_ALT: 18,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_PAUSE
         */
        KEY_PAUSE: 19,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_CAPS_LOCK
         */
        KEY_CAPS_LOCK: 20,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_ESCAPE
         */
        KEY_ESCAPE: 27,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_SPACE
         */
        KEY_SPACE: 32,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_PAGE_UP
         */
        KEY_PAGE_UP: 33,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_PAGE_DOWN
         */
        KEY_PAGE_DOWN: 34,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_END
         */
        KEY_END: 35,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_HOME
         */
        KEY_HOME: 36,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_LEFT
         */
        KEY_LEFT: 37,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_UP
         */
        KEY_UP: 38,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_RIGHT
         */
        KEY_RIGHT: 39,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_DOWN
         */
        KEY_DOWN: 40,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_PRINT_SCREEN
         */
        KEY_PRINT_SCREEN: 44,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_INSERT
         */
        KEY_INSERT: 45,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_DELETE
         */
        KEY_DELETE: 46,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_0
         */
        KEY_0: 48,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_1
         */
        KEY_1: 49,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_2
         */
        KEY_2: 50,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_3
         */
        KEY_3: 51,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_4
         */
        KEY_4: 52,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_5
         */
        KEY_5: 53,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_6
         */
        KEY_6: 54,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_7
         */
        KEY_7: 55,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_8
         */
        KEY_8: 56,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_9
         */
        KEY_9: 57,

        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_SEMICOLON
         */
        KEY_SEMICOLON: 59,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_EQUAL
         */
        KEY_EQUAL: 61,

        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_A
         */
        KEY_A: 65,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_B
         */
        KEY_B: 66,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_C
         */
        KEY_C: 67,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_D
         */
        KEY_D: 68,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_E
         */
        KEY_E: 69,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_F
         */
        KEY_F: 70,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_G
         */
        KEY_G: 71,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_H
         */
        KEY_H: 72,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_I
         */
        KEY_I: 73,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_J
         */
        KEY_J: 74,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_K
         */
        KEY_K: 75,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_L
         */
        KEY_L: 76,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_M
         */
        KEY_M: 77,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_N
         */
        KEY_N: 78,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_O
         */
        KEY_O: 79,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_P
         */
        KEY_P: 80,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_Q
         */
        KEY_Q: 81,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_R
         */
        KEY_R: 82,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_S
         */
        KEY_S: 83,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_T
         */
        KEY_T: 84,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_U
         */
        KEY_U: 85,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_V
         */
        KEY_V: 86,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_W
         */
        KEY_W: 87,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_X
         */
        KEY_X: 88,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_Y
         */
        KEY_Y: 89,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_Z
         */
        KEY_Z: 90,
        
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_WINDOWS
         */
        KEY_WINDOWS: 91,

        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_CONTEXT_MENU
         */
        KEY_CONTEXT_MENU: 93,
        
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_NUMPAD_0
         */
        KEY_NUMPAD_0: 96,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_NUMPAD_1
         */
        KEY_NUMPAD_1: 97,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_NUMPAD_2
         */
        KEY_NUMPAD_2: 98,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_NUMPAD_3
         */
        KEY_NUMPAD_3: 99,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_NUMPAD_4
         */
        KEY_NUMPAD_4: 100,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_NUMPAD_5
         */
        KEY_NUMPAD_5: 101,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_NUMPAD_6
         */
        KEY_NUMPAD_6: 102,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_NUMPAD_7
         */
        KEY_NUMPAD_7: 103,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_NUMPAD_8
         */
        KEY_NUMPAD_8: 104,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_NUMPAD_9
         */
        KEY_NUMPAD_9: 105,
        
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_MULTIPLY
         */
        KEY_MULTIPLY: 106,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_ADD
         */
        KEY_ADD: 107,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_SEPARATOR
         */
        KEY_SEPARATOR: 108,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_SUBTRACT
         */
        KEY_SUBTRACT: 109,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_DECIMAL
         */
        KEY_DECIMAL: 110,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_DIVIDE
         */
        KEY_DIVIDE: 111,
        
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_F1
         */
        KEY_F1: 112,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_F2
         */
        KEY_F2: 113,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_F3
         */
        KEY_F3: 114,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_F4
         */
        KEY_F4: 115,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_F5
         */
        KEY_F5: 116,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_F6
         */
        KEY_F6: 117,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_F7
         */
        KEY_F7: 118,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_F8
         */
        KEY_F8: 119,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_F9
         */
        KEY_F9: 120,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_F10
         */
        KEY_F10: 121,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_F11
         */
        KEY_F11: 122,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_F12
         */
        KEY_F12: 123,
        
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_COMMA
         */
        KEY_COMMA: 188,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_PERIOD
         */
        KEY_PERIOD: 190,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_SLASH
         */
        KEY_SLASH: 191,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_OPEN_BRACKET
         */
        KEY_OPEN_BRACKET: 219,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_BACK_SLASH
         */
        KEY_BACK_SLASH: 220,
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_CLOSE_BRACKET
         */
        KEY_CLOSE_BRACKET: 221,
        
        /**
         * @enum pc.input.KEY
         * @name pc.input.KEY_META
         */
        KEY_META: 224
    };
}());
