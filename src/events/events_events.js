/**
 * @namespace
 * Event system that can be added to objects using pc.extend.
 * e.g.
 * <pre>
 * <code>
 * var o = {};
 * o = o.extend(o, events);
 * 
 * // bind event
 * o.bind("event_name", function() {});
 * 
 * // fire event
 * o.fire("event_name");
 * </code>
 * </pre>
 */
pc.events = function () {
    
    return {
        /**
         * Bind an callback to an event 
         * @param {String} name Name of the event to bind callback to
         * @param {Function} callback Function that is called when event is fired
         */
        bind: function (name, callback) {
            if(pc.type(name) != "string") {
                throw new TypeError("Event name must be a string");
            }
            var callbacks = this._callbacks || (this._callbacks = {});
            var events = callbacks[name] || (callbacks[name] = []);
            events.push(callback);
            
            return this;
        },
        
        /**
         * Unbind a callback from an event. If callback is not provided then all callbacks are unbound from the event
         * @param {String} name Name of the event to unbind
         * @param {Function} callback Function to be unbound
         */
        unbind: function (name, callback) {
            var callbacks = this._callbacks,
            events,
            index;
            
            if(!callback) {
                callbacks[name] = [];
            } else {
                events = callbacks[name]
                if (!events) {
                    return this;
                }
                for(index = 0; index < events.length; ++index) {
                    if(events[index] === callback) {
                        events.splice(index, 1);
                        break;
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
            var index,
            length,
            args = pc.makeArray(arguments);
            args.shift();
            
            if(this._callbacks && this._callbacks[name]) {
                length = this._callbacks[name].length;
                for(index = 0; index < length; ++index) {
                    this._callbacks[name][index].apply(this, args);
                }            
            }
            
            return this;
        }
    };
} ();
