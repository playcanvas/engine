/**
 * @name pc.events
 * @namespace
 * @description Extend any normal object with events
 *
 * @example var o = {};
 * o = pc.extend(o, pc.events);
 *
 * // attach event
 * o.on("event_name", function() {
 *   alert('event_name fired');
 * }, this);
 *
 * // fire event
 * o.fire("event_name");
 *
 * // detach all events from object
 * o.off('event_name');
 */
pc.events = function () {

    var Events = {
        /**
        * @function
        * @name pc.events.attach
        * @description Attach event methods 'on', 'off', 'fire' and 'hasEvent' to the target object
        * @param  {Object} target The object to add events to.
        * @return {Object} The target object
        */
        attach: function (target) {
            var ev = pc.events;
            target.on = ev.on;
            target.off = ev.off;
            target.fire = ev.fire;
            target.once = ev.once;
            target.hasEvent = ev.hasEvent;
            target.bind = ev.on;
            target.unbind = ev.off;
            return target;
        },

        /**
         * @function
         * @name pc.events.on
         * @description Attach an event handler to an event
         * @param {String} name Name of the event to bind the callback to
         * @param {Function} callback Function that is called when event is fired. Note the callback is limited to 8 arguments.
         * @param {Object} [scope] Object to use as 'this' when the event is fired, defaults to current this
         * @example var o = {};
         * pc.events.attach(o);
         * o.on('event_name', function (a, b) {
         *   console.log(a + b);
         * });
         * o.fire('event_name', 1, 2); // prints 3 to the console
         */
        on: function (name, callback, scope) {
            if(pc.type(name) != "string") {
                throw new TypeError("Event name must be a string");
            }
            var callbacks = this._callbacks || (this._callbacks = {});
            var events = callbacks[name] || (callbacks[name] = []);
            events.push({
                callback: callback,
                scope: scope || this
            });

            return this;
        },

        /**
         * @function
         * @name pc.events.off
         * @description Detach an event handler from an event. If callback is not provided then all callbacks are unbound from the event,
         * if scope is not provided then all events with the callback will be unbound.
         * @param {String} name Name of the event to unbind
         * @param {Function} [callback] Function to be unbound
         * @param {Object} [scope] Scope that was used as the this when the event is fired
         * @example
         * var handler = function () {
         * };
         * var o = {};
         * pc.events.attach(o);
         * o.on('event_name', handler);
         *
         * o.off('event_name'); // Remove all events called 'event_name'
         * o.off('event_name', handler); // Remove all handler functions, called 'event_name'
         * o.off('event_name', handler, this); // Remove all hander functions, called 'event_name' with scope this
         */
        off: function (name, callback, scope) {
            var callbacks = this._callbacks;
            var events;
            var index;

            if (!callbacks) {
                return; // no callbacks at all
            }

            if (!callback) {
                // Clear all callbacks
                callbacks[name] = [];
            } else {
                events = callbacks[name];
                if (!events) {
                    return this;
                }

                for (index = 0; index < events.length; index++) {
                    if (events[index].callback === callback) {
                        if (!scope || (scope === events[index].scope)) {
                            events.splice(index, 1);
                            index--;
                        }
                    }
                }
            }

            return this;
        },

        /**
         * @function
         * @name pc.events.fire
         * @description Fire an event, all additional arguments are passed on to the event listener
         * @param {Object} name Name of event to fire
         * @param {*} [...] Arguments that are passed to the event handler
         * @example
         * var o = {};
         * pc.events.attach(o);
         * o.on('event_name', function (msg) {
         *   alert('event_name fired: ' + msg);
         * });
         * o.fire('event_name', 'This is the message');
         */
        fire: function (name) {
            var index;
            var length;
            var args;
            var callbacks;

            if (this._callbacks && this._callbacks[name]) {
                length = this._callbacks[name].length;
                if (length) {
                    callbacks = this._callbacks[name].slice(); // clone list so that deleting inside callbacks works
                    var originalIndex = 0;
                    for(index = 0; index < length; ++index) {
                        var scope = callbacks[index].scope;
                        callbacks[index].callback.call(scope, arguments[1], arguments[2], arguments[3], arguments[4], arguments[5], arguments[6], arguments[7], arguments[8]);
                        if (callbacks[index].callback.once) {
                            this._callbacks[name].splice(originalIndex, 1);
                        } else {
                            originalIndex++;
                        }
                    }
                }
            }

            return this;
        },

        once: function (name, callback, scope) {
            callback.once = true;
            this.on(name, callback, scope);
        },

        /**
        * @function
        * @name pc.events.hasEvent
        * @description Test if there are any handlers bound to an event name
        * @param {String} name The name of the event to test
        * @example
        * var o = {};
        * pc.events.attach(o); // add events to o
        * o.on('event_name', function () {}); // bind an event to 'event_name'
        * o.hasEvent('event_name'); // returns true
        */
        hasEvent: function (name) {
            return (this._callbacks !== undefined && this._callbacks[name] !== undefined && this._callbacks[name].length > 0);
        }
    };

    // For compatibility
    Events.bind = Events.on;
    Events.unbind = Events.off;

    return Events;
} ();
