import { EventHandler } from '../../core/event-handler.js';

import { isMousePointerLocked, MouseEvent } from './mouse-event.js';

// `PointerEvent#buttons` bits indexed by MOUSEBUTTON_LEFT, MOUSEBUTTON_MIDDLE and MOUSEBUTTON_RIGHT
const BUTTON_BITS = [1, 4, 2];

/**
 * @callback LockMouseCallback
 * Callback used by {@link Mouse#enablePointerLock} and {@link Mouse#disablePointerLock}.
 * @returns {void}
 */

/**
 * Manages mouse input by tracking button states and dispatching events. Extends {@link EventHandler}
 * to fire `mousedown`, `mouseup`, `mousemove` and `mousewheel` events (see {@link MouseEvent}).
 *
 * Allows the state of mouse buttons to be queried to check if they are currently pressed or were
 * pressed/released since the last update. Provides methods to enable/disable pointer lock for
 * raw mouse movement input and control over the context menu. The class automatically clears
 * button states when the window loses focus or the document becomes hidden, without firing
 * `mouseup` events. The Mouse instance must be attached to a DOM element before it can detect
 * mouse events.
 *
 * The first unlocked mouse movement after creation, detachment or focus loss establishes a new
 * position and reports zero movement delta. Movement outside the target also invalidates the
 * position, so re-entry reports zero delta. Pointer-locked movement uses the browser's relative
 * movement deltas.
 *
 * Movement and wheel deltas are also summed per tick in {@link Mouse#movement} and
 * {@link Mouse#wheel} and cleared by {@link Mouse#update}.
 *
 * By default, mouse events are listened for on the window. Pass `pointer: true` to instead listen
 * for pointer events on the element only, capturing the pointer while a button is held (unless
 * the pointer is locked) and preventing default on wheel and context menu events. In this mode
 * touch and pen input is ignored, and buttons pressed or released while another is held fire
 * `mousedown` and `mouseup` too.
 *
 * Your application's Mouse instance is managed and accessible via {@link AppBase#mouse}.
 *
 * For touch input, see {@link Gestures}. To turn mouse movement into camera or character
 * movement, see {@link InputController}s such as {@link OrbitController}, {@link FlyController},
 * {@link FocusController} and {@link CharacterController}, which map it into an
 * {@link InputFrame}.
 *
 * @category Input Devices
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
    static EVENT_MOUSEMOVE = 'mousemove';

    /**
     * Fired when a mouse button is pressed. The handler is passed a {@link MouseEvent}.
     *
     * @event
     * @example
     * app.mouse.on('mousedown', (e) => {
     *     console.log(`The ${e.button} button was pressed at position: ${e.x}, ${e.y}`);
     * });
     */
    static EVENT_MOUSEDOWN = 'mousedown';

    /**
     * Fired when a mouse button is released. The handler is passed a {@link MouseEvent}.
     *
     * @event
     * @example
     * app.mouse.on('mouseup', (e) => {
     *     console.log(`The ${e.button} button was released at position: ${e.x}, ${e.y}`);
     * });
     */
    static EVENT_MOUSEUP = 'mouseup';

    /**
     * Fired when a mouse wheel is moved. The handler is passed a {@link MouseEvent}.
     *
     * @event
     * @example
     * app.mouse.on('mousewheel', (e) => {
     *     console.log(`The mouse wheel was moved by ${e.wheelDelta}`);
     * });
     */
    static EVENT_MOUSEWHEEL = 'mousewheel';

    /**
     * The mouse movement `[dx, dy]` summed since the last call to {@link Mouse#update}.
     *
     * @type {number[]}
     */
    movement = [0, 0];

    /**
     * The raw wheel `deltaY` summed since the last call to {@link Mouse#update}.
     *
     * @type {number}
     */
    wheel = 0;

    /** @private */
    _pointer;

    /** @private */
    _captureId = -1;

    /**
     * @type {Element|null}
     * @private
     */
    _bound = null;

    /** @private */
    _lastX = 0;

    /** @private */
    _lastY = 0;

    /** @private */
    _lastPositionValid = false;

    /** @private */
    _buttons = [false, false, false];

    /** @private */
    _lastbuttons = [false, false, false];

    /** @private */
    _target = null;

    /** @private */
    _attached = false;

    /**
     * @type {(event: globalThis.MouseEvent) => void}
     * @private
     */
    _upHandler;

    /**
     * @type {(event: globalThis.MouseEvent) => void}
     * @private
     */
    _downHandler;

    /**
     * @type {(event: globalThis.MouseEvent) => void}
     * @private
     */
    _moveHandler;

    /**
     * @type {(event: globalThis.WheelEvent) => void}
     * @private
     */
    _wheelHandler;

    /**
     * @type {(event: Event) => void}
     * @private
     */
    _contextMenuHandler;

    /**
     * @type {(event: globalThis.PointerEvent) => void}
     * @private
     */
    _lostHandler;

    /**
     * Always on in pointer mode, unlike the toggleable {@link Mouse#disableContextMenu}.
     *
     * @type {(event: Event) => void}
     * @private
     */
    _pointerContextHandler = event => event.preventDefault();

    /**
     * @type {() => void}
     * @private
     */
    _visibilityChangeHandler;

    /**
     * @type {() => void}
     * @private
     */
    _windowBlurHandler;

    /**
     * Create a new Mouse instance.
     *
     * @param {Element} [element] - The Element that the mouse events are attached to.
     * @param {object} [options] - Optional settings.
     * @param {boolean} [options.pointer] - Listen for pointer events on the element instead of
     * mouse events on the window. Defaults to false.
     */
    constructor(element, { pointer = false } = {}) {
        super();

        this._pointer = pointer;

        // Setup event handlers so they are bound to the correct 'this'
        this._upHandler = this._handleUp.bind(this);
        this._downHandler = this._handleDown.bind(this);
        this._moveHandler = this._handleMove.bind(this);
        this._wheelHandler = this._handleWheel.bind(this);
        this._visibilityChangeHandler = this._handleVisibilityChange.bind(this);
        this._windowBlurHandler = this._handleWindowBlur.bind(this);
        this._contextMenuHandler = (event) => {
            event.preventDefault();
        };

        if (pointer) {
            this._downHandler = this._handlePointerDown.bind(this);
            this._moveHandler = this._handlePointerMove.bind(this);
            this._upHandler = this._handlePointerUp.bind(this);
            this._wheelHandler = this._handlePointerWheel.bind(this);
            this._lostHandler = this._handlePointerLost.bind(this);
        }

        this.attach(element);
    }

    /**
     * Check if the mouse pointer has been locked, using {@link enablePointerLock}.
     *
     * @returns {boolean} True if locked.
     */
    static isPointerLocked() {
        return isMousePointerLocked();
    }

    /**
     * Attach mouse events to an Element. If already attached, this changes the target element
     * while preserving current and previous button states, unlike {@link Keyboard#attach}. In
     * pointer mode, changing the element instead clears button states without firing `mouseup`.
     *
     * @param {Element} element - The DOM element to attach the mouse to.
     */
    attach(element) {
        this._target = element;

        if (this._pointer) this._bindElement(element);

        if (this._attached) return;
        this._attached = true;

        if (!this._pointer) {
            /** @type {AddEventListenerOptions} */
            const options = { passive: false };
            window.addEventListener('mouseup', this._upHandler, options);
            window.addEventListener('mousedown', this._downHandler, options);
            window.addEventListener('mousemove', this._moveHandler, options);
            window.addEventListener('wheel', this._wheelHandler, options);
        }
        document.addEventListener('visibilitychange', this._visibilityChangeHandler, false);
        window.addEventListener('blur', this._windowBlurHandler, false);
    }

    /**
     * Remove mouse events from the element that it is attached to and clear current and previous
     * button states. The previous mouse position is also invalidated so the next unlocked movement
     * reports zero delta. This does not fire `mouseup` events.
     */
    detach() {
        if (!this._attached) return;
        this._attached = false;
        this._target = null;

        if (this._pointer) {
            this._bindElement(null);
        } else {
            /** @type {AddEventListenerOptions} */
            const options = { passive: false };
            window.removeEventListener('mouseup', this._upHandler, options);
            window.removeEventListener('mousedown', this._downHandler, options);
            window.removeEventListener('mousemove', this._moveHandler, options);
            window.removeEventListener('wheel', this._wheelHandler, options);
        }
        document.removeEventListener('visibilitychange', this._visibilityChangeHandler, false);
        window.removeEventListener('blur', this._windowBlurHandler, false);

        this._handleWindowBlur();
    }

    /**
     * True if this mouse listens for pointer events on its element instead of mouse events on the
     * window.
     *
     * @type {boolean}
     */
    get pointer() {
        return this._pointer;
    }

    /**
     * Moves the pointer-mode listeners from the previously bound element to a new one.
     *
     * @param {Element|null} element - The element to bind, or null to unbind.
     * @private
     */
    _bindElement(element) {
        const old = this._bound;
        if (old === element) return;

        if (old) {
            old.removeEventListener('pointerdown', this._downHandler);
            old.removeEventListener('pointermove', this._moveHandler);
            old.removeEventListener('pointerup', this._upHandler);
            old.removeEventListener('pointercancel', this._lostHandler);
            old.removeEventListener('lostpointercapture', this._lostHandler);
            old.removeEventListener('wheel', this._wheelHandler);
            old.removeEventListener('contextmenu', this._pointerContextHandler);

            // the capture and held buttons belonged to the old element
            this._handleWindowBlur();
        }
        this._bound = element ?? null;
        if (element) {
            element.addEventListener('pointerdown', this._downHandler);
            element.addEventListener('pointermove', this._moveHandler);
            element.addEventListener('pointerup', this._upHandler);
            element.addEventListener('pointercancel', this._lostHandler);
            element.addEventListener('lostpointercapture', this._lostHandler);
            element.addEventListener('wheel', this._wheelHandler, { passive: false });
            element.addEventListener('contextmenu', this._pointerContextHandler);
        }
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
            if (error) {
                error();
            }

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
     * Update method, should be called once per frame. Clears {@link Mouse#movement} and
     * {@link Mouse#wheel} and records the current button states.
     */
    update() {
        this.movement[0] = 0;
        this.movement[1] = 0;
        this.wheel = 0;

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

    /**
     * Handle the browser visibilitychange event.
     *
     * @private
     */
    _handleVisibilityChange() {
        if (document.visibilityState === 'hidden') {
            this._handleWindowBlur();
        }
    }

    /**
     * Handle the browser blur event.
     *
     * @private
     */
    _handleWindowBlur() {
        this._buttons.fill(false);
        this._lastbuttons.fill(false);
        this._lastPositionValid = false;
        this._captureId = -1;
    }

    _handleUp(event) {
        // disable released button
        this._buttons[event.button] = false;

        const e = new MouseEvent(this, event);
        if (!e.event) return;

        // send 'mouseup' event
        this.fire('mouseup', e);
    }

    _handleDown(event) {
        // Store which button has affected
        this._buttons[event.button] = true;

        const e = new MouseEvent(this, event);
        if (!e.event) return;

        // pointer mode has no prior hover event to baseline a drag from
        if (this._pointer) {
            this._lastX = e.x;
            this._lastY = e.y;
            this._lastPositionValid = !isMousePointerLocked();
        }

        this.fire('mousedown', e);
    }

    _handleMove(event) {
        const e = new MouseEvent(this, event);
        if (!e.event) {
            // Filtered movement outside the target must not leave a stale baseline for re-entry.
            this._lastPositionValid = false;
            return;
        }

        // Update before firing so a callback that loses focus or detaches can invalidate the baseline.
        this._lastX = e.x;
        this._lastY = e.y;
        this._lastPositionValid = !isMousePointerLocked();
        this.movement[0] += e.dx;
        this.movement[1] += e.dy;

        this.fire('mousemove', e);
    }

    _handleWheel(event) {
        const e = new MouseEvent(this, event);
        if (!e.event) return;

        this.wheel += event.deltaY;

        this.fire('mousewheel', e);
    }

    _isMouseTarget(event) {
        return event.pointerType === 'mouse' && event.target === this._target;
    }

    /**
     * Fires `mousedown` and `mouseup` for buttons whose state in `event.buttons` differs from the
     * recorded one, as pointer events only fire down and up for the first and last button held.
     *
     * @param {globalThis.PointerEvent} event - The pointer event.
     * @private
     */
    _syncButtons(event) {
        const mask = event.buttons;

        // synthetic events may omit buttons
        if (typeof mask !== 'number') return;

        for (let i = 0; i < 3; i++) {
            const down = (mask & BUTTON_BITS[i]) !== 0;
            if (down === this._buttons[i]) continue;

            this._buttons[i] = down;
            const e = new MouseEvent(this, event);
            if (!e.event) continue;

            e.button = i;
            this.fire(down ? 'mousedown' : 'mouseup', e);
        }
    }

    _handlePointerDown(event) {
        if (!this._isMouseTarget(event)) return;

        this._handleDown(event);
        this._syncButtons(event);

        // capture throws while the pointer is locked, and locked movement never leaves the element
        if (!isMousePointerLocked()) {
            this._target.setPointerCapture(event.pointerId);
            this._captureId = event.pointerId;
        }
    }

    _handlePointerMove(event) {
        if (!this._isMouseTarget(event)) return;

        this._syncButtons(event);
        this._handleMove(event);
    }

    _handlePointerUp(event) {
        if (!this._isMouseTarget(event)) return;

        // keep capture state until mouseup fires so a release outside the element still resolves coords
        this._handleUp(event);
        this._syncButtons(event);

        if (this._captureId !== -1) {
            this._target.releasePointerCapture(event.pointerId);
            this._captureId = -1;
        }
    }

    _handlePointerWheel(event) {
        if (event.target !== this._target) return;

        event.preventDefault();
        this._handleWheel(event);
    }

    // capture lost or cancelled: no pointerup will arrive, so release without firing mouseup
    _handlePointerLost(event) {
        if (event.pointerType !== 'mouse') return;

        this._buttons.fill(false);
        this._captureId = -1;
        this._lastPositionValid = false;
    }

    _getTargetCoords(event) {
        const rect = this._target.getBoundingClientRect();
        const left = Math.floor(rect.left);
        const top = Math.floor(rect.top);

        // mouse is outside of canvas, unless a captured drag continues past the edge
        if (this._captureId === -1 && (event.clientX < left ||
            event.clientX >= left + this._target.clientWidth ||
            event.clientY < top ||
            event.clientY >= top + this._target.clientHeight)) {

            return null;
        }

        return {
            x: event.clientX - left,
            y: event.clientY - top
        };
    }
}

export { Mouse };
