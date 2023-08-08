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
     * Create a new MouseEvent instance.
     *
     * @param {import('./mouse.js').Mouse} mouse - The Mouse device that is firing this event.
     * @param {globalThis.MouseEvent} event - The original browser event that fired.
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
            /**
             * The x coordinate of the mouse pointer relative to the element {@link Mouse} is
             * attached to.
             *
             * @type {number}
             */
            this.x = coords.x;
            /**
             * The y coordinate of the mouse pointer relative to the element {@link Mouse} is
             * attached to.
             *
             * @type {number}
             */
            this.y = coords.y;
        } else if (isMousePointerLocked()) {
            this.x = 0;
            this.y = 0;
        } else {
            return;
        }

        /**
         * A value representing the amount the mouse wheel has moved, only valid for
         * {@link EVENT_MOUSEWHEEL} events.
         *
         * @type {number}
         */
        this.wheelDelta = 0;
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
            /**
             * The change in x coordinate since the last mouse event.
             *
             * @type {number}
             */
            this.dx = event.movementX || event.webkitMovementX || event.mozMovementX || 0;
            /**
             * The change in y coordinate since the last mouse event.
             *
             * @type {number}
             */
            this.dy = event.movementY || event.webkitMovementY || event.mozMovementY || 0;
        } else {
            this.dx = this.x - mouse._lastX;
            this.dy = this.y - mouse._lastY;
        }

        if (event.type === 'mousedown' || event.type === 'mouseup') {
            /**
             * The mouse button associated with this event. Can be:
             *
             * - {@link MOUSEBUTTON_LEFT}
             * - {@link MOUSEBUTTON_MIDDLE}
             * - {@link MOUSEBUTTON_RIGHT}
             *
             * @type {number}
             */
            this.button = event.button;
        } else {
            this.button = MOUSEBUTTON_NONE;
        }
        this.buttons = mouse._buttons.slice(0);

        /**
         * The element that the mouse was fired from.
         *
         * @type {Element}
         */
        this.element = event.target;

        /**
         * True if the ctrl key was pressed when this event was fired.
         *
         * @type {boolean}
         */
        this.ctrlKey = event.ctrlKey || false;
        /**
         * True if the alt key was pressed when this event was fired.
         *
         * @type {boolean}
         */
        this.altKey = event.altKey || false;
        /**
         * True if the shift key was pressed when this event was fired.
         *
         * @type {boolean}
         */
        this.shiftKey = event.shiftKey || false;
        /**
         * True if the meta key was pressed when this event was fired.
         *
         * @type {boolean}
         */
        this.metaKey = event.metaKey || false;

        /**
         * The original browser event.
         *
         * @type {globalThis.MouseEvent}
         */
        this.event = event;
    }
}

export { isMousePointerLocked, MouseEvent };
