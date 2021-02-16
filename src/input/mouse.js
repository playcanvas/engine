import { platform } from '../core/platform.js';
import { EventHandler } from '../core/event-handler.js';

import { EVENT_MOUSEDOWN, EVENT_MOUSEMOVE, EVENT_MOUSEUP, EVENT_MOUSEWHEEL } from './constants.js';
import { isMousePointerLocked, MouseEvent } from './mouse-event.js';

// Events Documentation
/**
 * @event
 * @name Mouse#mousemove
 * @description Fired when the mouse is moved.
 * @param {pc.MouseEvent} event - The MouseEvent object.
 */

/**
 * @event
 * @name Mouse#mousedown
 * @description Fired when a mouse button is pressed.
 * @param {pc.MouseEvent} event - The MouseEvent object.
 */

/**
 * @event
 * @name Mouse#mouseup
 * @description Fired when a mouse button is released.
 * @param {pc.MouseEvent} event - The MouseEvent object.
 */

/**
 * @event
 * @name Mouse#mousewheel
 * @description Fired when a mouse wheel is moved.
 * @param {pc.MouseEvent} event - The MouseEvent object.
 */

/**
 * @class
 * @name Mouse
 * @augments EventHandler
 * @classdesc A Mouse Device, bound to a DOM Element.
 * @description Create a new Mouse device.
 * @param {Element} [element] - The Element that the mouse events are attached to.
 */
class Mouse extends EventHandler {
    constructor(element) {
        super();

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
    }

    /**
     * @static
     * @function
     * @name Mouse.isPointerLocked
     * @description Check if the mouse pointer has been locked, using {@link pc.Mouse#enabledPointerLock}.
     * @returns {boolean} True if locked.
     */
    static isPointerLocked() {
        return isMousePointerLocked();
    }

    /**
     * @function
     * @name Mouse#attach
     * @description Attach mouse events to an Element.
     * @param {Element} element - The DOM element to attach the mouse to.
     */
    attach(element) {
        this._target = element;

        if (this._attached) return;
        this._attached = true;

        var opts = platform.passiveEvents ? { passive: false } : false;
        window.addEventListener("mouseup", this._upHandler, opts);
        window.addEventListener("mousedown", this._downHandler, opts);
        window.addEventListener("mousemove", this._moveHandler, opts);
        window.addEventListener("wheel", this._wheelHandler, opts);
    }

    /**
     * @function
     * @name Mouse#detach
     * @description Remove mouse events from the element that it is attached to.
     */
    detach() {
        if (!this._attached) return;
        this._attached = false;
        this._target = null;

        var opts = platform.passiveEvents ? { passive: false } : false;
        window.removeEventListener("mouseup", this._upHandler, opts);
        window.removeEventListener("mousedown", this._downHandler, opts);
        window.removeEventListener("mousemove", this._moveHandler, opts);
        window.removeEventListener("wheel", this._wheelHandler, opts);
    }

    /**
     * @function
     * @name Mouse#disableContextMenu
     * @description Disable the context menu usually activated with right-click.
     */
    disableContextMenu() {
        if (!this._target) return;
        this._target.addEventListener("contextmenu", this._contextMenuHandler);
    }

    /**
     * @function
     * @name Mouse#enableContextMenu
     * @description Enable the context menu usually activated with right-click. This option is active by default.
     */
    enableContextMenu() {
        if (!this._target) return;
        this._target.removeEventListener("contextmenu", this._contextMenuHandler);
    }

    /**
     * @function
     * @name Mouse#enablePointerLock
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
    enablePointerLock(success, error) {
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
    }

    /**
     * @function
     * @name Mouse#disablePointerLock
     * @description Return control of the mouse cursor to the user.
     * @param {pc.callbacks.LockMouse} [success] - Function called when the mouse lock is disabled.
     */
    disablePointerLock(success) {
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
    }

    /**
     * @function
     * @name Mouse#update
     * @description Update method, should be called once per frame.
     */
    update() {
        // Copy current button state
        this._lastbuttons[0] = this._buttons[0];
        this._lastbuttons[1] = this._buttons[1];
        this._lastbuttons[2] = this._buttons[2];
    }

    /**
     * @function
     * @name Mouse#isPressed
     * @description Returns true if the mouse button is currently pressed.
     * @param {number} button - The mouse button to test. Can be:
     *
     * * {@link pc.MOUSEBUTTON_LEFT}
     * * {@link pc.MOUSEBUTTON_MIDDLE}
     * * {@link pc.MOUSEBUTTON_RIGHT}
     *
     * @returns {boolean} True if the mouse button is current pressed.
     */
    isPressed(button) {
        return this._buttons[button];
    }

    /**
     * @function
     * @name Mouse#wasPressed
     * @description Returns true if the mouse button was pressed this frame (since the last call to update).
     * @param {number} button - The mouse button to test. Can be:
     *
     * * {@link pc.MOUSEBUTTON_LEFT}
     * * {@link pc.MOUSEBUTTON_MIDDLE}
     * * {@link pc.MOUSEBUTTON_RIGHT}
     *
     * @returns {boolean} True if the mouse button was pressed since the last update.
     */
    wasPressed(button) {
        return (this._buttons[button] && !this._lastbuttons[button]);
    }

    /**
     * @function
     * @name Mouse#wasReleased
     * @description Returns true if the mouse button was released this frame (since the last call to update).
     * @param {number} button - The mouse button to test. Can be:
     *
     * * {@link pc.MOUSEBUTTON_LEFT}
     * * {@link pc.MOUSEBUTTON_MIDDLE}
     * * {@link pc.MOUSEBUTTON_RIGHT}
     *
     * @returns {boolean} True if the mouse button was released since the last update.
     */
    wasReleased(button) {
        return (!this._buttons[button] && this._lastbuttons[button]);
    }

    _handleUp(event) {
        // disable released button
        this._buttons[event.button] = false;

        var e = new MouseEvent(this, event);
        if (!e.event) return;

        // send 'mouseup' event
        this.fire(EVENT_MOUSEUP, e);
    }

    _handleDown(event) {
        // Store which button has affected
        this._buttons[event.button] = true;

        var e = new MouseEvent(this, event);
        if (!e.event) return;

        this.fire(EVENT_MOUSEDOWN, e);
    }

    _handleMove(event) {
        var e = new MouseEvent(this, event);
        if (!e.event) return;

        this.fire(EVENT_MOUSEMOVE, e);

        // Store the last offset position to calculate deltas
        this._lastX = e.x;
        this._lastY = e.y;
    }

    _handleWheel(event) {
        var e = new MouseEvent(this, event);
        if (!e.event) return;

        this.fire(EVENT_MOUSEWHEEL, e);
    }

    _getTargetCoords(event) {
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
}

export { Mouse };
