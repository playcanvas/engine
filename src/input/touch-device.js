import { EventHandler } from '../core/event-handler.js';

import { TouchEvent } from './touch-event.js';

/**
 * @class
 * @name TouchDevice
 * @augments EventHandler
 * @classdesc Attach a TouchDevice to an element and it will receive and fire events when the element is touched.
 * See also {@link Touch} and {@link TouchEvent}.
 * @description Create a new touch device and attach it to an element.
 * @param {Element} element - The element to attach listen for events on.
 */
class TouchDevice extends EventHandler {
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
     * @function
     * @name TouchDevice#attach
     * @description Attach a device to an element in the DOM.
     * If the device is already attached to an element this method will detach it first.
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
     * @function
     * @name TouchDevice#detach
     * @description Detach a device from the element it is attached to.
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
