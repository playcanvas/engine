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
        this._contextMenuHandler = function (event) { event.preventDefault(); };                
        
        this._element = null;
        if(element) {
            this.attach(element);
        }
    
        // Add events
        pc.extend(this, pc.events);
    };

    /**
    * @function 
    * @name pc.input.Mouse.isPointerLocked
    * @description Return True if the pointer is currently locked
    * @returns {Boolean} True if locked
    */
    Mouse.isPointerLocked =  function () {
        return !!document.pointerLockElement;
    };

    /**
     * @function
     * @name pc.input.Mouse.createMouseEvent
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
        if (pc.input.Mouse.isPointerLocked()) {
            event.movementX = event.movementX || event.webkitMovementX || event.mozMovementX || 0;
            event.movementY = event.movementY || event.webkitMovementY || event.mozMovementY || 0;
        } else {
            event.movementX = offset.x - mouse._offsetX;
            event.movementY = offset.y - mouse._offsetY;
        }

        event.buttons = mouse._buttons;
        return event;
    };

    Mouse.prototype = {
        /**
         * @function
         * @name pc.input.Mouse#attach
         * @description Attach mouse events to a DOMElement.
         * @param {Object} element
         */
        attach: function (element) {
            if (this._element) {
                // remove previously attached element
                this.detach();
            }
            // Store which DOM element the mouse is handling
            this._element = element;
        
            this._element.addEventListener("mouseup", this._upHandler, false);
            this._element.addEventListener("mousedown", this._downHandler, false);
            this._element.addEventListener("mousemove", this._moveHandler, false);
            this._element.addEventListener("mousewheel", this._wheelHandler, false); // WekKit
            this._element.addEventListener("DOMMouseScroll", this._wheelHandler, false); // Gecko        
        },
        
        /**
         * @function
         * @name pc.input.Mouse#detach
         * @description Remove mouse events from the DOMElement
         */
        detach: function () {
            this._element.removeEventListener("mouseup", this._upHandler);
            this._element.removeEventListener("mousedown", this._downHandler);
            this._element.removeEventListener("mousemove", this._moveHandler);
            this._element.removeEventListener("mousewheel", this._wheelHandler); // WekKit
            this._element.removeEventListener("DOMMouseScroll", this._wheelHandler); // Gecko                
            
            this._element = null;
        },
        
        /**
         * @function
         * @name pc.input.Mouse#disableContextMenu
         * @description Disable the context menu usually activated with right-click
         */
        disableContextMenu: function () {
            this._element.addEventListener("contextmenu", this._contextMenuHandler);        
        },
        
        /**
         * @function
         * @name pc.input.Mouse#enableContextMenu
         * @description Enable the context menu usually activated with right-click. This option is active by default.
         */
        enableContextMenu: function () {
            this._element.removeEventListener("contextmenu", this._contextMenuHandler);    
        },
        
        /**
        * @function 
        * @name pc.input.Mouse#enablePointerLock(success, error)
        * @description Request that the browser hides the mouse cursor and locks the mouse to the element. 
        * Allowing raw access to mouse input without risking the mouse exiting the element.
        * Notes: 
        * - In some browsers this will only work when the browser is running in fullscreen mode. See `pc.fw.Application#enableFullscreen`
        * - Enabling pointer lock can only be initiated by a user action e.g. in the event handler for a mouse or keyboard input.
        * @param {Function} [success] Function called if the request for mouse lock is successful.
        * @param {Function} [error] Function called if the request for mouse lock is unsuccessful.
        */
        enablePointerLock: function (success, error) {
            var s = function () {
                success();
                document.removeEventListener('pointerlockchange', s);
            };
            var e = function () {
                error();
                document.removeEventListener('pointerlockerror', e);
            };

            if (success) {
                document.addEventListener('pointerlockchange', s, false);
            }
            
            if (error) {
                document.addEventListener('pointerlockerror', e, false);
            }

            this._element.requestPointerLock();
        },

        /**
        * @function
        * @name pc.input.Mouse#disablePointerLock()
        * @description Return control of the mouse cursor to the user
        * @param {Function} [success] Function called when the mouse lock is disabled
        */
        disablePointerLock: function (success) {
            var s = function () {
                success();
                document.removeEventListener('pointerlockchange', s);
            };
            if (success) {
                document.addEventListener('pointerlockchange', s, false);
            }
            document.exitPointerLock();
        },

        /**
         * @function
         * @name pc.input.Mouse#update
         * @description Update method, should be called once per frame
         * @param {Object} dt
         */
        update: function (dt) {
            // Copy current button state
            this._lastbuttons = this._buttons.slice(0);
        },
        
        /**
         * @function
         * @name pc.input.Mouse#isPressed
         * @description Returns true if the mouse button is currently pressed
         * @param {Object} button
         */
        isPressed: function (button) {
            return this._buttons[button];
        },
        
        /**
         * @function
         * @name pc.input.Mouse#wasPressed
         * @description Returns true if the mouse button was pressed this frame (since the last call to update).
         * @param {Object} button
         */
        wasPressed: function (button) {
            return (this._buttons[button] && !this._lastbuttons[button]);
        },

        _handleUp: function (event) {
            // disable released button
            this._buttons[event.button] = false;

            // send 'mouseup' event
            this.fire(pc.input.EVENT_MOUSE_UP, pc.input.Mouse.createMouseEvent(this, event));
        },
        
        
        _handleDown: function (event) {
            // Store which button has affected
            this._buttons[event.button] = true;

            this.fire(pc.input.EVENT_MOUSE_DOWN, pc.input.Mouse.createMouseEvent(this, event));
        },
        
        _handleMove: function (event) {
            // Update the current position
            this._positionX = event.clientX;
            this._positionY = event.clientY;
            
            this.fire(pc.input.EVENT_MOUSE_MOVE, pc.input.Mouse.createMouseEvent(this, event));

            // Store the last offset position to calculate deltas
            offset = pc.input.getTargetCoords(event);
            this._offsetX = offset.x;
            this._offsetY = offset.y;
        },

        _handleWheel: function (event) {
            this.fire(pc.input.EVENT_MOUSE_WHEEL, pc.input.Mouse.createMouseEvent(this, event));
        },
    };

    // Apply PointerLock shims
    (function () {
        // Old API
        if (typeof navigator === 'undefined' || typeof document === 'undefined') {
            // Not running in a browser
            return;
        }

        navigator.pointer = navigator.pointer || navigator.webkitPointer || navigator.mozPointer;    

        // Events
        var pointerlockchange = function () {
            var e = document.createEvent('CustomEvent');
            e.initCustomEvent('pointerlockchange', true, false, null);
            document.dispatchEvent(e);
        };

        var pointerlockerror = function () {
            var e = document.createEvent('CustomEvent');
            e.initCustomEvent('pointerlockerror', true, false, null);
            document.dispatchEvent(e);
        }

        document.addEventListener('webkitpointerlockchange', pointerlockchange, false);
        document.addEventListener('webkitpointerlocklost', pointerlockchange, false);
        document.addEventListener('mozpointerlockchange', pointerlockchange, false);
        document.addEventListener('mozpointerlocklost', pointerlockchange, false);

        document.addEventListener('webkitpointerlockerror', pointerlockerror, false);
        document.addEventListener('mozpointerlockerror', pointerlockerror, false);

        // PointerLockElement
        if (!document.pointerLockElement) {
            Object.defineProperty(document, 'pointerLockElement', {
                enumerable: true, 
                configurable: false, 
                get: function () {
                    return document.webkitPointerLockElement || document.mozPointerLockElement;
                }
            })
        }

        // requestPointerLock
        if (Element.prototype.mozRequestPointerLock) {
            // FF requires a new function for some reason
            Element.prototype.requestPointerLock = function () {
                this.mozRequestPointerLock();
            };
        } else {
            Element.prototype.requestPointerLock = Element.prototype.requestPointerLock || Element.prototype.webkitRequestPointerLock || Element.prototype.mozRequestPointerLock;
        }

        if (!Element.prototype.requestPointerLock && navigator.pointer) {
            Element.prototype.requestPointerLock = function () {
                var el = this;
                document.pointerLockElement = el;
                navigator.pointer.lock(el, pointerlockchange, pointerlockerror);
            };
        }

        // exitPointerLock
        document.exitPointerLock = document.exitPointerLock || document.webkitExitPointerLock || document.mozExitPointerLock;
        if (!document.exitPointerLock) {
            document.exitPointerLock = function () {
                if (navigator.pointer) {
                    document.pointerLockElement = null;
                    navigator.pointer.unlock();
                }
            }
        }
    })();


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
