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
     * @type {EventHandler}
     * @private
     */
    handler;

    /**
     * @type {string}
     * @private
     */
    name;

    /**
     * @type {HandleEventCallback}
     * @private
     */
    callback;

    /**
     * @type {object}
     * @private
     */
    scope;

    /**
     * @type {boolean}
     * @private
     */
    once;

    /**
     * True if event has been removed.
     * @type {boolean}
     */
    removed = false;

    /**
     * @param {EventHandler} handler - source object of the event.
     * @param {string} name - Name of the event.
     * @param {HandleEventCallback} callback - Function that is called when event is fired.
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
        if (this.removed) return;
        this.removed = true;
        this.handler = null;
        this.callback = null;
        this.scope = null;
    }

    /**
     * Remove this event from its handler.
     */
    off() {
        if (this.removed) return;
        this.handler.off(this.name, this.callback, this.scope);
    }
}

export { EventHandle };