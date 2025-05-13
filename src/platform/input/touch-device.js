import { EventHandler } from '../../core/event-handler.js';

import { TouchEvent } from './touch-event.js';

/**
 * Manages touch input by handling and dispatching touch events. Extends {@link EventHandler}
 * to fire `touchstart`, `touchend`, `touchmove`, and `touchcancel` events (see {@link TouchEvent}).
 *
 * Detects and processes touch interactions with the attached DOM element, allowing applications
 * to respond to common touch gestures. The TouchDevice instance must be attached to a DOM element
 * before it can detect touch events.
 *
 * Your application's TouchDevice instance is managed and accessible via {@link AppBase#touch}.
 *
 * @category Input
 */
class TouchDevice extends EventHandler {
    /**
     * Fired when a touch starts. The handler is passed a {@link TouchEvent}.
     *
     * @event
     * @example
     * app.touch.on('touchstart', (e) => {
     *     console.log(`Touch started at position: ${e.x}, ${e.y}`);
     * });
     */
    static EVENT_TOUCHSTART = 'touchstart';

    /**
     * Fired when a touch ends. The handler is passed a {@link TouchEvent}.
     *
     * @event
     * @example
     * app.touch.on('touchend', (e) => {
     *     console.log(`Touch ended at position: ${e.x}, ${e.y}`);
     * });
     */
    static EVENT_TOUCHEND = 'touchend';

    /**
     * Fired when a touch moves. The handler is passed a {@link TouchEvent}.
     *
     * @event
     * @example
     * app.touch.on('touchmove', (e) => {
     *     console.log(`Touch moved to position: ${e.x}, ${e.y}`);
     * });
     */
    static EVENT_TOUCHMOVE = 'touchmove';

    /**
     * Fired when a touch is interrupted in some way. The exact reasons for canceling a touch can
     * vary from device to device. For example, a modal alert pops up during the interaction; the
     * touch point leaves the document area, or there are more touch points than the device
     * supports, in which case the earliest touch point is canceled. The handler is passed a
     * {@link TouchEvent}.
     *
     * @event
     * @example
     * app.touch.on('touchcancel', (e) => {
     *     console.log(`Touch canceled at position: ${e.x}, ${e.y}`);
     * });
     */
    static EVENT_TOUCHCANCEL = 'touchcancel';

    /**
     * Create a new touch device and attach it to an element.
     *
     * @param {Element} element - The element to attach listen for events on.
     */
    constructor(element) {
        super();

        this._element = null;

        this._startHandler = this._handleTouchStart.bind(this);
        this._endHandler = this._handleTouchEnd.bind(this);
        this._moveHandler = this._handleTouchMove.bind(this);
        this._cancelHandler = this._handleTouchCancel.bind(this);

        this.attach(element);
    }

    /**
     * Attach a device to an element in the DOM. If the device is already attached to an element
     * this method will detach it first.
     *
     * @param {Element} element - The element to attach to.
     */
    attach(element) {
        if (this._element) {
            this.detach();
        }

        this._element = element;

        this._element.addEventListener('touchstart', this._startHandler, false);
        this._element.addEventListener('touchend', this._endHandler, false);
        this._element.addEventListener('touchmove', this._moveHandler, false);
        this._element.addEventListener('touchcancel', this._cancelHandler, false);
    }

    /**
     * Detach a device from the element it is attached to.
     */
    detach() {
        if (this._element) {
            this._element.removeEventListener('touchstart', this._startHandler, false);
            this._element.removeEventListener('touchend', this._endHandler, false);
            this._element.removeEventListener('touchmove', this._moveHandler, false);
            this._element.removeEventListener('touchcancel', this._cancelHandler, false);
        }
        this._element = null;
    }

    _handleTouchStart(e) {
        this.fire('touchstart', new TouchEvent(this, e));
    }

    _handleTouchEnd(e) {
        this.fire('touchend', new TouchEvent(this, e));
    }

    _handleTouchMove(e) {
        // call preventDefault to avoid issues in Chrome Android:
        // http://wilsonpage.co.uk/touch-events-in-chrome-android/
        e.preventDefault();
        this.fire('touchmove', new TouchEvent(this, e));
    }

    _handleTouchCancel(e) {
        this.fire('touchcancel', new TouchEvent(this, e));
    }
}

export { TouchDevice };
