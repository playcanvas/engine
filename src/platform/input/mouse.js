import { platform } from '../../core/platform.js';
import { EventHandler } from '../../core/event-handler.js';

import { EVENT_MOUSEDOWN, EVENT_MOUSEMOVE, EVENT_MOUSEUP, EVENT_MOUSEWHEEL } from './constants.js';
import { isMousePointerLocked, MouseEvent } from './mouse-event.js';

/**
 * Callback used by {@link Mouse#enablePointerLock} and {@link Application#disablePointerLock}.
 *
 * @callback LockMouseCallback
 */

/**
 * A Mouse Device, bound to a DOM Element.
 *
 * @augments EventHandler
 * @category Input
 */
class Mouse extends EventHandler {
    /**
     * Fired when the mouse is moved. The handler is passed a {@link MouseEvent}.
     *
     * @event
     * @example
     * app.mouse.on('mousemove', (e) => {
     *     console.log(`Current mouse position is: ${e.x}, ${e.y}`);
     * });
     */
    static EVENT_MOUSEMOVE = EVENT_MOUSEMOVE;

    /**
     * Fired when a mouse button is pressed. The handler is passed a {@link MouseEvent}.
     *
     * @event
     * @example
     * app.mouse.on('mousedown', (e) => {
     *     console.log(`The ${e.button} button was pressed at position: ${e.x}, ${e.y}`);
     * });
     */
    static EVENT_MOUSEDOWN = EVENT_MOUSEDOWN;

    /**
     * Fired when a mouse button is released. The handler is passed a {@link MouseEvent}.
     *
     * @event
     * @example
     * app.mouse.on('mouseup', (e) => {
     *     console.log(`The ${e.button} button was released at position: ${e.x}, ${e.y}`);
     * });
     */
    static EVENT_MOUSEUP = EVENT_MOUSEUP;

    /**
     * Fired when a mouse wheel is moved. The handler is passed a {@link MouseEvent}.
     *
     * @event
     * @example
     * app.mouse.on('mousewheel', (e) => {
     *     console.log(`The mouse wheel was moved by ${e.wheelDelta}`);
     * });
     */
    static EVENT_MOUSEWHEEL = EVENT_MOUSEWHEEL;

    /**
     * Create a new Mouse instance.
     *
     * @param {Element} [element] - The Element that the mouse events are attached to.
     */
    constructor(element) {
        super();

        // Clear the mouse state
        this._lastX = 0;
        this._lastY = 0;
        this._buttons = [false, false, false];
        this._lastbuttons = [false, false, false];


        // Setup event handlers so they are bound to the correct 'this'
        this._upHandler = this._handleUp.bind(this);
        this._downHandler = this._handleDown.bind(this);
        this._moveHandler = this._handleMove.bind(this);
        this._wheelHandler = this._handleWheel.bind(this);
        this._contextMenuHandler = (event) => {
            event.preventDefault();
        };

        this._target = null;
        this._attached = false;

        this.attach(element);
    }

    /**
     * Check if the mouse pointer has been locked, using {@link Mouse#enablePointerLock}.
     *
     * @returns {boolean} True if locked.
     */
    static isPointerLocked() {
        return isMousePointerLocked();
    }

    /**
     * Attach mouse events to an Element.
     *
     * @param {Element} element - The DOM element to attach the mouse to.
     */
    attach(element) {
        this._target = element;

        if (this._attached) return;
        this._attached = true;

        const opts = platform.passiveEvents ? { passive: false } : false;
        window.addEventListener('mouseup', this._upHandler, opts);
        window.addEventListener('mousedown', this._downHandler, opts);
        window.addEventListener('mousemove', this._moveHandler, opts);
        window.addEventListener('wheel', this._wheelHandler, opts);
    }

    /**
     * Remove mouse events from the element that it is attached to.
     */
    detach() {
        if (!this._attached) return;
        this._attached = false;
        this._target = null;

        const opts = platform.passiveEvents ? { passive: false } : false;
        window.removeEventListener('mouseup', this._upHandler, opts);
        window.removeEventListener('mousedown', this._downHandler, opts);
        window.removeEventListener('mousemove', this._moveHandler, opts);
        window.removeEventListener('wheel', this._wheelHandler, opts);
    }

    /**
     * Disable the context menu usually activated with right-click.
     */
    disableContextMenu() {
        if (!this._target) return;
        this._target.addEventListener('contextmenu', this._contextMenuHandler);
    }

    /**
     * Enable the context menu usually activated with right-click. This option is active by
     * default.
     */
    enableContextMenu() {
        if (!this._target) return;
        this._target.removeEventListener('contextmenu', this._contextMenuHandler);
    }

    /**
     * Request that the browser hides the mouse cursor and locks the mouse to the element. Allowing
     * raw access to mouse movement input without risking the mouse exiting the element. Notes:
     *
     * - In some browsers this will only work when the browser is running in fullscreen mode. See
     * {@link https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API Fullscreen API} for
     * more details.
     * - Enabling pointer lock can only be initiated by a user action e.g. in the event handler for
     * a mouse or keyboard input.
     *
     * @param {LockMouseCallback} [success] - Function called if the request for mouse lock is
     * successful.
     * @param {LockMouseCallback} [error] - Function called if the request for mouse lock is
     * unsuccessful.
     */
    enablePointerLock(success, error) {
        if (!document.body.requestPointerLock) {
            if (error)
                error();

            return;
        }

        const s = () => {
            success();
            document.removeEventListener('pointerlockchange', s);
        };
        const e = () => {
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
     * Return control of the mouse cursor to the user.
     *
     * @param {LockMouseCallback} [success] - Function called when the mouse lock is disabled.
     */
    disablePointerLock(success) {
        if (!document.exitPointerLock) {
            return;
        }

        const s = () => {
            success();
            document.removeEventListener('pointerlockchange', s);
        };
        if (success) {
            document.addEventListener('pointerlockchange', s, false);
        }
        document.exitPointerLock();
    }

    /**
     * Update method, should be called once per frame.
     */
    update() {
        // Copy current button state
        this._lastbuttons[0] = this._buttons[0];
        this._lastbuttons[1] = this._buttons[1];
        this._lastbuttons[2] = this._buttons[2];
    }

    /**
     * Returns true if the mouse button is currently pressed.
     *
     * @param {number} button - The mouse button to test. Can be:
     *
     * - {@link MOUSEBUTTON_LEFT}
     * - {@link MOUSEBUTTON_MIDDLE}
     * - {@link MOUSEBUTTON_RIGHT}
     *
     * @returns {boolean} True if the mouse button is current pressed.
     */
    isPressed(button) {
        return this._buttons[button];
    }

    /**
     * Returns true if the mouse button was pressed this frame (since the last call to update).
     *
     * @param {number} button - The mouse button to test. Can be:
     *
     * - {@link MOUSEBUTTON_LEFT}
     * - {@link MOUSEBUTTON_MIDDLE}
     * - {@link MOUSEBUTTON_RIGHT}
     *
     * @returns {boolean} True if the mouse button was pressed since the last update.
     */
    wasPressed(button) {
        return (this._buttons[button] && !this._lastbuttons[button]);
    }

    /**
     * Returns true if the mouse button was released this frame (since the last call to update).
     *
     * @param {number} button - The mouse button to test. Can be:
     *
     * - {@link MOUSEBUTTON_LEFT}
     * - {@link MOUSEBUTTON_MIDDLE}
     * - {@link MOUSEBUTTON_RIGHT}
     *
     * @returns {boolean} True if the mouse button was released since the last update.
     */
    wasReleased(button) {
        return (!this._buttons[button] && this._lastbuttons[button]);
    }

    _handleUp(event) {
        // disable released button
        this._buttons[event.button] = false;

        const e = new MouseEvent(this, event);
        if (!e.event) return;

        // send 'mouseup' event
        this.fire(EVENT_MOUSEUP, e);
    }

    _handleDown(event) {
        // Store which button has affected
        this._buttons[event.button] = true;

        const e = new MouseEvent(this, event);
        if (!e.event) return;

        this.fire(EVENT_MOUSEDOWN, e);
    }

    _handleMove(event) {
        const e = new MouseEvent(this, event);
        if (!e.event) return;

        this.fire(EVENT_MOUSEMOVE, e);

        // Store the last offset position to calculate deltas
        this._lastX = e.x;
        this._lastY = e.y;
    }

    _handleWheel(event) {
        const e = new MouseEvent(this, event);
        if (!e.event) return;

        this.fire(EVENT_MOUSEWHEEL, e);
    }

    _getTargetCoords(event) {
        const rect = this._target.getBoundingClientRect();
        const left = Math.floor(rect.left);
        const top = Math.floor(rect.top);

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
