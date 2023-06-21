import { AnimSnapshot } from './anim-snapshot.js';

// TODO: add configurable looping start/end times?

/**
 * AnimClip wraps the running state of an animation track. It contains and update the animation
 * 'cursor' and performs looping logic.
 *
 * @ignore
 */
class AnimClip {
    /**
     * Create a new animation clip.
     *
     * @param {import('./anim-track.js').AnimTrack} track - The animation data.
     * @param {number} time - The initial time of the clip.
     * @param {number} speed - Speed of the animation playback.
     * @param {boolean} playing - true if the clip is playing and false otherwise.
     * @param {boolean} loop - Whether the clip should loop.
     * @param {import('../../../core/event-handler.js').EventHandler} [eventHandler] - The handler
     * to call when an event is fired by the clip.
     */
    constructor(track, time, speed, playing, loop, eventHandler) {
        this._name = track.name;        // default to track name
        this._track = track;
        this._snapshot = new AnimSnapshot(track);
        this._playing = playing;
        this._time = time;              // play cursor
        this._speed = speed;            // playback speed, may be negative
        this._loop = loop;              // whether to loop
        this._blendWeight = 1.0;        // blend weight 0..1
        this._blendOrder = 0.0;         // blend order relative to other clips
        this._eventHandler = eventHandler;
        this.alignCursorToCurrentTime();
    }

    set name(name) {
        this._name = name;
    }

    get name() {
        return this._name;
    }

    set track(track) {
        this._track = track;
        this._snapshot = new AnimSnapshot(track);
    }

    get track() {
        return this._track;
    }

    get snapshot() {
        return this._snapshot;
    }

    set time(time) {
        this._time = time;
        this.alignCursorToCurrentTime();
    }

    get time() {
        return this._time;
    }

    set speed(speed) {
        this._speed = speed;
        this.alignCursorToCurrentTime();
    }

    get speed() {
        return this._speed;
    }

    set loop(loop) {
        this._loop = loop;
    }

    get loop() {
        return this._loop;
    }

    set blendWeight(blendWeight) {
        this._blendWeight = blendWeight;
    }

    get blendWeight() {
        return this._blendWeight;
    }

    set blendOrder(blendOrder) {
        this._blendOrder = blendOrder;
    }

    get blendOrder() {
        return this._blendOrder;
    }

    set eventCursor(value) {
        this._eventCursor = value;
    }

    get eventCursor() {
        return this._eventCursor;
    }

    get eventCursorEnd() {
        return this.isReverse ? 0 : this._track.events.length - 1;
    }

    get nextEvent() {
        return this._track.events[this._eventCursor];
    }

    get isReverse() {
        return this._speed < 0;
    }

    nextEventAheadOfTime(time) {
        if (!this.nextEvent) return false;
        return this.isReverse ? this.nextEvent.time <= time : this.nextEvent.time >= time;
    }

    nextEventBehindTime(time) {
        if (!this.nextEvent) return false;
        if (time === this.track.duration) {
            return this.isReverse ? this.nextEvent.time >= time : this.nextEvent.time <= time;
        }
        return this.isReverse ? this.nextEvent.time > time : this.nextEvent.time < time;
    }

    resetEventCursor() {
        this._eventCursor = this.isReverse ? this._track.events.length - 1 : 0;
    }

    moveEventCursor() {
        this._eventCursor += (this.isReverse ? -1 : 1);
        if (this._eventCursor >= this.track.events.length) {
            this._eventCursor = 0;
        } else if (this._eventCursor < 0) {
            this._eventCursor = this.track.events.length - 1;
        }
    }

    clipFrameTime(frameEndTime) {
        const result = {
            startTime: 0,
            endTime: frameEndTime,
            duration: 0
        };

        // if this frame overlaps with the end of the track, we should clip off the end of the frame time then check that clipped time later
        if (this.isReverse) {
            if (frameEndTime < 0) {
                result.duration = frameEndTime + this.track.duration;
                result.startTime = this.track.duration;
                result.endTime = 0;
            }
        } else {
            if (frameEndTime > this.track.duration) {
                result.duration = frameEndTime - this.track.duration;
                result.startTime = 0;
                result.endTime = this.track.duration;
            }
        }
        return result;
    }

    alignCursorToCurrentTime() {
        this.resetEventCursor();
        while (this.nextEventBehindTime(this._time) && this._eventCursor !== this.eventCursorEnd) {
            this.moveEventCursor();
        }
    }

    fireNextEvent() {
        this._eventHandler.fire(this.nextEvent.name, { track: this.track, ...this.nextEvent });
        this.moveEventCursor();
    }

    fireNextEventInFrame(frameStartTime, frameEndTime) {
        if (this.nextEventAheadOfTime(frameStartTime) && this.nextEventBehindTime(frameEndTime)) {
            console.log('here');
            this.fireNextEvent();
            return true;
        }
        return false;
    }

    activeEventsForFrame(frameStartTime, frameEndTime) {
        // get frame start and end times clipped to the track duration with the residual duration stored
        const clippedFrame = this.clipFrameTime(frameEndTime);
        // fire all events that should fire during this clipped frame
        const initialCursor = this.eventCursor;
        while (this.fireNextEventInFrame(frameStartTime, clippedFrame.endTime)) {
            if (initialCursor === this.eventCursor) {
                break;
            }
        }
        // recurse the process until the residual duration is 0
        if (this.loop && Math.abs(clippedFrame.duration) > 0) {
            this.activeEventsForFrame(clippedFrame.startTime, clippedFrame.duration);
        }
    }

    progressForTime(time) {
        return (time * this._speed) / this._track.duration;
    }

    _update(deltaTime) {
        if (this._playing) {
            let time = this._time;
            const duration = this._track.duration;
            const speed = this._speed;
            const loop = this._loop;

            // check for events that should fire during this frame
            if (this._track.events.length > 0 && duration > 0) {
                this.activeEventsForFrame(time, time + speed * deltaTime);
            }

            // update time
            time += speed * deltaTime;

            // perform looping
            if (speed >= 0) {
                // playing forwards
                if (time > duration) {
                    if (loop) {
                        time = (time % duration) || 0;  // if duration is 0, % is NaN
                    } else {
                        time = this._track.duration;
                        this.pause();
                    }
                }
            } else {
                // playing backwards
                if (time < 0) {
                    if (loop) {
                        time = duration + ((time % duration) || 0);
                    } else {
                        time = 0;
                        this.pause();
                    }
                }
            }
            this._time = time;
        }

        // update snapshot if time has changed
        if (this._time !== this._snapshot._time) {
            this._track.eval(this._time, this._snapshot);
        }
    }

    play() {
        this._playing = true;
        this._time = 0;
    }

    stop() {
        this._playing = false;
        this._time = 0;
    }

    pause() {
        this._playing = false;
    }

    resume() {
        this._playing = true;
    }

    reset() {
        this._time = 0;
    }
}

export { AnimClip };
