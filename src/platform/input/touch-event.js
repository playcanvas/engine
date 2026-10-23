/**
 * @import { TouchDevice } from './touch-device.js'
 */

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
    let totalOffsetX = 0;
    let totalOffsetY = 0;
    let target = touch.target;

    while (!(target instanceof HTMLElement) && target) {
        target = target.parentNode;
    }

    while (target) {
        totalOffsetX += target.offsetLeft - target.scrollLeft;
        totalOffsetY += target.offsetTop - target.scrollTop;
        target = target.offsetParent;
    }

    return {
        x: touch.pageX - totalOffsetX,
        y: touch.pageY - totalOffsetY
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
     * The x coordinate relative to the element that the TouchDevice is attached to.
     *
     * @type {number}
     */
    x;

    /**
     * The y coordinate relative to the element that the TouchDevice is attached to.
     *
     * @type {number}
     */
    y;

    /**
     * The target DOM element of the touch event.
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
     */
    constructor(touch) {
        const coords = getTouchTargetCoords(touch);

        this.id = touch.pointerId;
        this.x = coords.x;
        this.y = coords.y;
        this.target = touch.target;
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
     * The target DOM element that the event was fired from.
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
     */
    constructor(device, event) {
        this.element = event.target;
        this.event = event;

        this.touches = Array.from(device._touches.values(), e => new Touch(e));
        this.changedTouches = [new Touch(event)];
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

export { getTouchTargetCoords, Touch, TouchEvent };
