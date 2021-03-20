import { EventHandler } from './event-handler.js';

var events = {
    /**
     * @private
     * @function
     * @name events.attach
     * @description Attach event methods 'on', 'off', 'fire', 'once' and 'hasEvent' to the
     * target object.
     * @param {object} target - The object to add events to.
     * @returns {object} The target object.
     * @example
     * var obj = { };
     * pc.events.attach(obj);
     */
    attach: function (target) {
        var ev = events;
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

    _addCallback: EventHandler.prototype._addCallback,
    on: EventHandler.prototype.on,
    off: EventHandler.prototype.off,
    fire: EventHandler.prototype.fire,
    once: EventHandler.prototype.once,
    hasEvent: EventHandler.prototype.hasEvent
};

export { events };
