import { EventHandler } from './event-handler.js';

const events = {
    /**
     * Attach event methods 'on', 'off', 'fire', 'once' and 'hasEvent' to the target object.
     *
     * @param {object} target - The object to add events to.
     * @returns {object} The target object.
     * @example
     * const obj = { };
     * pc.events.attach(obj);
     * @ignore
     */
    attach(target) {
        const ev = events;
        target._addCallback = ev._addCallback;
        target.on = ev.on;
        target.off = ev.off;
        target.fire = ev.fire;
        target.once = ev.once;
        target.hasEvent = ev.hasEvent;
        EventHandler.prototype.initEventHandler.call(target);
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
