import { platform } from '../core/platform.js';
import { EventHandler } from '../core/event-handler.js';

import { math } from '../math/math.js';

import { hasAudioContext } from '../audio/capabilities.js';
import { Channel } from '../audio/channel.js';
import { Channel3d } from '../audio/channel3d.js';

import { Listener } from './listener.js';

const CONTEXT_STATE_NOT_CREATED = 'not created';
const CONTEXT_STATE_RUNNING = 'running';
const CONTEXT_STATE_SUSPENDED = 'suspended';
const CONTEXT_STATE_INTERRUPTED = 'interrupted';

const USER_INPUT_EVENTS = [
    'click', 'contextmenu', 'auxclick', 'dblclick', 'mousedown',
    'mouseup', 'pointerup', 'touchend', 'keydown', 'keyup'
];

/**
 * The SoundManager is used to load and play audio. It also applies system-wide settings like
 * global volume, suspend and resume.
 *
 * @augments EventHandler
 */
class SoundManager extends EventHandler {
    /**
     * Create a new SoundManager instance.
     *
     * @param {object} [options] - Options options object.
     * @param {boolean} [options.forceWebAudioApi] - Always use the Web Audio API, even if check
     * indicates that it is not available.
     */
    constructor(options) {
        super();

        /**
         * @type {AudioContext}
         * @private
         */
        this._context = null;
        /**
         * The current state of the underlying AudioContext.
         *
         * @type {string}
         * @private
         */
        this._state = CONTEXT_STATE_NOT_CREATED;
        /**
         * @type {boolean}
         * @private
         */
        this._forceWebAudioApi = options.forceWebAudioApi;

        this._resumeContext = null;
        this._resumeContextAttached = false;
        this._unlock = null;
        this._unlockAttached = false;

        if (hasAudioContext() || this._forceWebAudioApi) {
            this._addAudioContextUserInteractionListeners();
        } else {
            console.warn('No support for 3D audio found');
        }

        this.listener = new Listener(this);

        this._volume = 1;
        this.suspended = false;
    }

    /**
     * Global volume for the manager. All {@link SoundInstance}s will scale their volume with this
     * volume. Valid between [0, 1].
     *
     * @type {number}
     */
    set volume(volume) {
        volume = math.clamp(volume, 0, 1);
        this._volume = volume;
        this.fire('volumechange', volume);
    }

    get volume() {
        return this._volume;
    }

    /**
     * Get the Web Audio API context.
     *
     * @type {AudioContext}
     * @ignore
     */
    get context() {
        // lazy create the AudioContext if possible
        if (!this._context) {
            if (hasAudioContext() || this._forceWebAudioApi) {
                if (typeof AudioContext !== 'undefined') {
                    this._context = new AudioContext();
                } else if (typeof webkitAudioContext !== 'undefined') {
                    this._context = new webkitAudioContext();
                }

                if (this._context) {
                    this._state = this._context.state;

                    // When the browser window loses focus (i.e. switching tab, hiding the app on mobile, etc),
                    // the AudioContext state will be set to 'interrupted' (on iOS Safari) or 'suspended' (on other
                    // browsers), and 'resume' must be expliclty called.
                    this._context.onstatechange = () => {
                        if (!this._context) return;

                        // explicitly call .resume() when previous state was suspended or interrupted
                        if (this._state === CONTEXT_STATE_INTERRUPTED || this._state === CONTEXT_STATE_SUSPENDED) {
                            this._safelyResumeContext();
                        }
                        this._state = this._context.state;
                    };
                }
            }
        }

        return this._context;
    }

    suspend() {
        this.suspended = true;
        this.fire('suspend');
    }

    resume() {
        this.suspended = false;
        this.fire('resume');

        // attempt to safely resume the AudioContext
        if (this.context && (this._state === CONTEXT_STATE_INTERRUPTED || this._state === CONTEXT_STATE_SUSPENDED)) {
            this._safelyResumeContext();
        }
    }

    destroy() {
        if (this._resumeContext && this._resumeContextAttached) {
            USER_INPUT_EVENTS.forEach((eventName) => {
                window.removeEventListener(eventName, this._resumeContext);
            });
        }

        if (this._unlock && this._unlockAttached) {
            window.removeEventListener('touchend', this._unlock);
        }

        this.fire('destroy');

        if (this._context && this._context.close) {
            this._context.close();
            this._context = null;
        }
    }

    /**
     * Create a new {@link Channel} and begin playback of the sound.
     *
     * @param {Sound} sound - The Sound object to play.
     * @param {object} options - Optional options object.
     * @param {number} [options.volume] - The volume to playback at, between 0 and 1.
     * @param {boolean} [options.loop] - Whether to loop the sound when it reaches the end.
     * @returns {Channel} The channel playing the sound.
     * @private
     */
    playSound(sound, options = {}) {
        let channel = null;
        if (Channel) {
            channel = new Channel(this, sound, options);
            channel.play();
        }
        return channel;
    }

    /**
     * Create a new {@link Channel3d} and begin playback of the sound at the position specified.
     *
     * @param {Sound} sound - The Sound object to play.
     * @param {Vec3} position - The position of the sound in 3D space.
     * @param {object} options - Optional options object.
     * @param {number} [options.volume] - The volume to playback at, between 0 and 1.
     * @param {boolean} [options.loop] - Whether to loop the sound when it reaches the end.
     * @returns {Channel3d} The 3D channel playing the sound.
     * @private
     */
    playSound3d(sound, position, options = {}) {
        let channel = null;
        if (Channel3d) {
            channel = new Channel3d(this, sound, options);
            channel.setPosition(position);
            if (options.volume) {
                channel.setVolume(options.volume);
            }
            if (options.loop) {
                channel.setLoop(options.loop);
            }
            if (options.maxDistance) {
                channel.setMaxDistance(options.maxDistance);
            }
            if (options.minDistance) {
                channel.setMinDistance(options.minDistance);
            }
            if (options.rollOffFactor) {
                channel.setRollOffFactor(options.rollOffFactor);
            }
            if (options.distanceModel) {
                channel.setDistanceModel(options.distanceModel);
            }

            channel.play();
        }

        return channel;
    }

    /**
     * Attempt to resume the AudioContext, but safely handle failure scenarios.
     * When the browser window loses focus (i.e. switching tab, hiding the app on mobile, etc),
     * the AudioContext state will be set to 'interrupted' (on iOS Safari) or 'suspended' (on other
     * browsers), and 'resume' must be expliclty called. However, the Auto-Play policy might block
     * the AudioContext from running - in those cases, we need to add the interaction listeners,
     * making the AudioContext be resumed later.
     *
     * @private
     */
    _safelyResumeContext() {
        if (!this._context) return;

        this._context.resume().then(() => {
            // if after the callback the state is not yet running, add interaction listeners to resume context later
            if (this._context.state !== CONTEXT_STATE_RUNNING) {
                this._addAudioContextUserInteractionListeners();
            }
        }).catch(() => {
            // if context could not be resumed at this point (for instance, due to auto-play policy),
            // add interaction listeners to resume the context later
            this._addAudioContextUserInteractionListeners();
        });
    }

    /**
     * Add the necessary Window EventListeners for resuming the AudioContext to comply with auto-play policies.
     * For more info, https://developers.google.com/web/updates/2018/11/web-audio-autoplay.
     *
     * @private
     */
    _addAudioContextUserInteractionListeners() {
        // resume AudioContext on user interaction because of autoplay policy
        if (!this._resumeContext) {
            this._resumeContext = () => {
                if (!this.context || this.context.state === CONTEXT_STATE_RUNNING) {
                    USER_INPUT_EVENTS.forEach((eventName) => {
                        window.removeEventListener(eventName, this._resumeContext);
                    });

                    this._resumeContextAttached = false;
                } else {
                    this.context.resume();
                }
            };
        }

        if (!this._resumeContextAttached) {
            USER_INPUT_EVENTS.forEach((eventName) => {
                window.addEventListener(eventName, this._resumeContext);
            });

            this._resumeContextAttached = true;
        }

        // iOS only starts sound as a response to user interaction
        if (platform.ios) {
            // Play an inaudible sound when the user touches the screen
            // This only happens once
            if (!this._unlock) {
                this._unlock = () => {
                    // no further need for this so remove the listener
                    window.removeEventListener('touchend', this._unlock);
                    this._unlockAttached = false;

                    const context = this.context;
                    if (context) {
                        const buffer = context.createBuffer(1, 1, 44100);
                        const source = context.createBufferSource();
                        source.buffer = buffer;
                        source.connect(context.destination);
                        source.start(0);
                        source.disconnect();
                    }
                };
            }

            if (!this._unlockAttached) {
                window.addEventListener('touchend', this._unlock);
                this._unlockAttached = true;
            }
        }
    }
}

export { SoundManager };
