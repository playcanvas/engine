/**
 * Callback used by {@link EventHandler} functions.
 *
 * @callback HandleEventCallback
 * @param {...*} args - Arguments that are passed to the event handler.
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
     * @type {Map<string, object[]>}
     * @private
     */
    _callbacks = new Map();

    /**
     * Reinitialize the event handler.
     *
     * @ignore
     */
    initEventHandler() {
        this._callbacks = new Map();
    }

    /**
     * Registers a new event handler.
     *
     * @param {string} name - Name of the event to bind the callback to.
     * @param {HandleEventCallback} callback - Function that is called when event is fired. Note
     * the callback is limited to 8 arguments.
     * @param {object} scope - Object to use as 'this' when the event is fired, defaults to current
     * this.
     * @param {boolean} once - Set to true to have the handler remove itself after being called for
     * the first time.
     * @private
     */
    _addCallback(name, callback, scope, once) {
        if (!name || typeof name !== 'string' || typeof callback !== 'function')
            return;

        if (!this._callbacks.has(name))
            this._callbacks.set(name, []);

        this._callbacks.get(name).push({ callback, scope, once });
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
        if (!name) {
            this._callbacks.clear();
            return this;
        }

        const handlers = this._callbacks.get(name);
        if (!handlers) return this;

        if (callback) {
            let i = handlers.length;
            while (i--) {
                if (handlers[i].callback === callback && handlers[i].scope === scope) {
                    handlers.splice(i, 1);
                }
            }
            if (handlers.length === 0) {
                this._callbacks.delete(name);
            }
        } else {
            this._callbacks.delete(name);
        }

        return this;
    }

    /**
     * Fire an event, all additional arguments are passed on to the event listener.
     *
     * @param {string} name - Name of event to fire.
     * @param {...*} args - Arguments that are passed to the event handler.
     * @returns {EventHandler} Self for chaining.
     * @example
     * obj.fire('test', 'This is the message');
     */
    fire(name, ...args) {
        if (!name || !this._callbacks.has(name)) return this;

        const handlers = this._callbacks.get(name);
        if (!handlers) return this;

        for (let i = 0; i < handlers.length; i++) {
            const handler = handlers[i];
            handler.callback.apply(handler.scope, args);

            if (handler.once) {
                handlers.splice(i, 1);
                i--; // Adjust the index after removing an item to keep the correct order
            }
        }

        if (handlers.length === 0) {
            this._callbacks.delete(name);
        }

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
        return this._callbacks.has(name) && this._callbacks.get(name).length > 0;
    }
}

export { EventHandler };
