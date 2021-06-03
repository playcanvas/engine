/**
 * @class
 * @name AnimEvents
 * @classdesc AnimEvents stores a sorted array of animation events which should fire sequentially during the playback of an pc.AnimTrack.
 * @description Create a new collection of animation events.
 * - @param {object[]}  events- An array of animation events.
 */
class AnimEvents {
    constructor(events) {
        events.sort((a, b) => a.time - b.time);
        this._events = events;
    }

    get events() {
        return this._events;
    }
}

export { AnimEvents };
