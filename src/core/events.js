pc.events = {
    /**
     * @private
     * @function
     * @name pc.events.attach
     * @description Attach event methods 'on', 'off', 'fire', 'once' and 'hasEvent' to the
     * target object.
     * @param {object} target - The object to add events to.
     * @returns {object} The target object.
     * @example
     * var obj = { };
     * pc.events.attach(obj);
     */
    attach: function (target) {
        var ev = pc.events;
        target._addCallback = ev._addCallback;
        target.on = ev.on;
        target.off = ev.off;
        target.fire = ev.fire;
        target.once = ev.once;
        target.hasEvent = ev.hasEvent;
        target._callbacks = { };
        target._callbackActive = { };
        return target;
    },

    _addCallback: pc.EventHandler.prototype._addCallback,
    on: pc.EventHandler.prototype.on,
    off: pc.EventHandler.prototype.off,
    fire: pc.EventHandler.prototype.fire,
    once: pc.EventHandler.prototype.once,
    hasEvent: pc.EventHandler.prototype.hasEvent
};
