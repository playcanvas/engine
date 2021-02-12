import { MOUSEBUTTON_NONE } from './constants.js';

function isMousePointerLocked() {
    return !!(document.pointerLockElement || document.mozPointerLockElement || document.webkitPointerLockElement);
}

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
class MouseEvent {
    constructor(mouse, event) {
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
        } else if (isMousePointerLocked()) {
            this.x = 0;
            this.y = 0;
        } else {
            return;
        }

        // deltaY is in a different range across different browsers. The only thing
        // that is consistent is the sign of the value so snap to -1/+1.
        this.wheelDelta = 0;
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
        } else {
            this.button = MOUSEBUTTON_NONE;
        }
        this.buttons = mouse._buttons.slice(0);
        this.element = event.target;

        this.ctrlKey = event.ctrlKey || false;
        this.altKey = event.altKey || false;
        this.shiftKey = event.shiftKey || false;
        this.metaKey = event.metaKey || false;

        this.event = event;
    }
}

export { isMousePointerLocked, MouseEvent };
