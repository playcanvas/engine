/**
 * Callback used by {@link EventHandler} functions. Note the callback is limited to 8 arguments.
 *
 * @callback HandleEventCallback
 * @param {*} [arg1] - First argument that is passed from caller.
 * @param {*} [arg2] - Second argument that is passed from caller.
 * @param {*} [arg3] - Third argument that is passed from caller.
 * @param {*} [arg4] - Fourth argument that is passed from caller.
 * @param {*} [arg5] - Fifth argument that is passed from caller.
 * @param {*} [arg6] - Sixth argument that is passed from caller.
 * @param {*} [arg7] - Seventh argument that is passed from caller.
 * @param {*} [arg8] - Eighth argument that is passed from caller.
 */

/**
 * Abstract base class that implements functionality for event handling.
 *
 * ```javascript
 * const obj = new EventHandlerSubclass();
 *
 * // subscribe to an event
 * obj.on('hello', function (str) {
 *     console.log('event hello is fired', str);
 * });
 *
 * // fire event
 * obj.fire('hello', 'world');
 * ```
 */
class EventHandler {
    /**
     * @type {Map<string,Array<object>>}
     * @private
     */
    _callbacks = new Map();

    /**
     * @type {Map<string,Array<object>>}
     * @private
     */
    _callbackActive = new Map();

    /**
     * Reinitialize the event handler.
     * @ignore
     */
    initEventHandler() {
        this._callbacks = new Map();
        this._callbackActive = new Map();
    }

    /**
     * Registers a new event handler.
     *
     * @param {string} name - Name of the event to bind the callback to.
     * @param {HandleEventCallback} callback - Function that is called when event is fired. Note
     * the callback is limited to 8 arguments.
     * @param {object} scope - Object to use as 'this' when the event is fired, defaults to
     * current this.
     * @param {boolean} once - If true, the callback will be unbound after being fired once.
     * @ignore
     */
    _addCallback(name, callback, scope, once) {
        if (!name || typeof name !== 'string' || !callback)
            return;

        if (!this._callbacks.has(name))
            this._callbacks.set(name, []);

        // if we are adding a callback to the list that is executing right now
        // ensure we preserve initial list before modifications
        if (this._callbackActive.has(name)) {
            const callbackActive = this._callbackActive.get(name);
            if (callbackActive && callbackActive === this._callbacks.get(name)) {
                this._callbackActive.set(name, callbackActive.slice());
            }
        }

        this._callbacks.get(name).push({
            callback: callback,
            scope: scope,
            once: once
        });
    }

    /**
     * Attach an event handler to an event.
     *
     * @param {string} name - Name of the event to bind the callback to.
     * @param {HandleEventCallback} callback - Function that is called when event is fired. Note
     * the callback is limited to 8 arguments.
     * @param {object} [scope] - Object to use as 'this' when the event is fired, defaults to
     * current this.
     * @returns {EventHandler} Self for chaining.
     * @example
     * obj.on('test', function (a, b) {
     *     console.log(a + b);
     * });
     * obj.fire('test', 1, 2); // prints 3 to the console
     */
    on(name, callback, scope = this) {
        this._addCallback(name, callback, scope, false);
        return this;
    }

    /**
     * Attach an event handler to an event. This handler will be removed after being fired once.
     *
     * @param {string} name - Name of the event to bind the callback to.
     * @param {HandleEventCallback} callback - Function that is called when event is fired. Note
     * the callback is limited to 8 arguments.
     * @param {object} [scope] - Object to use as 'this' when the event is fired, defaults to
     * current this.
     * @returns {EventHandler} Self for chaining.
     * @example
     * obj.once('test', function (a, b) {
     *     console.log(a + b);
     * });
     * obj.fire('test', 1, 2); // prints 3 to the console
     * obj.fire('test', 1, 2); // not going to get handled
     */
    once(name, callback, scope = this) {
        this._addCallback(name, callback, scope, true);
        return this;
    }

    /**
     * Detach an event handler from an event. If callback is not provided then all callbacks are
     * unbound from the event, if scope is not provided then all events with the callback will be
     * unbound.
     *
     * @param {string} [name] - Name of the event to unbind.
     * @param {HandleEventCallback} [callback] - Function to be unbound.
     * @param {object} [scope] - Scope that was used as the this when the event is fired.
     * @returns {EventHandler} Self for chaining.
     * @example
     * const handler = function () {
     * };
     * obj.on('test', handler);
     *
     * obj.off(); // Removes all events
     * obj.off('test'); // Removes all events called 'test'
     * obj.off('test', handler); // Removes all handler functions, called 'test'
     * obj.off('test', handler, this); // Removes all handler functions, called 'test' with scope this
     */
    off(name, callback, scope) {
        if (name) {
            // if we are removing a callback from the list that is executing right now
            // ensure we preserve initial list before modifications
            if (this._callbackActive.has(name) && this._callbackActive.get(name) === this._callbacks.get(name))
                this._callbackActive.set(name, this._callbackActive.get(name).slice());
        } else {
            // if we are removing a callback from any list that is executing right now
            // ensure we preserve these initial lists before modifications
            for (const [key, callbacks] of this._callbackActive) {
                if (!this._callbacks.has(key))
                    continue;

                if (this._callbacks.get(key) !== callbacks)
                    continue;

                this._callbackActive.set(key, callbacks.slice());
            }
        }

        if (!name) {
            // remove all events
            this._callbacks.clear();
        } else if (!callback) {
            // remove all events of a specific name
            if (this._callbacks.has(name))
                this._callbacks.delete(name);
        } else {
            const events = this._callbacks.get(name);
            if (!events)
                return this;

            let count = events.length;

            for (let i = 0; i < count; i++) {
                // remove all events with a specific name and a callback
                if (events[i].callback !== callback)
                    continue;

                // could be a specific scope as well
                if (scope && events[i].scope !== scope)
                    continue;

                events[i--] = events[--count];
            }

            events.length = count;

            if (events.length === 0)
                this._callbacks.delete(name);
        }

        return this;
    }

    /**
     * Fire an event, all additional arguments are passed on to the event listener.
     *
     * @param {string} name - Name of event to fire.
     * @param {*} [arg1] - First argument that is passed to the event handler.
     * @param {*} [arg2] - Second argument that is passed to the event handler.
     * @param {*} [arg3] - Third argument that is passed to the event handler.
     * @param {*} [arg4] - Fourth argument that is passed to the event handler.
     * @param {*} [arg5] - Fifth argument that is passed to the event handler.
     * @param {*} [arg6] - Sixth argument that is passed to the event handler.
     * @param {*} [arg7] - Seventh argument that is passed to the event handler.
     * @param {*} [arg8] - Eighth argument that is passed to the event handler.
     * @returns {EventHandler} Self for chaining.
     * @example
     * obj.fire('test', 'This is the message');
     */
    fire(name, arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8) {
        if (!name)
            return this;

        const callbacksInitial = this._callbacks.get(name);
        if (!callbacksInitial)
            return this;

        let callbacks;

        if (!this._callbackActive.has(name)) {
            // when starting callbacks execution ensure we store a list of initial callbacks
            this._callbackActive.set(name, callbacksInitial);
        } else if (this._callbackActive.get(name) !== callbacksInitial) {
            // if we are trying to execute a callback while there is an active execution right now
            // and the active list has been already modified,
            // then we go to an unoptimized path and clone callbacks list to ensure execution consistency
            callbacks = callbacksInitial.slice();
        }

        // eslint-disable-next-line no-unmodified-loop-condition
        for (let i = 0; (callbacks || this._callbackActive.get(name)) && (i < (callbacks || this._callbackActive.get(name)).length); i++) {
            const evt = (callbacks || this._callbackActive.get(name))[i];
            evt.callback.call(evt.scope, arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8);

            if (evt.once) {
                // check that callback still exists because user may have unsubscribed in the event handler
                const existingCallback = this._callbacks.get(name);
                const ind = existingCallback ? existingCallback.indexOf(evt) : -1;

                if (ind !== -1) {
                    if (this._callbackActive.get(name) === existingCallback)
                        this._callbackActive.set(name, this._callbackActive.get(name).slice());

                    const callbacks = this._callbacks.get(name);
                    if (!callbacks) continue;
                    callbacks.splice(ind, 1);

                    if (callbacks.length === 0)
                        this._callbacks.delete(name);
                }
            }
        }

        if (!callbacks)
            this._callbackActive.delete(name);

        return this;
    }

    /**
     * Test if there are any handlers bound to an event name.
     *
     * @param {string} name - The name of the event to test.
     * @returns {boolean} True if the object has handlers bound to the specified event name.
     * @example
     * obj.on('test', function () { }); // bind an event to 'test'
     * obj.hasEvent('test'); // returns true
     * obj.hasEvent('hello'); // returns false
     */
    hasEvent(name) {
        return !!this._callbacks.get(name)?.length;
    }
}

export { EventHandler };
