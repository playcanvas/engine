/**
 * Event Handle that is created by {@link EventHandler} and can be used for easier removing and events management.
 * @example
 * const evt = obj.on('test', (a, b) => {
 *     console.log(a + b);
 * });
 * obj.fire('test');
 *
 * evt.off(); // easy way to remove this event
 * obj.fire('test'); // this will not trigger an event
 * @example
 * // store an array of event handles
 * let events = [ ];
 *
 * events.push(objA.on('testA', () => { }));
 * events.push(objB.on('testB', () => { }));
 *
 * // when needed, remove all events
 * events.forEach((evt) => {
 *     evt.off();
 * });
 * events = [ ];
 */
class EventHandle {
    /**
     * @type {import('./event-handler.js').EventHandler}
     * @private
     */
    handler;

    /**
     * @type {string}
     * @private
     */
    name;

    /**
     * @type {import('./event-handler.js').HandleEventCallback}
     * @ignore
     */
    callback;

    /**
     * @type {object}
     * @private
     */
    scope;

    /**
     * @type {boolean}
     * @ignore
     */
    once;

    /**
     * True if event has been removed.
     * @type {boolean}
     * @private
     */
    _removed = false;

    /**
     * @param {import('./event-handler.js').EventHandler} handler - source object of the event.
     * @param {string} name - Name of the event.
     * @param {import('./event-handler.js').HandleEventCallback} callback - Function that is called when event is fired.
     * @param {object} scope - Object that is used as `this` when event is fired.
     * @param {boolean} [once] - If this is a single event and will be removed after event is fired.
     */
    constructor(handler, name, callback, scope, once = false) {
        this.handler = handler;
        this.name = name;
        this.callback = callback;
        this.scope = scope;
        this.once = once;
    }

    /**
     * Remove references.
     */
    destroy() {
        if (this._removed) return;
        this._removed = true;
    }

    /**
     * Remove this event from its handler.
     */
    off() {
        if (this._removed) return;
        this.handler.off(this.name, this.callback, this.scope);
    }

    /**
     * True if event has been removed.
     * @type {boolean}
     */
    get removed() {
        return this._removed;
    }
}

export { EventHandle };
