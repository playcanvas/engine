/**
 * @function
 * @name getTouchTargetCoords
 * @description Similar to {@link getTargetCoords} for the MouseEvents.
 * This function takes a browser Touch object and returns the co-ordinates of the
 * touch relative to the target element.
 * @param {Touch} touch - The browser Touch object.
 * @returns {object} The co-ordinates of the touch relative to the touch.target element. In the format {x, y}.
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
 * @class
 * @name Touch
 * @classdesc A instance of a single point touch on a {@link TouchDevice}.
 * @description Create a new Touch object from the browser Touch.
 * @param {Touch} touch - The browser Touch object.
 * @property {number} id The identifier of the touch.
 * @property {number} x The x co-ordinate relative to the element that the TouchDevice is attached to.
 * @property {number} y The y co-ordinate relative to the element that the TouchDevice is attached to.
 * @property {Element} target The target element of the touch event.
 * @property {Touch} touch The original browser Touch object.
 */
class Touch {
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
 * @class
 * @name TouchEvent
 * @classdesc A Event corresponding to touchstart, touchend, touchmove or touchcancel. TouchEvent wraps the standard
 * browser event and provides lists of {@link Touch} objects.
 * @description Create a new TouchEvent from an existing browser event.
 * @param {TouchDevice} device - The source device of the touch events.
 * @param {TouchEvent} event - The original browser TouchEvent.
 * @property {Element} element The target Element that the event was fired from.
 * @property {Touch[]} touches A list of all touches currently in contact with the device.
 * @property {Touch[]} changedTouches A list of touches that have changed since the last event.
 * @property {TouchEvent} event - The original browser TouchEvent.
 */
class TouchEvent {
    constructor(device, event) {
        this.element = event.target;
        this.event = event;

        this.touches = [];
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
     * @function
     * @name TouchEvent#getTouchById
     * @description Get an event from one of the touch lists by the id. It is useful to access
     * touches by their id so that you can be sure you are referencing the same touch.
     * @param {number} id - The identifier of the touch.
     * @param {Touch[]} list - An array of touches to search.
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
