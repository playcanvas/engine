pc.extend(pc.input, function () {
    
    /**
     * @name pc.input.Controller
     * @class A general input handler which handles both mouse and keyboard input assigned to named actions.
     * This allows you to define input handlers separately to defining keyboard/mouse configurations
     * @example
     * <code>
     * <pre>
     * var c = new pc.input.Controller()
     * c.attach(document);
     * 
     * // Register the "fire" action and assign it to both the Enter key and the Spacebar.
     * c.registerKey("fire", [pc.input.KEY_ENTER, pc.input.KEY_SPACE]);
     * </pre>
     * </code>
     * @constructor Create a new instance of a Controller
     * @param {DOMElement} [element] DOMElement to attach Controller to
     */
    var Controller = function (element) {
        this._keyboard = null;
        this._mouse = null;
        this._element = null;
        
        this._actions = {};
        
        if(element) {
            this.attach(element);
        }
    };
    
    /**
     * @function
     * @name pc.input.Controller#attach
     * @description Attach Controller to a DOMElement, this is required before you can monitor for key/mouse inputs.
     * @param {DOMElement} element The element to attach mouse and keyboard event handler too
     */
    Controller.prototype.attach = function (element) {
        this._element = element;
    }
    
    /**
     * @function
     * @name pc.input.Controller#detach
     * @description Detach Controller from a DOMElement, this should be done before the Controller is destroyed 
     */
    Controller.prototype.detach = function () {
        if(this._keyboard) {
            this._keyboard.detach();
        }
        if(this._mouse) {
            this._mouse.detach();
        }
        this._element = null;
    }
    
    /**
     * @function
     * @name pc.input.Controller#disableContextMenu
     * @description Disable the context menu usually activated with the right mouse button.
     */
    Controller.prototype.disableContextMenu = function () {
        if(!this._mouse) {
            this._enableMouse();
        }
        
        this._mouse.disableContextMenu();
    };
    
    /** 
     * @function
     * @name pc.input.Controller#enableContextMenu
     * @description Enable the context menu usually activated with the right mouse button. This is enabled by default.
     */
    Controller.prototype.enableContextMenu = function () {
        if(!this._mouse) {
            this._enableMouse();
        }
        
        this._mouse.enableContextMenu();
    };
    
    /**
     * @function
     * @name pc.input.Controller#update
     * @description Update the Keyboard and Mouse handlers
     * @param {Object} dt The time since the last frame
     */
    Controller.prototype.update = function (dt) {
        if(this._keyboard) {
            this._keyboard.update(dt);
        }
    };
    
    /**
     * @function
     * @name pc.input.Controller#registerKeys
     * @description Create or update a action which is enabled when the supplied keys are pressed.
     * @param {String} action The name of the action
     * @param {Number} keys A list of keycodes
     */
    Controller.prototype.registerKeys = function (action, keys) {
        if(!this._keyboard) {
            this._enableKeyboard();
        }
        if(this._actions[action]) {
            throw new Error(pc.string.format("Action: {0} already registered", action));
        }
        if(this._actions[action]) {
            this._actions[action].push(keys);
        } else {
            this._actions[action] = keys;
        }
    };
    
    /**
     * @function
     * @name pc.input.Controller#registerMouse
     * @description Create or update an action which is enabled when the supplied mouse button is pressed
     * @param {String} action The name of the action
     * @param {Number} button The mouse button
     */
    Controller.prototype.registerMouse = function (action, button) {
        if(!this._mouse) {
            this._enableMouse();
        }

        // Mouse actions are stored as negative numbers to prevent clashing with keycodes.
        if(this._actions[action]) {
            this._actions[action].push(-button)
        } else {
            this._actions[action] = [-button]
        }
    };
    
    /**
     * @function
     * @name pc.input.Controller#isPressed
     * @description Return true if the current action is enabled
     * @param {String} action The name of the action
     */
    Controller.prototype.isPressed = function (action) {
        if(!this._actions[action]) {
            return false;
        }
        
        var key;
        var index = 0;
        var length = this._actions[action].length;
        
        for(index = 0; index < length; ++index) {
            key = this._actions[action][index];
            if(key > 0) {
                if(this._keyboard && this._keyboard.isPressed(key)) {
                    return true;
                }                
            } else {
                if(this._mouse && this._mouse.isPressed(-key)) {
                    return true;
                }
            }
        }
        return false;
    };

    /**
     * @function
     * @name pc.input.Controller#wasPressed
     * @description Returns true if the action was enabled this since the last update
     * @param {String} action The name of the action
     */
    Controller.prototype.wasPressed = function (action) {
        if(!this._actions[action]) {
            return false;
        }

        var key;
        var index = 0;
        var length = this._actions[action].length;
        
        for(index = 0; index < length; ++index) {
            key = this._actions[action][index];
            if (key > 0) {
                if(this._keyboard && this._keyboard.wasPressed(key)) {
                    return true;
                }                
            } else {
                if(this._mouse && this._mouse.wasPressed(-key)) {
                    return true;
                }
            }
        }
        return false;
    };
    
    Controller.prototype._enableMouse = function () {
        this._mouse = new pc.input.Mouse();
        if(!this._element) {
            throw new Error("Controller must be attached to a DOMElement");
        }
        this._mouse.attach(this._element);        
    };
    
    Controller.prototype._enableKeyboard = function () {
        this._keyboard = new pc.input.Keyboard();
        if(!this._element) {
            throw new Error("Controller must be attached to a DOMElement");
        }
        this._keyboard.attach(this._element);        
    };
    
    return {
        Controller: Controller
    };
}());
