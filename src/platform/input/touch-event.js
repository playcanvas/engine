/**
 * This function takes a browser Touch object and returns the coordinates of the touch relative to
 * the target DOM element.
 *
 * @param {globalThis.Touch} touch - The browser Touch object.
 * @returns {object} The coordinates of the touch relative to the touch.target DOM element. In the
 * format \{x, y\}.
 * @category Input
 */
function getTouchTargetCoords(touch) {
    let totalOffsetX = 0;
    let totalOffsetY = 0;
    let target = touch.target;
    while (!(target instanceof HTMLElement)) {
        target = target.parentNode;
    }
    let currentElement = target;

    do {
        totalOffsetX += currentElement.offsetLeft - currentElement.scrollLeft;
        totalOffsetY += currentElement.offsetTop - currentElement.scrollTop;
        currentElement = currentElement.offsetParent;
    } while (currentElement);

    return {
        x: touch.pageX - totalOffsetX,
        y: touch.pageY - totalOffsetY
    };
}

/**
 * A instance of a single point touch on a {@link TouchDevice}.
 *
 * @category Input
 */
class Touch {
    /**
     * The identifier of the touch.
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
     * The original browser Touch object.
     *
     * @type {globalThis.Touch}
     */
    touch;

    /**
     * Create a new Touch object from the browser Touch.
     *
     * @param {globalThis.Touch} touch - The browser Touch object.
     */
    constructor(touch) {
        const coords = getTouchTargetCoords(touch);

        this.id = touch.identifier;
        this.x = coords.x;
        this.y = coords.y;
        this.target = touch.target;
        this.touch = touch;
    }
}

/**
 * A Event corresponding to touchstart, touchend, touchmove or touchcancel. TouchEvent wraps the
 * standard browser DOM event and provides lists of {@link Touch} objects.
 *
 * @category Input
 */
class TouchEvent {
    /**
     * The target DOM element that the event was fired from.
     *
     * @type {Element}
     */
    element;

    /**
     * The original browser TouchEvent.
     *
     * @type {globalThis.TouchEvent}
     */
    event;

    /**
     * A list of all touches currently in contact with the device.
     *
     * @type {Touch[]}
     */
    touches = [];

    /**
     * A list of touches that have changed since the last event.
     *
     * @type {Touch[]}
     */
    changedTouches = [];

    /**
     * Create a new TouchEvent instance. It is created from an existing browser event.
     *
     * @param {import('./touch-device.js').TouchDevice} device - The source device of the touch
     * events.
     * @param {globalThis.TouchEvent} event - The original browser TouchEvent.
     */
    constructor(device, event) {
        this.element = event.target;
        this.event = event;

        this.touches = Array.from(event.touches).map(touch => new Touch(touch));
        this.changedTouches = Array.from(event.changedTouches).map(touch => new Touch(touch));
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
