/**
 * AnimEvents stores a sorted array of animation events which should fire sequentially during the
 * playback of an {@link AnimTrack}. Each event is an object with a `name` and a `time` in
 * seconds plus any extra properties you attach. When playback passes an event's time it is fired
 * on the {@link AnimComponent} under the event's name, so a script listens with
 * `entity.anim.on('footstep', callback)` and receives the event object.
 *
 * @category Animation
 */
class AnimEvents {
    /**
     * Create a new AnimEvents instance.
     *
     * @param {object[]} events - An array of animation events.
     * @example
     * const events = new AnimEvents([
     *     {
     *         name: 'my_event',
     *         time: 1.3, // given in seconds
     *         // any additional properties added are optional and will be available in the EventHandler callback's event object
     *         myProperty: 'test',
     *         myOtherProperty: true
     *     }
     * ]);
     * animTrack.events = events;
     */
    constructor(events) {
        this._events = [...events];
        this._events.sort((a, b) => a.time - b.time);
    }

    get events() {
        return this._events;
    }
}

export { AnimEvents };
