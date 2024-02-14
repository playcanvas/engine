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
     * Create a new Touch object from the browser Touch.
     *
     * @param {globalThis.Touch} touch - The browser Touch object.
     */
    constructor(touch) {
        const coords = getTouchTargetCoords(touch);

        /**
         * The identifier of the touch.
         *
         * @type {number}
         */
        this.id = touch.identifier;

        /**
         * The x coordinate relative to the element that the TouchDevice is attached to.
         *
         * @type {number}
         */
        this.x = coords.x;
        /**
         * The y coordinate relative to the element that the TouchDevice is attached to.
         *
         * @type {number}
         */
        this.y = coords.y;

        /**
         * The target DOM element of the touch event.
         *
         * @type {Element}
         */
        this.target = touch.target;

        /**
         * The original browser Touch object.
         *
         * @type {globalThis.Touch}
         */
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
     * Create a new TouchEvent instance. It is created from an existing browser event.
     *
     * @param {import('./touch-device.js').TouchDevice} device - The source device of the touch
     * events.
     * @param {globalThis.TouchEvent} event - The original browser TouchEvent.
     */
    constructor(device, event) {
        /**
         * The target DOM element that the event was fired from.
         *
         * @type {Element}
         */
        this.element = event.target;
        /**
         * The original browser TouchEvent.
         *
         * @type {globalThis.TouchEvent}
         */
        this.event = event;

        /**
         * A list of all touches currently in contact with the device.
         *
         * @type {Touch[]}
         */
        this.touches = [];
        /**
         * A list of touches that have changed since the last event.
         *
         * @type {Touch[]}
         */
        this.changedTouches = [];

        if (event) {
            for (let i = 0, l = event.touches.length; i < l; i++) {
                this.touches.push(new Touch(event.touches[i]));
            }


            for (let i = 0, l = event.changedTouches.length; i < l; i++) {
                this.changedTouches.push(new Touch(event.changedTouches[i]));
            }
        }
    }

    /**
     * Get an event from one of the touch lists by the id. It is useful to access touches by their
     * id so that you can be sure you are referencing the same touch.
     *
     * @param {number} id - The identifier of the touch.
     * @param {Touch[]|null} list - An array of touches to search.
     * @returns {Touch} The {@link Touch} object or null.
     */
    getTouchById(id, list) {
        for (let i = 0, l = list.length; i < l; i++) {
            if (list[i].id === id) {
                return list[i];
            }
        }

        return null;
    }
}

export { getTouchTargetCoords, Touch, TouchEvent };
