import { platform } from '../../core/platform.js';

/**
 * @import { TouchDevice } from './touch-device.js'
 */

/**
 * Returns true if a pointer event comes from a touch. A pen counts as a touch on platforms with
 * touch support, and as a mouse otherwise.
 *
 * @param {globalThis.PointerEvent} event - The pointer event.
 * @returns {boolean} True if the pointer is a touch.
 * @ignore
 */
function isTouchPointer(event) {
    return event.pointerType === 'touch' || (event.pointerType === 'pen' && platform.touch);
}

/**
 * This function takes a browser Touch or PointerEvent and returns the coordinates of the touch
 * relative to the target DOM element.
 *
 * @param {globalThis.Touch|globalThis.PointerEvent} touch - The browser Touch or PointerEvent.
 * @returns {{x: number, y: number}} The coordinates of the touch relative to the touch.target
 * DOM element.
 * @category Input Devices
 */
function getTouchTargetCoords(touch) {
    return targetCoords(touch.target, touch.pageX, touch.pageY);
}

/**
 * @param {EventTarget|null} target - The DOM node the coordinates are relative to.
 * @param {number} pageX - The page x coordinate.
 * @param {number} pageY - The page y coordinate.
 * @returns {{x: number, y: number}} The coordinates relative to the target.
 */
function targetCoords(target, pageX, pageY) {
    let totalOffsetX = 0;
    let totalOffsetY = 0;

    while (!(target instanceof HTMLElement) && target) {
        target = target.parentNode;
    }

    while (target) {
        totalOffsetX += target.offsetLeft - target.scrollLeft;
        totalOffsetY += target.offsetTop - target.scrollTop;
        target = target.offsetParent;
    }

    return {
        x: pageX - totalOffsetX,
        y: pageY - totalOffsetY
    };
}

/**
 * A instance of a single point touch on a {@link TouchDevice}.
 *
 * @category Input Devices
 */
class Touch {
    /**
     * The identifier of the touch, which is the `pointerId` of its pointer events.
     *
     * @type {number}
     */
    id;

    /**
     * The x coordinate relative to the element the touch started on.
     *
     * @type {number}
     */
    x;

    /**
     * The y coordinate relative to the element the touch started on.
     *
     * @type {number}
     */
    y;

    /**
     * The DOM element the touch started on, which stays the same while the touch moves.
     *
     * @type {Element}
     */
    target;

    /**
     * The browser PointerEvent that last updated the touch.
     *
     * @type {globalThis.PointerEvent}
     */
    touch;

    /**
     * Create a new Touch object from a browser PointerEvent.
     *
     * @param {globalThis.PointerEvent} touch - The browser PointerEvent.
     * @param {Element} [target] - The element the touch started on, which the coordinates are
     * relative to. Defaults to the target of the PointerEvent.
     */
    constructor(touch, target = /** @type {Element} */ (touch.target)) {
        const coords = targetCoords(target, touch.pageX, touch.pageY);

        this.id = touch.pointerId;
        this.x = coords.x;
        this.y = coords.y;
        this.target = target;
        this.touch = touch;
    }
}

/**
 * The TouchEvent object is passed into all event handlers registered on the {@link TouchDevice}.
 * The events are:
 *
 * - {@link TouchDevice.EVENT_TOUCHSTART}
 * - {@link TouchDevice.EVENT_TOUCHEND}
 * - {@link TouchDevice.EVENT_TOUCHMOVE}
 * - {@link TouchDevice.EVENT_TOUCHCANCEL}
 *
 * @category Input Devices
 */
class TouchEvent {
    /**
     * The DOM element the changed touch started on.
     *
     * @type {Element}
     */
    element;

    /**
     * The original browser PointerEvent.
     *
     * @type {globalThis.PointerEvent}
     */
    event;

    /**
     * A list of all touches currently in contact with the device.
     *
     * @type {Touch[]}
     */
    touches = [];

    /**
     * A list of touches that have changed since the last event. This holds the one touch whose
     * pointer fired the event, and on `touchend` and `touchcancel` it is no longer in
     * {@link TouchEvent#touches}.
     *
     * @type {Touch[]}
     */
    changedTouches = [];

    /**
     * Create a new TouchEvent instance. It is created from an existing browser event.
     *
     * @param {TouchDevice} device - The source device of the touch events.
     * @param {globalThis.PointerEvent} event - The original browser PointerEvent.
     * @param {Element} [target] - The element the changed touch started on. Defaults to the target
     * of the PointerEvent.
     */
    constructor(device, event, target = /** @type {Element} */ (event.target)) {
        this.element = target;
        this.event = event;

        this.touches = Array.from(device._touches.values(), t => new Touch(t.event, t.target));
        this.changedTouches = [new Touch(event, target)];
    }

    /**
     * Get an event from one of the touch lists by the id. It is useful to access touches by their
     * id so that you can be sure you are referencing the same touch.
     *
     * @param {number} id - The identifier of the touch.
     * @param {Touch[]} list - An array of touches to search.
     * @returns {Touch|null} The {@link Touch} object or null.
     */
    getTouchById(id, list) {
        return list.find(touch => touch.id === id) || null;
    }
}

export { getTouchTargetCoords, isTouchPointer, Touch, TouchEvent };
