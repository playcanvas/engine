import { EventHandler } from '../core/event-handler.js';

import { math } from '../math/math.js';

import { hasAudioContext } from '../audio/capabilities.js';

/** @typedef {import('./sound.js').Sound} Sound */
/** @typedef {import('./manager.js').SoundManager} SoundManager */

const STATE_PLAYING = 0;
const STATE_PAUSED = 1;
const STATE_STOPPED = 2;

/**
 * Return time % duration but always return a number instead of NaN when duration is 0.
 *
 * @param {number} time - The time.
 * @param {number} duration - The duration.
 * @returns {number} The time % duration.
 * @ignore
 */
function capTime(time, duration) {
    return (time % duration) || 0;
}

/**
 * A SoundInstance plays a {@link Sound}.
 *
 * @augments EventHandler
 */
class SoundInstance extends EventHandler {
    /**
     * Gets the source that plays the sound resource. If the Web Audio API is not supported the
     * type of source is [Audio](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/audio).
     * Source is only available after calling play.
     *
     * @type {AudioBufferSourceNode}
     */
    source = null;

    /**
     * Create a new SoundInstance instance.
     *
     * @param {SoundManager} manager - The sound manager.
     * @param {Sound} sound - The sound to play.
     * @param {object} options - Options for the instance.
     * @param {number} [options.volume=1] - The playback volume, between 0 and 1.
     * @param {number} [options.pitch=1] - The relative pitch, default of 1, plays at normal pitch.
     * @param {boolean} [options.loop=false] - Whether the sound should loop when it reaches the
     * end or not.
     * @param {number} [options.startTime=0] - The time from which the playback will start in
     * seconds. Default is 0 to start at the beginning.
     * @param {number} [options.duration=0] - The total time after the startTime in seconds when
     * playback will stop or restart if loop is true.
     * @param {Function} [options.onPlay=null] - Function called when the instance starts playing.
     * @param {Function} [options.onPause=null] - Function called when the instance is paused.
     * @param {Function} [options.onResume=null] - Function called when the instance is resumed.
     * @param {Function} [options.onStop=null] - Function called when the instance is stopped.
     * @param {Function} [options.onEnd=null] - Function called when the instance ends.
     */
    constructor(manager, sound, options) {
        super();

        /**
         * @type {SoundManager}
         * @private
         */
        this._manager = manager;

        /**
         * @type {number}
         * @private
         */
        this._volume = options.volume !== undefined ? math.clamp(Number(options.volume) || 0, 0, 1) : 1;

        /**
         * @type {number}
         * @private
         */
        this._pitch = options.pitch !== undefined ? Math.max(0.01, Number(options.pitch) || 0) : 1;

        /**
         * @type {boolean}
         * @private
         */
        this._loop = !!(options.loop !== undefined ? options.loop : false);

        /**
         * @type {Sound}
         * @private
         */
        this._sound = sound;

        /**
         * Start at 'stopped'.
         *
         * @type {number}
         * @private
         */
        this._state = STATE_STOPPED;

        /**
         * True if the manager was suspended.
         *
         * @type {boolean}
         * @private
         */
        this._suspended = false;

        /**
         * Greater than 0 if we want to suspend the event handled to the 'onended' event.
         * When an 'onended' event is suspended, this counter is decremented by 1.
         * When a future 'onended' event is to be suspended, this counter is incremented by 1.
         *
         * @type {number}
         * @private
         */
        this._suspendEndEvent = 0;

        /**
         * True if we want to suspend firing instance events.
         *
         * @type {boolean}
         * @private
         */
        this._suspendInstanceEvents = false;

        /**
         * If true then the instance will start playing its source when its created.
         *
         * @type {boolean}
         * @private
         */
        this._playWhenLoaded = true;

        /**
         * Set to true if a play() request was issued when the AudioContext was still suspended,
         * and will therefore wait until it is resumed to play the audio.
         *
         * @type {boolean}
         * @private
         */
        this._waitingContextSuspension = false;

        /**
         * Set to true if a stop() request was issued while _waitingContextSuspension was also true.
         *
         * @type {boolean}
         * @private
         */
        this._stopOnWaitingContextSuspension = false;

        /**
         * Set to true if a pause() request was issued while _waitingContextSuspension was also true.
         *
         * @type {boolean}
         * @private
         */
        this._pauseOnWaitingContextSuspension = false;

        /**
         * @type {number}
         * @private
         */
        this._startTime = Math.max(0, Number(options.startTime) || 0);

        /**
         * @type {number}
         * @private
         */
        this._duration = Math.max(0, Number(options.duration) || 0);

        /**
         * @type {number|null}
         * @private
         */
        this._startOffset = null;

        // external event handlers
        /** @private */
        this._onPlayCallback = options.onPlay;
        /** @private */
        this._onPauseCallback = options.onPause;
        /** @private */
        this._onResumeCallback = options.onResume;
        /** @private */
        this._onStopCallback = options.onStop;
        /** @private */
        this._onEndCallback = options.onEnd;

        if (hasAudioContext()) {
            /**
             * @type {number}
             * @private
             */
            this._startedAt = 0;

            /**
             * Manually keep track of the playback position because the Web Audio API does not
             * provide a way to do this accurately if the playbackRate is not 1.
             *
             * @type {number}
             * @private
             */
            this._currentTime = 0;

            /**
             * @type {number}
             * @private
             */
            this._currentOffset = 0;

            /**
             * The input node is the one that is connected to the source.
             *
             * @type {AudioNode|null}
             * @private
             */
            this._inputNode = null;

            /**
             * The connected node is the one that is connected to the destination (speakers). Any
             * external nodes will be connected to this node.
             *
             * @type {AudioNode|null}
             * @private
             */
            this._connectorNode = null;

            /**
             * The first external node set by a user.
             *
             * @type {AudioNode|null}
             * @private
             */
            this._firstNode = null;

            /**
             * The last external node set by a user.
             *
             * @type {AudioNode|null}
             * @private
             */
            this._lastNode = null;

            this._initializeNodes();

            /** @private */
            this._endedHandler = this._onEnded.bind(this);
        } else {
            /** @private */
            this._isReady = false;

            /** @private */
            this._loadedMetadataHandler = this._onLoadedMetadata.bind(this);
            /** @private */
            this._timeUpdateHandler = this._onTimeUpdate.bind(this);
            /** @private */
            this._endedHandler = this._onEnded.bind(this);

            this._createSource();
        }
    }

    /**
     * Fired when the instance starts playing its source.
     *
     * @event SoundInstance#play
     */

    /**
     * Fired when the instance is paused.
     *
     * @event SoundInstance#pause
     */

    /**
     * Fired when the instance is resumed.
     *
     * @event SoundInstance#resume
     */

    /**
     * Fired when the instance is stopped.
     *
     * @event SoundInstance#stop
     */

    /**
     * Fired when the sound currently played by the instance ends.
     *
     * @event SoundInstance#end
     */

    /**
     * Gets or sets the current time of the sound that is playing. If the value provided is bigger
     * than the duration of the instance it will wrap from the beginning.
     *
     * @type {number}
     */
    set currentTime(value) {
        if (value < 0) return;

        if (this._state === STATE_PLAYING) {
            const suspend = this._suspendInstanceEvents;
            this._suspendInstanceEvents = true;

            // stop first which will set _startOffset to null
            this.stop();

            // set _startOffset and play
            this._startOffset = value;
            this.play();
            this._suspendInstanceEvents = suspend;
        } else {
            // set _startOffset which will be used when the instance will start playing
            this._startOffset = value;
            // set _currentTime
            this._currentTime = value;
        }
    }

    get currentTime() {
        // if the user has set the currentTime and we have not used it yet
        // then just return that
        if (this._startOffset !== null) {
            return this._startOffset;
        }

        // if the sound is paused return the currentTime calculated when
        // pause() was called
        if (this._state === STATE_PAUSED) {
            return this._currentTime;
        }

        // if the sound is stopped or we don't have a source
        // return 0
        if (this._state === STATE_STOPPED || !this.source) {
            return 0;
        }

        // recalculate current time
        this._updateCurrentTime();
        return this._currentTime;
    }

    /**
     * The duration of the sound that the instance will play starting from startTime.
     *
     * @type {number}
     */
    set duration(value) {
        this._duration = Math.max(0, Number(value) || 0);

        // restart
        const isPlaying = this._state === STATE_PLAYING;
        this.stop();
        if (isPlaying) {
            this.play();
        }
    }

    get duration() {
        if (!this._sound) {
            return 0;
        }
        if (this._duration) {
            return capTime(this._duration, this._sound.duration);
        }
        return this._sound.duration;
    }

    /**
     * Returns true if the instance is currently paused.
     *
     * @type {boolean}
     */
    get isPaused() {
        return this._state === STATE_PAUSED;
    }

    /**
     * Returns true if the instance is currently playing.
     *
     * @type {boolean}
     */
    get isPlaying() {
        return this._state === STATE_PLAYING;
    }

    /**
     * Returns true if the instance is currently stopped.
     *
     * @type {boolean}
     */
    get isStopped() {
        return this._state === STATE_STOPPED;
    }

    /**
     * Returns true if the instance is currently suspended because the window is not focused.
     *
     * @type {boolean}
     */
    get isSuspended() {
        return this._suspended;
    }

    /**
     * If true the instance will restart when it finishes playing.
     *
     * @type {boolean}
     */
    set loop(value) {
        this._loop = !!value;
        if (this.source) {
            this.source.loop = this._loop;
        }
    }

    get loop() {
        return this._loop;
    }

    /**
     * The pitch modifier to play the sound with. Must be larger than 0.01.
     *
     * @type {number}
     */
    set pitch(pitch) {
        // set offset to current time so that
        // we calculate the rest of the time with the new pitch
        // from now on
        this._currentOffset = this.currentTime;
        this._startedAt = this._manager.context.currentTime;

        this._pitch = Math.max(Number(pitch) || 0, 0.01);
        if (this.source) {
            this.source.playbackRate.value = this._pitch;
        }
    }

    get pitch() {
        return this._pitch;
    }

    /**
     * The sound resource that the instance will play.
     *
     * @type {Sound}
     */
    set sound(value) {
        this._sound = value;

        if (this._state !== STATE_STOPPED) {
            this.stop();
        } else {
            this._createSource();
        }
    }

    get sound() {
        return this._sound;
    }

    /**
     * The start time from which the sound will start playing.
     *
     * @type {number}
     */
    set startTime(value) {
        this._startTime = Math.max(0, Number(value) || 0);

        // restart
        const isPlaying = this._state === STATE_PLAYING;
        this.stop();
        if (isPlaying) {
            this.play();
        }
    }

    get startTime() {
        return this._startTime;
    }

    /**
     * The volume modifier to play the sound with. In range 0-1.
     *
     * @type {number}
     */
    set volume(volume) {
        volume = math.clamp(volume, 0, 1);
        this._volume = volume;
        if (this.gain) {
            this.gain.gain.value = volume * this._manager.volume;
        }
    }

    get volume() {
        return this._volume;
    }

    /** @private */
    _onPlay() {
        this.fire('play');

        if (this._onPlayCallback)
            this._onPlayCallback(this);
    }

    /** @private */
    _onPause() {
        this.fire('pause');

        if (this._onPauseCallback)
            this._onPauseCallback(this);
    }

    /** @private */
    _onResume() {
        this.fire('resume');

        if (this._onResumeCallback)
            this._onResumeCallback(this);
    }

    /** @private */
    _onStop() {
        this.fire('stop');

        if (this._onStopCallback)
            this._onStopCallback(this);
    }

    /** @private */
    _onEnded() {
        console.log(`instance:_onEnded()`);

        // the callback is not fired synchronously
        // so only decrement _suspendEndEvent when the
        // callback is fired
        if (this._suspendEndEvent > 0) {
            this._suspendEndEvent--;
            return;
        }

        this.fire('end');

        if (this._onEndCallback)
            this._onEndCallback(this);

        this.stop();
    }

    /**
     * Handle the manager's 'volumechange' event.
     *
     * @private
     */
    _onManagerVolumeChange() {
        this.volume = this._volume;
    }

    /**
     * Handle the manager's 'suspend' event.
     *
     * @private
     */
    _onManagerSuspend() {
        console.log(`instance._onManagerSuspend()`);
        if (this._state === STATE_PLAYING && !this._suspended) {
            this._suspended = true;
            this.pause();
        }
    }

    /**
     * Handle the manager's 'resume' event.
     *
     * @private
     */
    _onManagerResume() {
        console.log(`instance._onManagerResume()`);
        if (this._suspended) {
            this._suspended = false;
            this.resume();
        }
    }

    /**
     * Creates internal audio nodes and connects them.
     *
     * @private
     */
    _initializeNodes() {
        // create gain node for volume control
        this.gain = this._manager.context.createGain();
        this._inputNode = this.gain;
        // the gain node is also the connector node for 2D sound instances
        this._connectorNode = this.gain;
        this._connectorNode.connect(this._manager.context.destination);
    }

    /**
     * Attempt to begin playback the sound.
     * If the AudioContext is suspended, the audio will only start once it's resumed.
     * If the sound is already playing, this will restart the sound.
     *
     * @returns {boolean} True if the sound was started immediately.
     */
    play() {
        if (this._state !== STATE_STOPPED) {
            this.stop();
        }
        // set state to playing
        this._state = STATE_PLAYING;
        // no need for this anymore
        this._playWhenLoaded = false;

        // reset pause and stop flags
        this._pauseOnWaitingContextSuspension = false;
        this._stopOnWaitingContextSuspension = false;

        // play() was already issued but hasn't actually started yet
        if (this._waitingContextSuspension) {
            return false;
        }

        // manager is suspended so audio cannot start now - wait for manager to resume
        if (this._manager.suspended) {
            console.log(`instance.play(): manager is suspended, waiting for 'resume'`);
            this._manager.once('resume', this._playAudioImmediate, this);
            this._waitingContextSuspension = true;

            return false;
        }

        console.log(`instance.play(): manager is not suspended, playing now!`);
        this._playAudioImmediate();

        return true;
    }

    /**
     * Immediately play the sound.
     * This method assumes the AudioContext is ready (not suspended or locked).
     *
     * @private
     */
    _playAudioImmediate() {
        console.log(`instance.play.playAudio()`);
        this._waitingContextSuspension = false;

        if (!this.source) {
            this._createSource();
        }

        // calculate start offset
        let offset = capTime(this._startOffset, this.duration);
        offset = capTime(this._startTime + offset, this._sound.duration);
        // reset start offset now that we started the sound
        this._startOffset = null;

        // start source with specified offset and duration
        if (this._duration) {
            this.source.start(0, offset, this._duration);
        } else {
            this.source.start(0, offset);
        }

        // reset times
        this._startedAt = this._manager.context.currentTime;
        this._currentTime = 0;
        this._currentOffset = offset;

        // Initialize volume and loop - note moved to be after start() because of Chrome bug
        this.volume = this._volume;
        this.loop = this._loop;
        this.pitch = this._pitch;

        // handle suspend events / volumechange events
        this._manager.on('volumechange', this._onManagerVolumeChange, this);
        this._manager.on('suspend', this._onManagerSuspend, this);
        this._manager.on('resume', this._onManagerResume, this);
        this._manager.on('destroy', this._onManagerDestroy, this);

        if (!this._suspendInstanceEvents) {
            this._onPlay();
        }

        if (this._pauseOnWaitingContextSuspension) {
            console.log(`instance.play.playAudio(): _pauseOnWaitingContextSuspension`);
            this._pauseOnWaitingContextSuspension = false;
            this.pause();
        }
        if (this._stopOnWaitingContextSuspension) {
            console.log(`instance.play.playAudio(): _stopOnWaitingContextSuspension`);
            this._stopOnWaitingContextSuspension = false;
            this.stop();
        }
    }

    /**
     * Pauses playback of sound. Call resume() to resume playback from the same position.
     *
     * @returns {boolean} Returns true if the sound was paused.
     */
    pause() {
        // no need for this anymore
        this._playWhenLoaded = false;

        if (this._state !== STATE_PLAYING)
            return false;

        // set state to paused
        this._state = STATE_PAUSED;

        // play() was issued but hasn't actually started yet - so simply set the flag to pause later.
        if (this._waitingContextSuspension) {
            console.log(`instance.pause(): _waitingContextSuspension - set _pauseOnWaitingContextSuspension`);
            this._pauseOnWaitingContextSuspension = true;
            return true;
        }

        // store current time
        this._updateCurrentTime();

        // Stop the source and re-create it because we cannot reuse the same source.
        // Suspend the end event as we are manually stopping the source
        this._suspendEndEvent++;
        this.source.stop(0);
        this.source = null;

        // reset user-set start offset
        this._startOffset = null;

        if (!this._suspendInstanceEvents)
            this._onPause();

        return true;
    }

    /**
     * Resumes playback of the sound. Playback resumes at the point that the audio was paused.
     *
     * @returns {boolean} Returns true if the sound was resumed.
     */
    resume() {
        if (this._state !== STATE_PAUSED) {
            return false;
        }

        // set state back to playing
        this._state = STATE_PLAYING;

        // play() was issued but hasn't actually started yet - so simply reset the pause flag.
        if (this._waitingContextSuspension) {
            console.log(`instance.resume(): _waitingContextSuspension - reset _pauseOnWaitingContextSuspension`);
            this._pauseOnWaitingContextSuspension = false;
            return true;
        }

        if (!this.source) {
            this._createSource();
        }

        // start at point where sound was paused
        let offset = this.currentTime;

        // if the user set the 'currentTime' property while the sound
        // was paused then use that as the offset instead
        if (this._startOffset !== null) {
            offset = capTime(this._startOffset, this.duration);
            offset = capTime(this._startTime + offset, this._sound.duration);

            // reset offset
            this._startOffset = null;
        }

        // start source
        if (this._duration) {
            this.source.start(0, offset, this._duration);
        } else {
            this.source.start(0, offset);
        }

        this._startedAt = this._manager.context.currentTime;
        this._currentOffset = offset;

        // Initialize parameters
        this.volume = this._volume;
        this.loop = this._loop;
        this.pitch = this._pitch;
        this._playWhenLoaded = false;

        if (!this._suspendInstanceEvents)
            this._onResume();

        return true;
    }

    /**
     * Stops playback of sound. Calling play() again will restart playback from the beginning of
     * the sound.
     *
     * @returns {boolean} Returns true if the sound was stopped.
     */
    stop() {
        this._playWhenLoaded = false;

        if (this._state === STATE_STOPPED)
            return false;

        // set the state to stopped
        this._state = STATE_STOPPED;

        // play() was issued but hasn't actually started yet - so simply set a flag to stop later.
        if (this._waitingContextSuspension) {
            console.log(`instance.stop(): _waitingContextSuspension - set _stopOnWaitingContextSuspension`);
            this._stopOnWaitingContextSuspension = true;
            return true;
        }

        // unsubscribe from manager events
        this._manager.off('volumechange', this._onManagerVolumeChange, this);
        this._manager.off('suspend', this._onManagerSuspend, this);
        this._manager.off('resume', this._onManagerResume, this);
        this._manager.off('destroy', this._onManagerDestroy, this);

        // reset stored times
        this._startedAt = 0;
        this._currentTime = 0;
        this._currentOffset = 0;

        this._startOffset = null;

        this._suspendEndEvent++;
        if (this._state === STATE_PLAYING && this.source) {
            this.source.stop(0);
        }
        this.source = null;

        if (!this._suspendInstanceEvents)
            this._onStop();

        return true;
    }

    /**
     * Connects external Web Audio API nodes. You need to pass the first node of the node graph
     * that you created externally and the last node of that graph. The first node will be
     * connected to the audio source and the last node will be connected to the destination of the
     * AudioContext (e.g. speakers). Requires Web Audio API support.
     *
     * @param {AudioNode} firstNode - The first node that will be connected to the audio source of sound instances.
     * @param {AudioNode} [lastNode] - The last node that will be connected to the destination of the AudioContext.
     * If unspecified then the firstNode will be connected to the destination instead.
     * @example
     * var context = app.systems.sound.context;
     * var analyzer = context.createAnalyzer();
     * var distortion = context.createWaveShaper();
     * var filter = context.createBiquadFilter();
     * analyzer.connect(distortion);
     * distortion.connect(filter);
     * instance.setExternalNodes(analyzer, filter);
     */
    setExternalNodes(firstNode, lastNode) {
        if (!firstNode) {
            console.error('The firstNode must be a valid Audio Node');
            return;
        }

        if (!lastNode) {
            lastNode = firstNode;
        }

        // connections are:
        // source -> inputNode -> connectorNode -> [firstNode -> ... -> lastNode] -> speakers

        const speakers = this._manager.context.destination;

        if (this._firstNode !== firstNode) {
            if (this._firstNode) {
                // if firstNode already exists means the connector node
                // is connected to it so disconnect it
                this._connectorNode.disconnect(this._firstNode);
            } else {
                // if firstNode does not exist means that its connected
                // to the speakers so disconnect it
                this._connectorNode.disconnect(speakers);
            }

            // set first node and connect with connector node
            this._firstNode = firstNode;
            this._connectorNode.connect(firstNode);
        }

        if (this._lastNode !== lastNode) {
            if (this._lastNode) {
                // if last node exists means it's connected to the speakers so disconnect it
                this._lastNode.disconnect(speakers);
            }

            // set last node and connect with speakers
            this._lastNode = lastNode;
            this._lastNode.connect(speakers);
        }
    }

    /**
     * Clears any external nodes set by {@link SoundInstance#setExternalNodes}.
     */
    clearExternalNodes() {
        const speakers = this._manager.context.destination;

        // break existing connections
        if (this._firstNode) {
            this._connectorNode.disconnect(this._firstNode);
            this._firstNode = null;
        }

        if (this._lastNode) {
            this._lastNode.disconnect(speakers);
            this._lastNode = null;
        }

        // reset connect to speakers
        this._connectorNode.connect(speakers);
    }

    /**
     * Gets any external nodes set by {@link SoundInstance#setExternalNodes}.
     *
     * @returns {AudioNode[]} Returns an array that contains the two nodes set by
     * {@link SoundInstance#setExternalNodes}.
     */
    getExternalNodes() {
        return [this._firstNode, this._lastNode];
    }

    /**
     * Creates the source for the instance.
     *
     * @returns {AudioBufferSourceNode|null} Returns the created source or null if the sound
     * instance has no {@link Sound} associated with it.
     * @private
     */
    _createSource() {
        if (!this._sound) {
            return null;
        }

        const context = this._manager.context;

        if (this._sound.buffer) {
            this.source = context.createBufferSource();
            this.source.buffer = this._sound.buffer;

            // Connect up the nodes
            this.source.connect(this._inputNode);

            // set events
            this.source.onended = this._endedHandler;

            // set loopStart and loopEnd so that the source starts and ends at the correct user-set times
            this.source.loopStart = capTime(this._startTime, this.source.buffer.duration);
            if (this._duration) {
                this.source.loopEnd = Math.max(this.source.loopStart, capTime(this._startTime + this._duration, this.source.buffer.duration));
            }
        }

        return this.source;
    }

    /**
     * Sets the current time taking into account the time the instance started playing, the current
     * pitch and the current time offset.
     *
     * @private
     */
    _updateCurrentTime() {
        this._currentTime = capTime((this._manager.context.currentTime - this._startedAt) * this._pitch + this._currentOffset, this.duration);
    }

    /**
     * Handle the manager's 'destroy' event.
     *
     * @private
     */
    _onManagerDestroy() {
        if (this.source && this._state === STATE_PLAYING) {
            this.source.stop(0);
            this.source = null;
        }
    }
}

if (!hasAudioContext()) {
    Object.assign(SoundInstance.prototype, {
        play: function () {
            if (this._state !== STATE_STOPPED) {
                this.stop();
            }

            if (!this.source) {
                if (!this._createSource()) {
                    return false;
                }
            }

            this.volume = this._volume;
            this.pitch = this._pitch;
            this.loop = this._loop;

            this.source.play();
            this._state = STATE_PLAYING;
            this._playWhenLoaded = false;

            this._manager.on('volumechange', this._onManagerVolumeChange, this);
            this._manager.on('suspend', this._onManagerSuspend, this);
            this._manager.on('resume', this._onManagerResume, this);
            this._manager.on('destroy', this._onManagerDestroy, this);

            // suspend immediately if manager is suspended
            if (this._manager.suspended)
                this._onManagerSuspend();

            if (!this._suspendInstanceEvents)
                this._onPlay();

            return true;

        },

        pause: function () {
            if (!this.source || this._state !== STATE_PLAYING)
                return false;

            this._suspendEndEvent++;
            this.source.pause();
            this._playWhenLoaded = false;
            this._state = STATE_PAUSED;
            this._startOffset = null;

            if (!this._suspendInstanceEvents)
                this._onPause();

            return true;
        },

        resume: function () {
            if (!this.source || this._state !== STATE_PAUSED)
                return false;

            this._state = STATE_PLAYING;
            this._playWhenLoaded = false;
            if (this.source.paused) {
                this.source.play();

                if (!this._suspendInstanceEvents)
                    this._onResume();
            }

            return true;
        },

        stop: function () {
            if (!this.source || this._state === STATE_STOPPED)
                return false;

            this._manager.off('volumechange', this._onManagerVolumeChange, this);
            this._manager.off('suspend', this._onManagerSuspend, this);
            this._manager.off('resume', this._onManagerResume, this);
            this._manager.off('destroy', this._onManagerDestroy, this);

            this._suspendEndEvent++;
            this.source.pause();
            this._playWhenLoaded = false;
            this._state = STATE_STOPPED;
            this._startOffset = null;

            if (!this._suspendInstanceEvents)
                this._onStop();

            return true;
        },

        setExternalNodes: function () {
            // not supported
        },

        clearExternalNodes: function () {
            // not supported
        },

        getExternalNodes: function () {
            // not supported but return same type of result
            return [null, null];
        },

        // Sets start time after loadedmetadata is fired which is required by most browsers
        _onLoadedMetadata: function () {
            this.source.removeEventListener('loadedmetadata', this._loadedMetadataHandler);

            this._isReady = true;

            // calculate start time for source
            let offset = capTime(this._startOffset, this.duration);
            offset = capTime(this._startTime + offset, this._sound.duration);
            // reset currentTime
            this._startOffset = null;

            // set offset on source
            this.source.currentTime = offset;
        },

        _createSource: function () {
            if (this._sound && this._sound.audio) {

                this._isReady = false;
                this.source = this._sound.audio.cloneNode(true);

                // set events
                this.source.addEventListener('loadedmetadata', this._loadedMetadataHandler);
                this.source.addEventListener('timeupdate', this._timeUpdateHandler);
                this.source.onended = this._endedHandler;
            }

            return this.source;
        },

        // called every time the 'currentTime' is changed
        _onTimeUpdate: function () {
            if (!this._duration)
                return;

            // if the currentTime passes the end then if looping go back to the beginning
            // otherwise manually stop
            if (this.source.currentTime > capTime(this._startTime + this._duration, this.source.duration)) {
                if (this.loop) {
                    this.source.currentTime = capTime(this._startTime, this.source.duration);
                } else {
                    // remove listener to prevent multiple calls
                    this.source.removeEventListener('timeupdate', this._timeUpdateHandler);
                    this.source.pause();

                    // call this manually because it doesn't work in all browsers in this case
                    this._onEnded();
                }
            }
        },

        _onManagerDestroy: function () {
            if (this.source) {
                this.source.pause();
            }
        }
    });

    Object.defineProperty(SoundInstance.prototype, 'volume', {
        get: function () {
            return this._volume;
        },

        set: function (volume) {
            volume = math.clamp(volume, 0, 1);
            this._volume = volume;
            if (this.source) {
                this.source.volume = volume * this._manager.volume;
            }
        }
    });

    Object.defineProperty(SoundInstance.prototype, 'pitch', {
        get: function () {
            return this._pitch;
        },

        set: function (pitch) {
            this._pitch = Math.max(Number(pitch) || 0, 0.01);
            if (this.source) {
                this.source.playbackRate = this._pitch;
            }
        }
    });

    Object.defineProperty(SoundInstance.prototype, 'sound', {
        get: function () {
            return this._sound;
        },

        set: function (value) {
            this.stop();
            this._sound = value;
        }
    });


    Object.defineProperty(SoundInstance.prototype, 'currentTime', {
        get: function () {
            if (this._startOffset !== null) {
                return this._startOffset;
            }

            if (this._state === STATE_STOPPED || !this.source) {
                return 0;
            }

            return this.source.currentTime - this._startTime;
        },

        set: function (value) {
            if (value < 0) return;

            this._startOffset = value;
            if (this.source && this._isReady) {
                this.source.currentTime = capTime(this._startTime + capTime(value, this.duration), this._sound.duration);
                this._startOffset = null;
            }
        }
    });
}

export { SoundInstance };
