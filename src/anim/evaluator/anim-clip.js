import { AnimSnapshot } from './anim-snapshot.js';

/**
 * @private
 * @class
 * @name AnimClip
 * @classdesc AnimClip wraps the running state of an animation track. It contains and update
 * the animation 'cursor' and performs looping logic.
 * @description Create a new animation clip.
 * @param {pc.AnimTrack} track - the animation data.
 * @param {number} time - the initial time of the clip.
 * @param {number} speed - speed of the animation playback.
 * @param {boolean} playing - true if the clip is playing and false otherwise.
 * @param {boolean} loop - whether the clip should loop.
 */
// TODO: add configurable looping start/end times?
class AnimClip {
    constructor(track, time, speed, playing, loop) {
        this._name = track.name;        // default to track name
        this._track = track;
        this._snapshot = new AnimSnapshot(track);
        this._playing = playing;
        this._time = time;              // play cursor
        this._speed = speed;            // playback speed, may be negative
        this._loop = loop;              // whether to loop
        this._blendWeight = 1.0;        // blend weight 0..1
        this._blendOrder = 0.0;         // blend order relative to other clips
    }

    get name() {
        return this._name;
    }

    set name(name) {
        this._name = name;
    }

    get track() {
        return this._track;
    }

    get snapshot() {
        return this._snapshot;
    }

    get time() {
        return this._time;
    }

    set time(time) {
        this._time = time;
    }

    get speed() {
        return this._speed;
    }

    set speed(speed) {
        this._speed = speed;
    }

    get loop() {
        return this._loop;
    }

    set loop(loop) {
        this._loop = loop;
    }

    get blendWeight() {
        return this._blendWeight;
    }

    set blendWeight(blendWeight) {
        this._blendWeight = blendWeight;
    }

    get blendOrder() {
        return this._blendOrder;
    }

    set blendOrder(blendOrder) {
        this._blendOrder = blendOrder;
    }

    _update(deltaTime) {
        if (this._playing) {
            var time = this._time;
            var duration = this._track.duration;
            var speed = this._speed;
            var loop = this._loop;

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
        if (this._time != this._snapshot._time) {
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
