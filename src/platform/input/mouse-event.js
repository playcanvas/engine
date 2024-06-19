import { MOUSEBUTTON_NONE } from './constants.js';

/**
 * Returns true if pointer lock is currently enabled.
 *
 * @returns {boolean} True if pointer lock is currently enabled.
 * @ignore
 */
function isMousePointerLocked() {
    return !!(document.pointerLockElement || document.mozPointerLockElement || document.webkitPointerLockElement);
}

/**
 * MouseEvent object that is passed to events 'mousemove', 'mouseup', 'mousedown' and 'mousewheel'.
 *
 * @category Input
 */
class MouseEvent {
    /**
     * The x coordinate of the mouse pointer relative to the element {@link Mouse} is attached to.
     *
     * @type {number}
     */
    x = 0;

    /**
     * The y coordinate of the mouse pointer relative to the element {@link Mouse} is attached to.
     *
     * @type {number}
     */
    y = 0;

    /**
     * The change in x coordinate since the last mouse event.
     *
     * @type {number}
     */
    dx = 0;

    /**
     * The change in y coordinate since the last mouse event.
     *
     * @type {number}
     */
    dy = 0;

    /**
     * The mouse button associated with this event. Can be:
     *
     * - {@link MOUSEBUTTON_LEFT}
     * - {@link MOUSEBUTTON_MIDDLE}
     * - {@link MOUSEBUTTON_RIGHT}
     *
     * @type {number}
     */
    button = MOUSEBUTTON_NONE;

    /**
     * A value representing the amount the mouse wheel has moved, only valid for
     * {@link EVENT_MOUSEWHEEL} events.
     *
     * @type {number}
     */
    wheelDelta = 0;

    /**
     * The element that the mouse was fired from.
     *
     * @type {Element}
     */
    element;

    /**
     * True if the ctrl key was pressed when this event was fired.
     *
     * @type {boolean}
     */
    ctrlKey = false;

    /**
     * True if the alt key was pressed when this event was fired.
     *
     * @type {boolean}
     */
    altKey = false;

    /**
     * True if the shift key was pressed when this event was fired.
     *
     * @type {boolean}
     */
    shiftKey = false;

    /**
     * True if the meta key was pressed when this event was fired.
     *
     * @type {boolean}
     */
    metaKey = false;

    /**
     * The original browser event.
     *
     * @type {globalThis.MouseEvent|globalThis.WheelEvent}
     */
    event;

    /**
     * Create a new MouseEvent instance.
     *
     * @param {import('./mouse.js').Mouse} mouse - The Mouse device that is firing this event.
     * @param {globalThis.MouseEvent|globalThis.WheelEvent} event - The original browser event that fired.
     */
    constructor(mouse, event) {
        let coords = {
            x: 0,
            y: 0
        };

        if (event) {
            if (event instanceof MouseEvent) {
                throw Error('Expected MouseEvent');
            }
            coords = mouse._getTargetCoords(event);
        } else {
            event = { };
        }

        if (coords) {
            this.x = coords.x;
            this.y = coords.y;
        } else if (isMousePointerLocked()) {
            this.x = 0;
            this.y = 0;
        } else {
            return;
        }

        // deltaY is in a different range across different browsers. The only thing
        // that is consistent is the sign of the value so snap to -1/+1.
        if (event.type === 'wheel') {
            if (event.deltaY > 0) {
                this.wheelDelta = 1;
            } else if (event.deltaY < 0) {
                this.wheelDelta = -1;
            }
        }

        // Get the movement delta in this event
        if (isMousePointerLocked()) {
            this.dx = event.movementX || event.webkitMovementX || event.mozMovementX || 0;
            this.dy = event.movementY || event.webkitMovementY || event.mozMovementY || 0;
        } else {
            this.dx = this.x - mouse._lastX;
            this.dy = this.y - mouse._lastY;
        }

        if (event.type === 'mousedown' || event.type === 'mouseup') {
            this.button = event.button;
        }
        this.buttons = mouse._buttons.slice(0);

        this.element = event.target;

        this.ctrlKey = event.ctrlKey ?? false;
        this.altKey = event.altKey ?? false;
        this.shiftKey = event.shiftKey ?? false;
        this.metaKey = event.metaKey ?? false;

        this.event = event;
    }
}

export { isMousePointerLocked, MouseEvent };
