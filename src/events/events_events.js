/**
 * @namespace
 * Event system that can be added to objects using pc.extend.
 * 
 * @example
 * var o = {};
 * o = pc.extend(o, events);
 * 
 * // bind event
 * o.bind("event_name", function() {
 *   alert('event_name fired');
 * });
 * 
 * // fire event
 * o.fire("event_name");
 *
 * o.unbind('event_name');
 */
pc.events = function () {
    
    return {
        /**
         * Bind an callback to an event 
         * @param {String} name Name of the event to bind callback to
         * @param {Function} callback Function that is called when event is fired
         * @param {Object} [scope] Object to use as 'this' when the event is fired, defaults to current this
         */
        bind: function (name, callback, scope) {
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
         * Unbind a callback from an event. If callback is not provided then all callbacks are unbound from the event, if scope is 
         * not provided then all events with the callback will be unbound
         * @param {String} name Name of the event to unbind
         * @param {Function} [callback] Function to be unbound
         * @param {Object} [scope] Scope is used as the this when the event is fired
         */
        unbind: function (name, callback, scope) {
            var callbacks = this._callbacks;
            var events;
            var index;

            if(!callback) {
                // Clear all callbacks
                callbacks[name] = [];
            } else {
                events = callbacks[name]
                if (!events) {
                    return this;
                }
                
                for(index = 0; index < events.length; index++) {
                    if(events[index].callback === callback) {
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
         * Fire an event, all additional arguments are passed on to the event listener
         * @param {Object} name Name of event to fire
         */
        fire: function (name) {
            var index;
            var length;
            var args = pc.makeArray(arguments);
            var callbacks;
            args.shift();
            
            if(this._callbacks && this._callbacks[name]) {
                callbacks = this._callbacks[name].slice(); // clone list so that deleting inside callbacks works
                length = callbacks.length;
                for(index = 0; index < length; ++index) {
                    var scope = callbacks[index].scope;
                    callbacks[index].callback.apply(scope, args);
                }            
            }
            
            return this;
        }
    };
} ();
