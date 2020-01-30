Object.assign(pc, function () {
    /**
     * @class
     * @name pc.MouseEvent
     * @classdesc MouseEvent object that is passed to events 'mousemove', 'mouseup', 'mousedown' and 'mousewheel'.
     * @description Create an new MouseEvent.
     * @param {pc.Mouse} mouse - The Mouse device that is firing this event.
     * @param {MouseEvent} event - The original browser event that fired.
     * @property {number} x The x co-ordinate of the mouse pointer relative to the element pc.Mouse is attached to.
     * @property {number} y The y co-ordinate of the mouse pointer relative to the element pc.Mouse is attached to.
     * @property {number} dx The change in x co-ordinate since the last mouse event.
     * @property {number} dy The change in y co-ordinate since the last mouse event.
     * @property {number} button The mouse button associated with this event. Can be:
     *
     * * {@link pc.MOUSEBUTTON_LEFT}
     * * {@link pc.MOUSEBUTTON_MIDDLE}
     * * {@link pc.MOUSEBUTTON_RIGHT}
     *
     * @property {number} wheelDelta A value representing the amount the mouse wheel has moved, only
     * valid for {@link mousewheel} events.
     * @property {Element} element The element that the mouse was fired from.
     * @property {boolean} ctrlKey True if the ctrl key was pressed when this event was fired.
     * @property {boolean} shiftKey True if the shift key was pressed when this event was fired.
     * @property {boolean} altKey True if the alt key was pressed when this event was fired.
     * @property {boolean} metaKey True if the meta key was pressed when this event was fired.
     * @property {MouseEvent} event The original browser event.
     */
    var MouseEvent = function (mouse, event) {
        var coords = {
            x: 0,
            y: 0
        };

        if (event) {
            if (event instanceof MouseEvent) {
                throw Error("Expected MouseEvent");
            }
            coords = mouse._getTargetCoords(event);
        } else {
            event = { };
        }

        if (coords) {
            this.x = coords.x;
            this.y = coords.y;
        } else if (pc.Mouse.isPointerLocked()) {
            this.x = 0;
            this.y = 0;
        } else {
            return;
        }

        // deltaY is in a different range across different browsers. The only thing
        // that is consistent is the sign of the value so snap to -1/+1.
        this.wheelDelta =  0;
        if (event.type === 'wheel') {
            if (event.deltaY > 0) {
                this.wheelDelta = 1;
            } else if (event.deltaY < 0) {
                this.wheelDelta = -1;
            }
        }

        // Backwards compatibility
        this.wheel =  0;
        if (event.type === 'wheel') {
            // FF uses 'detail' and returns a value in 'no. of lines' to scroll
            // WebKit and Opera use 'wheelDelta', WebKit goes in multiples of 120 per wheel notch
            if (event.detail) {
                this.wheel = -1 * event.detail;
            } else if (event.wheelDelta) {
                this.wheel = event.wheelDelta / 120;
            }
        }

        // Get the movement delta in this event
        if (pc.Mouse.isPointerLocked()) {
            this.dx = event.movementX || event.webkitMovementX || event.mozMovementX || 0;
            this.dy = event.movementY || event.webkitMovementY || event.mozMovementY || 0;
        } else {
            this.dx = this.x - mouse._lastX;
            this.dy = this.y - mouse._lastY;
        }

        if (event.type === 'mousedown' || event.type === 'mouseup') {
            this.button = event.button;
        } else {
            this.button = pc.MOUSEBUTTON_NONE;
        }
        this.buttons = mouse._buttons.slice(0);
        this.element = event.target;

        this.ctrlKey = event.ctrlKey || false;
        this.altKey = event.altKey || false;
        this.shiftKey = event.shiftKey || false;
        this.metaKey = event.metaKey || false;

        this.event = event;
    };

    // Events Documentation
    /**
     * @event
     * @name pc.Mouse#mousemove
     * @description Fired when the mouse is moved.
     * @param {pc.MouseEvent} event - The MouseEvent object.
     */

    /**
     * @event
     * @name pc.Mouse#mousedown
     * @description Fired when a mouse button is pressed.
     * @param {pc.MouseEvent} event - The MouseEvent object.
     */

    /**
     * @event
     * @name pc.Mouse#mouseup
     * @description Fired when a mouse button is released.
     * @param {pc.MouseEvent} event - The MouseEvent object.
     */

    /**
     * @event
     * @name pc.Mouse#mousewheel
     * @description Fired when a mouse wheel is moved.
     * @param {pc.MouseEvent} event - The MouseEvent object.
     */

    /**
     * @class
     * @name pc.Mouse
     * @augments pc.EventHandler
     * @classdesc A Mouse Device, bound to a DOM Element.
     * @description Create a new Mouse device.
     * @param {Element} [element] - The Element that the mouse events are attached to.
     */
    var Mouse = function (element) {
        pc.EventHandler.call(this);

        // Clear the mouse state
        this._lastX      = 0;
        this._lastY      = 0;
        this._buttons      = [false, false, false];
        this._lastbuttons  = [false, false, false];


        // Setup event handlers so they are bound to the correct 'this'
        this._upHandler = this._handleUp.bind(this);
        this._downHandler = this._handleDown.bind(this);
        this._moveHandler = this._handleMove.bind(this);
        this._wheelHandler = this._handleWheel.bind(this);
        this._contextMenuHandler = function (event) {
            event.preventDefault();
        };

        this._target = null;
        this._attached = false;

        this.attach(element);
    };
    Mouse.prototype = Object.create(pc.EventHandler.prototype);
    Mouse.prototype.constructor = Mouse;

    /**
     * @static
     * @function
     * @name pc.Mouse.isPointerLocked
     * @description Check if the mouse pointer has been locked, using {@link pc.Mouse#enabledPointerLock}.
     * @returns {boolean} True if locked.
     */
    Mouse.isPointerLocked = function () {
        return !!(document.pointerLockElement || document.mozPointerLockElement || document.webkitPointerLockElement);
    };

    Object.assign(Mouse.prototype, {
        /**
         * @function
         * @name pc.Mouse#attach
         * @description Attach mouse events to an Element.
         * @param {Element} element - The DOM element to attach the mouse to.
         */
        attach: function (element) {
            this._target = element;

            if (this._attached) return;
            this._attached = true;

            var opts = pc.platform.passiveEvents ? { passive: false } : false;
            window.addEventListener("mouseup", this._upHandler, opts);
            window.addEventListener("mousedown", this._downHandler, opts);
            window.addEventListener("mousemove", this._moveHandler, opts);
            window.addEventListener("wheel", this._wheelHandler, opts);
        },

        /**
         * @function
         * @name pc.Mouse#detach
         * @description Remove mouse events from the element that it is attached to.
         */
        detach: function () {
            if (!this._attached) return;
            this._attached = false;
            this._target = null;

            var opts = pc.platform.passiveEvents ? { passive: false } : false;
            window.removeEventListener("mouseup", this._upHandler, opts);
            window.removeEventListener("mousedown", this._downHandler, opts);
            window.removeEventListener("mousemove", this._moveHandler, opts);
            window.removeEventListener("wheel", this._wheelHandler, opts);
        },

        /**
         * @function
         * @name pc.Mouse#disableContextMenu
         * @description Disable the context menu usually activated with right-click.
         */
        disableContextMenu: function () {
            if (!this._target) return;
            this._target.addEventListener("contextmenu", this._contextMenuHandler);
        },

        /**
         * @function
         * @name pc.Mouse#enableContextMenu
         * @description Enable the context menu usually activated with right-click. This option is active by default.
         */
        enableContextMenu: function () {
            if (!this._target) return;
            this._target.removeEventListener("contextmenu", this._contextMenuHandler);
        },

        /**
         * @function
         * @name pc.Mouse#enablePointerLock
         * @description Request that the browser hides the mouse cursor and locks the mouse to the element.
         * Allowing raw access to mouse movement input without risking the mouse exiting the element.
         * Notes:
         *
         * * In some browsers this will only work when the browser is running in fullscreen mode. See {@link pc.Application#enableFullscreen}
         * * Enabling pointer lock can only be initiated by a user action e.g. in the event handler for a mouse or keyboard input.
         *
         * @param {pc.callbacks.LockMouse} [success] - Function called if the request for mouse lock is successful.
         * @param {pc.callbacks.LockMouse} [error] - Function called if the request for mouse lock is unsuccessful.
         */
        enablePointerLock: function (success, error) {
            if (!document.body.requestPointerLock) {
                if (error)
                    error();

                return;
            }

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

            document.body.requestPointerLock();
        },

        /**
         * @function
         * @name pc.Mouse#disablePointerLock
         * @description Return control of the mouse cursor to the user.
         * @param {pc.callbacks.LockMouse} [success] - Function called when the mouse lock is disabled.
         */
        disablePointerLock: function (success) {
            if (!document.exitPointerLock) {
                return;
            }

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
         * @name pc.Mouse#update
         * @description Update method, should be called once per frame.
         */
        update: function () {
            // Copy current button state
            this._lastbuttons[0] = this._buttons[0];
            this._lastbuttons[1] = this._buttons[1];
            this._lastbuttons[2] = this._buttons[2];
        },

        /**
         * @function
         * @name pc.Mouse#isPressed
         * @description Returns true if the mouse button is currently pressed.
         * @param {number} button - The mouse button to test. Can be:
         *
         * * {@link pc.MOUSEBUTTON_LEFT}
         * * {@link pc.MOUSEBUTTON_MIDDLE}
         * * {@link pc.MOUSEBUTTON_RIGHT}
         *
         * @returns {boolean} True if the mouse button is current pressed.
         */
        isPressed: function (button) {
            return this._buttons[button];
        },

        /**
         * @function
         * @name pc.Mouse#wasPressed
         * @description Returns true if the mouse button was pressed this frame (since the last call to update).
         * @param {number} button - The mouse button to test. Can be:
         *
         * * {@link pc.MOUSEBUTTON_LEFT}
         * * {@link pc.MOUSEBUTTON_MIDDLE}
         * * {@link pc.MOUSEBUTTON_RIGHT}
         *
         * @returns {boolean} True if the mouse button was pressed since the last update.
         */
        wasPressed: function (button) {
            return (this._buttons[button] && !this._lastbuttons[button]);
        },

        /**
         * @function
         * @name pc.Mouse#wasReleased
         * @description Returns true if the mouse button was released this frame (since the last call to update).
         * @param {number} button - The mouse button to test. Can be:
         *
         * * {@link pc.MOUSEBUTTON_LEFT}
         * * {@link pc.MOUSEBUTTON_MIDDLE}
         * * {@link pc.MOUSEBUTTON_RIGHT}
         *
         * @returns {boolean} True if the mouse button was released since the last update.
         */
        wasReleased: function (button) {
            return (!this._buttons[button] && this._lastbuttons[button]);
        },

        _handleUp: function (event) {
            // disable released button
            this._buttons[event.button] = false;

            var e = new MouseEvent(this, event);
            if (!e.event) return;

            // send 'mouseup' event
            this.fire(pc.EVENT_MOUSEUP, e);
        },

        _handleDown: function (event) {
            // Store which button has affected
            this._buttons[event.button] = true;

            var e = new MouseEvent(this, event);
            if (!e.event) return;

            this.fire(pc.EVENT_MOUSEDOWN, e);
        },

        _handleMove: function (event) {
            var e = new MouseEvent(this, event);
            if (!e.event) return;

            this.fire(pc.EVENT_MOUSEMOVE, e);

            // Store the last offset position to calculate deltas
            this._lastX = e.x;
            this._lastY = e.y;
        },

        _handleWheel: function (event) {
            var e = new MouseEvent(this, event);
            if (!e.event) return;

            this.fire(pc.EVENT_MOUSEWHEEL, e);
        },

        _getTargetCoords: function (event) {
            var rect = this._target.getBoundingClientRect();
            var left = Math.floor(rect.left);
            var top = Math.floor(rect.top);

            // mouse is outside of canvas
            if (event.clientX < left ||
                event.clientX >= left + this._target.clientWidth ||
                event.clientY < top ||
                event.clientY >= top + this._target.clientHeight) {

                return null;
            }

            return {
                x: event.clientX - left,
                y: event.clientY - top
            };
        }
    });

    // Public Interface
    return  {
        Mouse: Mouse,
        MouseEvent: MouseEvent
    };
}());
