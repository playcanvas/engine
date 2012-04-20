pc.extend(pc.input, function () {    
      
    
    /**
     * @name pc.input.Mouse
     * @description Create a new Mouse object
     * @class Capture and respond to mouse events.
     * @param {DOMElement} [element] The DOMElement that the mouse events are attached to
     * @param {Boolean} [_new] Use new mouse events (to be removed with old designer)
     */
    var Mouse = function (element, options) {
            options = options || {};

            // Clear the mouse state
            this._positionY    = 0;
            this._positionX    = 0;
            this._offsetX      = 0;
            this._offsetY      = 0;
            this._buttons      = [false,false,false];
            this._lastbuttons  = [];
            

            // Setup event handlers so they are bound to the correct 'this'
            this._upHandler = this._handleUp.bind(this);
            this._downHandler = this._handleDown.bind(this);
            this._moveHandler = this._handleMove.bind(this);
            this._wheelHandler = this._handleWheel.bind(this);
            this._handleFullscreenChange = this._handleFullscreenChange.bind(this);
            this._handlePointerLockLost = this._handlePointerLockLost.bind(this);
            this._contextMenuHandler = function (event) { event.preventDefault(); };                
            
            this._element = null;
            if(element) {
                this.attach(element);
            }
        
            this.allowPointerLock = options.allowPointerLock || false;
            if (!Mouse.getPointer()) {
                this.allowPointerLock = false;
            }

            if (this.allowPointerLock) {
                document.addEventListener('webkitfullscreenchange', this._handleFullscreenChange, false);
                document.addEventListener('webkitpointerlocklost', this._handlePointerLockLost, false);                    
            }

            // Add events
            pc.extend(this, pc.events);
        };
    
    /**
     * @function
     * @name pc.input.Mouse#attach
     * @description Attach mouse events to a DOMElement.
     * @param {Object} element
     */
    Mouse.prototype.attach = function (element) {
        // Store which DOM element the mouse is handling
        this._element = element;
    
        this._element.addEventListener("mouseup", this._upHandler, false);
        this._element.addEventListener("mousedown", this._downHandler, false);
        this._element.addEventListener("mousemove", this._moveHandler, false);
        this._element.addEventListener("mousewheel", this._wheelHandler, false); // WekKit
        this._element.addEventListener("DOMMouseScroll", this._wheelHandler, false); // Gecko        
    };
    
    /**
     * @function
     * @name pc.input.Mouse#detach
     * @description Remove mouse events from the DOMElement
     */
    Mouse.prototype.detach = function () {
        this._element.removeEventListener("mouseup", this._upHandler);
        this._element.removeEventListener("mousedown", this._downHandler);
        this._element.removeEventListener("mousemove", this._moveHandler);
        this._element.removeEventListener("mousewheel", this._wheelHandler); // WekKit
        this._element.removeEventListener("DOMMouseScroll", this._wheelHandler); // Gecko                
        
        this._element = null;
    };
    
    /**
     * @function
     * @name pc.input.Mouse#disableContextMenu
     * @description Disable the context menu usually activated with right-click
     */
    Mouse.prototype.disableContextMenu = function () {
        this._element.addEventListener("contextmenu", this._contextMenuHandler);        
    };
    
    /**
     * @function
     * @name pc.input.Mouse#enableContextMenu
     * @description Enable the context menu usually activated with right-click. This option is active by default.
     */
    Mouse.prototype.enableContextMenu = function () {
        this._element.removeEventListener("contextmenu", this._contextMenuHandler);    
    };
    
    /**
     * @function
     * @name pc.input.Mouse#update
     * @description Update method, should be called once per frame
     * @param {Object} dt
     */
    Mouse.prototype.update = function (dt) {
        // Copy current button state
        this._lastbuttons = this._buttons.slice(0);
    };
    
    /**
     * @function
     * @name pc.input.Mouse#isPressed
     * @description Returns true if the mouse button is currently pressed
     * @param {Object} button
     */
    Mouse.prototype.isPressed = function (button) {
        return this._buttons[button];
    };
    
    /**
     * @function
     * @name pc.input.Mouse#wasPressed
     * @description Returns true if the mouse button was pressed this frame (since the last call to update).
     * @param {Object} button
     */
    Mouse.prototype.wasPressed = function (button) {
        return (this._buttons[button] && !this._lastbuttons[button]);
    };

    Mouse.isPointerLocked = function () {
        var pointer = Mouse.getPointer();
        if (pointer) {
            return pointer.isLocked();    
        } else {
            return false;
        }
        
    };

    /**
    * @function
    * @name pc.input.Mouse#getPointer
    * @description Return the native PointerLock object from the navigator. This method works cross-browser.
    * @returns {PointerLock} The PointerLock object 
    */
    Mouse.getPointer = function () {
        return navigator.pointer || navigator.webkitPointer;
    };

    /**
     * @function
     * @name pc.input.createMouseEvent
     * @description Extend the browser mouse event with some additional cross-browser values.
     * This identical to a DOM MouseEvent with some additional values
     * event.targetX - The X coordinate relative to the event target element
     * event.targetY - The Y coordinate relative to the event target element
     * event.wheel - The change in mouse wheel value (if there is one) Normalized between -1 and 1
     * event.buttons - The current state of all mouse buttons
     * event.movementX/Y - This is added if not present in the current browser and is the movement since the last 
     * @param {pc.input.Mouse} mouse A pc.input.Mouse instance, needed to get the button state from
     * @param {MouseEvent} event The mouse event to extend
     * @returns {MouseEvent} The original event with added/edited parameters
     */
    Mouse.createMouseEvent = function (mouse, event) {
        var offset = pc.input.getTargetCoords(event);
        event.targetX = offset.x;
        event.targetY = offset.y;

        if (event.detail) {
            event.wheel = -1 * pc.math.clamp(event.detail, -1, 1); // detail appears to be unbounded, so we'll just clamp into range.
        } else if (event.wheelDelta) {
            event.wheel = event.wheelDelta / 120; // Convert to -1 to 1
        } else {
            event.wheel = 0;
        }
        
        // Get the movement delta in this event
        if (event.movementX || event.webkitMovementX || event.mozMovementX) {
            event.movementX = event.movementX || event.webkitMovementX || event.mozMovementX || 0;
            event.movementY = event.movementY || event.webkitMovementY || event.mozMovementY || 0;
        } else {
            event.movementX = offset.x - mouse._offsetX;
            event.movementY = offset.y - mouse._offsetY;
        }

        event.buttons = mouse._buttons;
        return event;
    };

    Mouse.prototype._handleUp = function (event) {
        // disable released button
        this._buttons[event.button] = false;

        // send 'mouseup' event
        this.fire(pc.input.EVENT_MOUSE_UP, pc.input.Mouse.createMouseEvent(this, event));
    };
    
    
    Mouse.prototype._handleDown = function (event) {
        // Store which button has affected
        this._buttons[event.button] = true;

        this.fire(pc.input.EVENT_MOUSE_DOWN, pc.input.Mouse.createMouseEvent(this, event));
    };
    
    Mouse.prototype._handleMove = function (event) {
        // Update the current position
        this._positionX = event.clientX;
        this._positionY = event.clientY;
        offset = pc.input.getTargetCoords(event);
        this._offsetX = offset.x;
        this._offsetY = offset.y;
        
        this.fire(pc.input.EVENT_MOUSE_MOVE, pc.input.Mouse.createMouseEvent(this, event));
    };

    Mouse.prototype._handleWheel = function (event) {
        this.fire(pc.input.EVENT_MOUSE_WHEEL, pc.input.Mouse.createMouseEvent(this, event));
    };

    Mouse.prototype._handleFullscreenChange = function (event) {
        if (this.allowPointerLock) {
            if (document.webkitIsFullScreen) {
                Mouse.getPointer().lock(this._element, function () {
                    this.fire('pointerlock');
                }.bind(this), function () {
                    logERROR('pointerlock failed');
                });
            }
        }
    };

    Mouse.prototype._handlePointerLockLost = function (event) {
        this.fire('pointerlocklost');
    };

    // Public Interface
    return  {
        /**
         * @name pc.input.EVENT_MOUSE_UP
         * @description Name of mouse up event
         */
        EVENT_MOUSE_UP: "mouseup",
        EVENT_MOUSE_DOWN: "mousedown",
        EVENT_MOUSE_MOVE: "mousemove",
        EVENT_MOUSE_WHEEL: "mousewheel",
        
        /**
         * @name pc.input.MOUSE_BUTTON_NONE
         * @description Value of pc.input.MouseEvent#button when no mouse button is pressed
         */
        MOUSE_BUTTON_NONE: -1,
        MOUSE_BUTTON_LEFT: 0,
        MOUSE_BUTTON_MIDDLE: 1,
        MOUSE_BUTTON_RIGHT: 2,
        
        Mouse: Mouse,

        /**
         * @private
         * @function
         * @name pc.input.getTargetCoords
         * @description Gets a pair of co-ords relative to the target element of the event.
         * offsetX/Y are not cross-browser compatible so we generate a set of coords here which are the same on all browsers, 
         * and relative to the element that the the mouse was attached to.
         * @param {MouseEvent} event
         * @returns {Object} An object {x, y} which contains the co-ordinations
         */
        getTargetCoords: function getTargetCoords(event) {
            var coords = { x: 0, y: 0};
    
            var element = event.currentTarget;
            var totalOffsetLeft = 0;
            var totalOffsetTop = 0 ;
    
            while (element.offsetParent)
            {
                totalOffsetLeft += element.offsetLeft;
                totalOffsetTop += element.offsetTop;
                element = element.offsetParent;
            }
            coords.x = event.pageX - totalOffsetLeft;
            coords.y = event.pageY - totalOffsetTop;
            
            return coords;
        }
    };
} ());
