pc.extend(pc.input, function(){
    
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
     * @class Handle input from the Keyboard. Allows you to detect the state of the key presses. 
     * Note, Keyboard object must be attached to a DOMElement before it can detect any key presses. 
     * @constructor Create a new Keyboard object
     * @name pc.input.Keyboard
     * @param {DOMElement} [element] Automatically call attach(element).
     */
    var Keyboard = function(element) {
        this._element = null;
        
        this._keyDownHandler = pc.callback(this, this._handleKeyDown);
        this._keyUpHandler = pc.callback(this, this._handleKeyUp);
        this._keyPressHandler = pc.callback(this, this._handleKeyPress);
        
        pc.extend(this, pc.events);
        
        this._keymap = {};
        this._lastmap = {};
        
        if(element) {
            this.attach(element);
        }
    };
    
    Keyboard.prototype.attach = function (element) {
        this._element = element;
        this._element.addEventListener("keydown", this._keyDownHandler, false);
        this._element.addEventListener("keypress", this._keyPressHandler, false);
        this._element.addEventListener("keyup", this._keyUpHandler, false);        
    }
    
    Keyboard.prototype.detach = function () {
        this._element.removeEventListener("keydown", this._keyDownHandler);
        this._element.removeEventListener("keypress", this._keyPressHandler);
        this._element.removeEventListener("keyup", this._keyUpHandler);
        this._element = null;
    }
    
    /**
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
        hex = keyCode.toString(16);
        length = hex.length;
        for (count = 0; count < (4 - length); count++) {
            hex = '0' + hex;
        }
        
        return 'U+' + hex;
    }
    
    Keyboard.prototype._handleKeyDown = function(event) {
        var code = event.keyCode || event.charCode;
        var id = event.keyIdentifier || this.toKeyIdentifier(code);

        this._keymap[id] = true;
            
        // Patch on the keyIdentifier property in non-webkit browsers
        event.keyIdentifier = event.keyIdentifier || id;
        
        this.fire("keydown", {
            event: event
        });
    };
    
    Keyboard.prototype._handleKeyUp = function(event){
        var code = event.keyCode || event.charCode;
        var id = event.keyIdentifier || this.toKeyIdentifier(code);
        
        delete this._keymap[id];

        // Patch on the keyIdentifier property in non-webkit browsers
        event.keyIdentifier = event.keyIdentifier || id;
        
        this.fire("keyup", {
            event: event
        });
    };
    
    Keyboard.prototype._handleKeyPress = function(event){
        var code = event.keyCode || event.charCode;
        var id = event.keyIdentifier || this.toKeyIdentifier(code);
        
        // Patch on the keyIdentifier property in non-webkit browsers
        event.keyIdentifier = event.keyIdentifier || id;
        
        this.fire("keypress", {
            event: event
        });
    };
    
    /**
     * @function
     * @name pc.input.Keyboard#update
     * @description Called once per frame to update internal state
     * @param {Object} dt
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
     * @param {String | Number} key The character string or key code of the key
     * @return {Boolean} True if the key was pressed, false if not
     */
    Keyboard.prototype.isPressed = function (key) {
        var key = toKeyCode(key);
        var id = this.toKeyIdentifier(key);
        
        return !!(this._keymap[id]);
    };
    
    /**
     * @function
     * @name pc.input.Keyboard#wasPressed
     * @description Returns true if the key was pressed since the last update.
     * @param {String | Number} key The character string or key code of the key 
     * @return {Boolean} true if the key was pressed
     */
    Keyboard.prototype.wasPressed = function (key) {
        var key = toKeyCode(key);
        var id = this.toKeyIdentifier(key);
        
        return (!!(this._keymap[id]) && !!!(this._lastmap[id]));
    };
            
    // Public Interface
    return {
        Keyboard: Keyboard,
        KEY_BACKSPACE: 8,
        KEY_TAB: 9,
        KEY_RETURN: 13,
        KEY_ENTER: 14,
        KEY_SHIFT: 16,
        KEY_CONTROL: 17,
        KEY_ALT: 18,
        KEY_PAUSE: 19,
        KEY_CAPS_LOCK: 20,
        KEY_ESCAPE: 27,
        KEY_SPACE: 32,
        KEY_PAGE_UP: 33,
        KEY_PAGE_DOWN: 34,
        KEY_END: 35,
        KEY_HOME: 36,
        KEY_LEFT: 37,
        KEY_UP: 38,
        KEY_RIGHT: 39,
        KEY_DOWN: 40,
        KEY_PRINT_SCREEN: 44,
        KEY_INSERT: 45,
        KEY_DELETE: 46,
        KEY_0: 48,
        KEY_1: 49,
        KEY_2: 50,
        KEY_3: 51,
        KEY_4: 52,
        KEY_5: 53,
        KEY_6: 54,
        KEY_7: 55,
        KEY_8: 56,
        KEY_9: 57,

        KEY_SEMICOLON: 59,
        KEY_EQUAL: 61,

        KEY_A: 65,
        KEY_B: 66,
        KEY_C: 67,
        KEY_D: 68,
        KEY_E: 69,
        KEY_F: 70,
        KEY_G: 71,
        KEY_H: 72,
        KEY_I: 73,
        KEY_J: 74,
        KEY_K: 75,
        KEY_L: 76,
        KEY_M: 77,
        KEY_N: 78,
        KEY_O: 79,
        KEY_P: 80,
        KEY_Q: 81,
        KEY_R: 82,
        KEY_S: 83,
        KEY_T: 84,
        KEY_U: 85,
        KEY_V: 86,
        KEY_W: 87,
        KEY_X: 88,
        KEY_Y: 89,
        KEY_Z: 90,
        
        KEY_WINDOWS: 91,

        KEY_CONTEXT_MENU: 93,
        
        KEY_NUMPAD_0: 96,
        KEY_NUMPAD_1: 97,
        KEY_NUMPAD_2: 98,
        KEY_NUMPAD_3: 99,
        KEY_NUMPAD_4: 100,
        KEY_NUMPAD_5: 101,
        KEY_NUMPAD_6: 102,
        KEY_NUMPAD_7: 103,
        KEY_NUMPAD_8: 104,
        KEY_NUMPAD_9: 105,
        
        KEY_MULTIPLY: 106,
        KEY_ADD: 107,
        KEY_SEPARATOR: 108,
        KEY_SUBTRACT: 109,
        KEY_DECIMAL: 110,
        KEY_DIVIDE: 111,
        
        KEY_F1: 112,
        KEY_F2: 113,
        KEY_F3: 114,
        KEY_F4: 115,
        KEY_F5: 116,
        KEY_F6: 117,
        KEY_F7: 118,
        KEY_F8: 119,
        KEY_F9: 120,
        KEY_F10: 121,
        KEY_F11: 122,
        KEY_F12: 123,
        
        KEY_COMMA: 188,
        KEY_PERIOD: 190,
        KEY_SLASH: 191,
        KEY_OPEN_BRACKET: 219,
        KEY_BACK_SLASH: 220,
        KEY_CLOSE_BRACKET: 221,
        
        KEY_META: 224
    };
}());
