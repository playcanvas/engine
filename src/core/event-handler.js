Object.assign(pc, (function () {
    'use strict';

    /**
     * @class
     * @name pc.EventHandler
     * @classdesc Abstract base class that implements functionality for event handling.
     * @description Create a new event handler.
     * @example
     * var obj = new EventHandlerSubclass();
     *
     * // subscribe to an event
     * obj.on('hello', function (str) {
     *     console.log('event hello is fired', str);
     * });
     *
     * // fire event
     * obj.fire('hello', 'world');
     */
    var EventHandler = function () {
        this._callbacks = { };
        this._callbackActive = { };
    };

    Object.assign(EventHandler.prototype, {
        /**
         * @function
         * @name pc.EventHandler#on
         * @description Attach an event handler to an event.
         * @param {string} name - Name of the event to bind the callback to.
         * @param {pc.callbacks.HandleEvent} callback - Function that is called when event is fired. Note the callback is limited to 8 arguments.
         * @param {object} [scope] - Object to use as 'this' when the event is fired, defaults to current this.
         * @returns {pc.EventHandler} Self for chaining.
         * @example
         * obj.on('test', function (a, b) {
         *     console.log(a + b);
         * });
         * obj.fire('test', 1, 2); // prints 3 to the console
         */
        on: function (name, callback, scope) {
            if (!name || typeof name !== 'string' || !callback)
                return this;

            if (!this._callbacks[name])
                this._callbacks[name] = [];

            if (this._callbackActive[name] && this._callbackActive[name] === this._callbacks[name])
                this._callbackActive[name] = this._callbackActive[name].slice();

            this._callbacks[name].push({
                callback: callback,
                scope: scope || this
            });

            return this;
        },

        /**
         * @function
         * @name pc.EventHandler#off
         * @description Detach an event handler from an event. If callback is not provided then all callbacks are unbound from the event,
         * if scope is not provided then all events with the callback will be unbound.
         * @param {string} [name] - Name of the event to unbind.
         * @param {pc.callbacks.HandleEvent} [callback] - Function to be unbound.
         * @param {object} [scope] - Scope that was used as the this when the event is fired.
         * @returns {pc.EventHandler} Self for chaining.
         * @example
         * var handler = function () {
         * };
         * obj.on('test', handler);
         *
         * obj.off(); // Removes all events
         * obj.off('test'); // Removes all events called 'test'
         * obj.off('test', handler); // Removes all handler functions, called 'test'
         * obj.off('test', handler, this); // Removes all hander functions, called 'test' with scope this
         */
        off: function (name, callback, scope) {
            if (name) {
                if (this._callbackActive[name] && this._callbackActive[name] === this._callbacks[name])
                    this._callbackActive[name] = this._callbackActive[name].slice();
            } else {
                for (var key in this._callbackActive) {
                    if (!this._callbacks[key])
                        continue;

                    if (this._callbacks[key] !== this._callbackActive[key])
                        continue;

                    this._callbackActive[key] = this._callbackActive[key].slice();
                }
            }

            if (!name) {
                this._callbacks = { };
            } else if (!callback) {
                if (this._callbacks[name])
                    this._callbacks[name] = [];
            } else {
                var events = this._callbacks[name];
                if (!events)
                    return this;

                var count = events.length;

                for (var i = 0; i < count; i++) {
                    if (events[i].callback !== callback)
                        continue;

                    if (scope && events[i].scope !== scope)
                        continue;

                    events[i--] = events[--count];
                }
                events.length = count;
            }

            return this;
        },

        // ESLint rule disabled here as documenting arg1, arg2...argN as [...] rest
        // arguments is preferable to documenting each one individually.
        /* eslint-disable valid-jsdoc */
        /**
         * @function
         * @name pc.EventHandler#fire
         * @description Fire an event, all additional arguments are passed on to the event listener.
         * @param {object} name - Name of event to fire.
         * @param {*} [arg1] - First argument that is passed to the event handler.
         * @param {*} [arg2] - Second argument that is passed to the event handler.
         * @param {*} [arg3] - Third argument that is passed to the event handler.
         * @param {*} [arg4] - Fourth argument that is passed to the event handler.
         * @param {*} [arg5] - Fifth argument that is passed to the event handler.
         * @param {*} [arg6] - Sixth argument that is passed to the event handler.
         * @param {*} [arg7] - Seventh argument that is passed to the event handler.
         * @param {*} [arg8] - Eighth argument that is passed to the event handler.
         * @returns {pc.EventHandler} Self for chaining.
         * @example
         * obj.fire('test', 'This is the message');
         */
        /* eslint-enable valid-jsdoc */
        fire: function (name, arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8) {
            if (!name || !this._callbacks[name])
                return this;

            var callbacks;

            if (!this._callbackActive[name]) {
                this._callbackActive[name] = this._callbacks[name];
            } else {
                if (this._callbackActive[name] === this._callbacks[name])
                    this._callbackActive[name] = this._callbackActive[name].slice();

                callbacks = this._callbacks[name].slice();
            }

            // TODO: What does callbacks do here?
            // In particular this condition check looks wrong: (i < (callbacks || this._callbackActive[name]).length)
            // Because callbacks is not an integer
            // eslint-disable-next-line no-unmodified-loop-condition
            for (var i = 0; (callbacks || this._callbackActive[name]) && (i < (callbacks || this._callbackActive[name]).length); i++) {
                var evt = (callbacks || this._callbackActive[name])[i];
                evt.callback.call(evt.scope, arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8);

                if (evt.callback.once) {
                    var ind = this._callbacks[name].indexOf(evt);
                    if (ind !== -1) {
                        if (this._callbackActive[name] === this._callbacks[name])
                            this._callbackActive[name] = this._callbackActive[name].slice();

                        this._callbacks[name].splice(ind, 1);
                    }
                }
            }

            if (!callbacks)
                this._callbackActive[name] = null;

            return this;
        },

        /**
         * @function
         * @name pc.EventHandler#once
         * @description Attach an event handler to an event. This handler will be removed after being fired once.
         * @param {string} name - Name of the event to bind the callback to.
         * @param {pc.callbacks.HandleEvent} callback - Function that is called when event is fired. Note the callback is limited to 8 arguments.
         * @param {object} [scope] - Object to use as 'this' when the event is fired, defaults to current this.
         * @returns {pc.EventHandler} Self for chaining.
         * @example
         * obj.once('test', function (a, b) {
         *     console.log(a + b);
         * });
         * obj.fire('test', 1, 2); // prints 3 to the console
         * obj.fire('test', 1, 2); // not going to get handled
         */
        once: function (name, callback, scope) {
            callback.once = true;
            this.on(name, callback, scope);
            return this;
        },

        /**
         * @function
         * @name pc.EventHandler#hasEvent
         * @description Test if there are any handlers bound to an event name.
         * @param {string} name - The name of the event to test.
         * @returns {boolean} True if the object has handlers bound to the specified event name.
         * @example
         * obj.on('test', function () { }); // bind an event to 'test'
         * obj.hasEvent('test'); // returns true
         * obj.hasEvent('hello'); // returns false
         */
        hasEvent: function (name) {
            return (this._callbacks[name] && this._callbacks[name].length !== 0) || false;
        }
    });

    return {
        EventHandler: EventHandler
    };
}()));
