pc.extend(pc.input, function () {   
    /**
    * @name pc.input.TouchEvent
    * @class A Event corresponding to touchstart, touchend, touchmove or touchcancel. TouchEvent wraps the standard
    * browser event and provides lists of {@link pc.input.Touch} objects.
    * @constructor Create a new TouchEvent from an existing browser event
    * @param {pc.input.TouchDevice} device The source device of the touch events
    * @param {TouchEvent} event The original browser TouchEvent
    * @property {DOMElement} element The target DOMElement that the event was fired from
    * @property {pc.input.Touch[]} touches A list of all touches currently in contact with the device
    * @property {pc.input.Touch[]} changedTouches A list of touches that have changed since the last event
    */
    var TouchEvent = function (device, event) {
        var self = this;
    
        self.element = event.target;

        self.touches = [];
        self.changedTouches = [];
        
        if (event) {
            var i, l = event.touches.length;
            for (i = 0; i < l; i++) {
                self.touches.push(new Touch(event.touches[i]));
            }
            
            l = event.changedTouches.length;
            for (i = 0; i < l; i++) {
                self.changedTouches.push(new Touch(event.changedTouches[i]));
            }            
        }
    };

    TouchEvent.prototype = {
        /**
        * @function
        * @name pc.input.TouchEvent#getTouchById
        * @description Get an event from one of the touch lists by the id.
        * It is useful to access touches by their id so that you can be sure you are referencing the same touch
        * @param {Number} id The identifier of the touch
        * @param {pc.input.Touch[]} list An array of touches to search
        * @returns {pc.input.Touch|null} The {@link pc.input.Touch} object or null
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
    };
    
    /**
    * @name pc.input.Touch
    * @class A instance of a single point touch on a {@link pc.input.TouchDevice}
    * @constructor Create a new Touch object from the browser Touch
    * @param {Touch} touch The browser Touch object
    * @property {Number} id The identifier of the touch
    * @property {Number} x The x co-ordinate relative to the element that the TouchDevice is attached to
    * @property {Number} y The y co-ordinate relative to the element that the TouchDevice is attached to
    * @property {DOMElement} target The target element of the touch event
    * @property {Touch} touch The original browser Touch object
    */
    var Touch = function (touch) {
        var coords = pc.input.getTouchTargetCoords(touch);

        this.id = touch.identifier;
        
        this.x = coords.x;
        this.y = coords.y;
        
        this.target = touch.target;
        
        this.touch = touch;        
    };
    
    
    /**
    * @name pc.input.TouchDevice
    * @class Attach a TouchDevice to an element and it will receive and fire events when the element is touched.
    * See also {@link pc.input.Touch} and {@link pc.input.TouchEvent}
    * @constructor Create a new touch device and attach it to an element
    * @param {DOMElement} element The element to attach listen for events on
    */
    var TouchDevice = function (element) {

        this._startHandler = this._handleTouchStart.bind(this);
        this._endHandler = this._handleTouchEnd.bind(this);
        this._moveHandler = this._handleTouchMove.bind(this);
        this._cancelHandler = this._handleTouchCancel.bind(this);
        
        this.attach(element);
        
        pc.extend(this, pc.events);
    };

    TouchDevice.prototype = {
        /**
        * @function
        * @name pc.input.TouchDevice#attach
        * @description Attach a device to an element in the DOM. 
        * If the device is already attached to an element this method will detach it first
        * @param {DOMElement} element The element to attach to
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
        * @name pc.input.TouchDevice#detach
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
            this.fire('touchmove', new TouchEvent(this, e));
        },

        _handleTouchCancel: function (e) {
            this.fire('touchcancel', new TouchEvent(this, e));
        }       
    };

    return {
        /**
        * @enum pc.input.EVENT
        * @name pc.input.EVENT_TOUCHSTART
        * @description Name of event fired when a new touch occurs. For example, a finger is placed on the device.
        */
        EVENT_TOUCHSTART: 'touchstart',
        /**
        * @enum pc.input.EVENT
        * @name pc.input.EVENT_TOUCHEND
        * @description Name of event fired when touch ends. For example, a finger is lifted off the device.
        */
        EVENT_TOUCHEND: 'touchend',
        /**
        * @enum pc.input.EVENT
        * @name pc.input.EVENT_TOUCHMOVE
        * @description Name of event fired when a touch moves.
        */
        EVENT_TOUCHMOVE: 'touchmove',
        /**
        * @enum pc.input.EVENT
        * @name pc.input.EVENT_TOUCHCANCEL
        * @description Name of event fired when a touch point is interupted in some way. 
        * The exact reasons for cancelling a touch can vary from device to device. 
        * For example, a modal alert pops up during the interaction; the touch point leaves the document area; 
        * or there are more touch points than the device supports, in which case the earliest touch point is canceled.
        */
        EVENT_TOUCHCANCEL: 'touchcancel',
        
        /**
        * @name pc.input.getTouchTargetCoords
        * @description Similiar to {@link pc.input.getTargetCoords} for the MouseEvents.
        * This function takes a browser Touch object and returns the co-ordinates of the
        * touch relative to the target element.
        * @param {Touch} touch The browser Touch object
        * @returns {Object} The co-ordinates of the touch relative to the touch.target element. In the format {x, y}
        */
        getTouchTargetCoords: function (touch) {
            var totalOffsetX = 0;
            var totalOffsetY = 0;
            var canvasX = 0;
            var canvasY = 0;
            var target = touch.target;
            while (!(target instanceof HTMLElement)) {
                target = target.parentNode;
            }
            var currentElement = target;
            var scaleX = 1;
            var scaleY = 1;

            if (typeof(currentElement.width) === 'number' && typeof(currentElement.height) === 'number') {
                scaleX = currentElement.width / currentElement.offsetWidth;
                scaleY = currentElement.height / currentElement.offsetHeight;
            }
            
            do {
                totalOffsetX += currentElement.offsetLeft - currentElement.scrollLeft;
                totalOffsetY += currentElement.offsetTop - currentElement.scrollTop;
                currentElement = currentElement.offsetParent;
            } while (currentElement);
        
            canvasX = touch.pageX - totalOffsetX;
            canvasY = target.offsetHeight - (touch.pageY - totalOffsetY);

            return {
                x: canvasX * scaleX, 
                y: canvasY * scaleY
            };
        },

        TouchDevice: TouchDevice
    };
}());
