Object.assign(pc, function () {
    /**
     * @constructor
     * @name pc.Touch
     * @classdesc A instance of a single point touch on a {@link pc.TouchDevice}
     * @description Create a new Touch object from the browser Touch
     * @param {Touch} touch The browser Touch object
     * @property {Number} id The identifier of the touch
     * @property {Number} x The x co-ordinate relative to the element that the TouchDevice is attached to
     * @property {Number} y The y co-ordinate relative to the element that the TouchDevice is attached to
     * @property {Element} target The target element of the touch event
     * @property {Touch} touch The original browser Touch object
     */
    var Touch = function (touch) {
        var coords = pc.getTouchTargetCoords(touch);

        this.id = touch.identifier;

        this.x = coords.x;
        this.y = coords.y;

        this.target = touch.target;

        this.touch = touch;
    };

    /**
     * @constructor
     * @name pc.TouchEvent
     * @classdesc A Event corresponding to touchstart, touchend, touchmove or touchcancel. TouchEvent wraps the standard
     * browser event and provides lists of {@link pc.Touch} objects.
     * @description Create a new TouchEvent from an existing browser event
     * @param {pc.TouchDevice} device The source device of the touch events
     * @param {TouchEvent} event The original browser TouchEvent
     * @property {Element} element The target Element that the event was fired from
     * @property {pc.Touch[]} touches A list of all touches currently in contact with the device
     * @property {pc.Touch[]} changedTouches A list of touches that have changed since the last event
     */
    var TouchEvent = function (device, event) {
        this.element = event.target;
        this.event = event;

        this.touches = [];
        this.changedTouches = [];

        if (event) {
            var i, l = event.touches.length;
            for (i = 0; i < l; i++) {
                this.touches.push(new Touch(event.touches[i]));
            }

            l = event.changedTouches.length;
            for (i = 0; i < l; i++) {
                this.changedTouches.push(new Touch(event.changedTouches[i]));
            }
        }
    };

    Object.assign(TouchEvent.prototype, {
        /**
         * @function
         * @name pc.TouchEvent#getTouchById
         * @description Get an event from one of the touch lists by the id. It is useful to access
         * touches by their id so that you can be sure you are referencing the same touch.
         * @param {Number} id The identifier of the touch.
         * @param {pc.Touch[]} list An array of touches to search.
         * @returns {pc.Touch} The {@link pc.Touch} object or null.
         */
        getTouchById: function (id, list) {
            var i, l = list.length;
            for (i = 0; i < l; i++) {
                if (list[i].id === id) {
                    return list[i];
                }
            }

            return null;
        }
    });

    /**
     * @constructor
     * @name pc.TouchDevice
     * @classdesc Attach a TouchDevice to an element and it will receive and fire events when the element is touched.
     * See also {@link pc.Touch} and {@link pc.TouchEvent}
     * @description Create a new touch device and attach it to an element
     * @param {Element} element The element to attach listen for events on
     */
    var TouchDevice = function (element) {
        this._element = null;

        this._startHandler = this._handleTouchStart.bind(this);
        this._endHandler = this._handleTouchEnd.bind(this);
        this._moveHandler = this._handleTouchMove.bind(this);
        this._cancelHandler = this._handleTouchCancel.bind(this);

        this.attach(element);

        pc.events.attach(this);
    };

    Object.assign(TouchDevice.prototype, {
        /**
         * @function
         * @name pc.TouchDevice#attach
         * @description Attach a device to an element in the DOM.
         * If the device is already attached to an element this method will detach it first
         * @param {Element} element The element to attach to
         */
        attach: function (element) {
            if (this._element) {
                this.detach();
            }

            this._element = element;

            this._element.addEventListener('touchstart', this._startHandler, false);
            this._element.addEventListener('touchend', this._endHandler, false);
            this._element.addEventListener('touchmove', this._moveHandler, false);
            this._element.addEventListener('touchcancel', this._cancelHandler, false);
        },

        /**
         * @function
         * @name pc.TouchDevice#detach
         * @description Detach a device from the element it is attached to
         */
        detach: function () {
            if (this._element) {
                this._element.removeEventListener('touchstart', this._startHandler, false);
                this._element.removeEventListener('touchend', this._endHandler, false);
                this._element.removeEventListener('touchmove', this._moveHandler, false);
                this._element.removeEventListener('touchcancel', this._cancelHandler, false);
            }
            this._element = null;
        },

        _handleTouchStart: function (e) {
            this.fire('touchstart', new TouchEvent(this, e));
        },

        _handleTouchEnd: function (e) {
            this.fire('touchend', new TouchEvent(this, e));
        },

        _handleTouchMove: function (e) {
            // call preventDefault to avoid issues in Chrome Android:
            // http://wilsonpage.co.uk/touch-events-in-chrome-android/
            e.preventDefault();
            this.fire('touchmove', new TouchEvent(this, e));
        },

        _handleTouchCancel: function (e) {
            this.fire('touchcancel', new TouchEvent(this, e));
        }
    });

    return {
        /**
         * @function
         * @name pc.getTouchTargetCoords
         * @description Similiar to {@link pc.getTargetCoords} for the MouseEvents.
         * This function takes a browser Touch object and returns the co-ordinates of the
         * touch relative to the target element.
         * @param {Touch} touch The browser Touch object
         * @returns {Object} The co-ordinates of the touch relative to the touch.target element. In the format {x, y}
         */
        getTouchTargetCoords: function (touch) {
            var totalOffsetX = 0;
            var totalOffsetY = 0;
            var target = touch.target;
            while (!(target instanceof HTMLElement)) {
                target = target.parentNode;
            }
            var currentElement = target;

            do {
                totalOffsetX += currentElement.offsetLeft - currentElement.scrollLeft;
                totalOffsetY += currentElement.offsetTop - currentElement.scrollTop;
                currentElement = currentElement.offsetParent;
            } while (currentElement);

            return {
                x: touch.pageX - totalOffsetX,
                y: touch.pageY - totalOffsetY
            };
        },

        TouchDevice: TouchDevice,
        TouchEvent: TouchEvent
    };
}());
