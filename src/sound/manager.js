import { Debug } from '../core/debug.js';

import { EventHandler } from '../core/event-handler.js';

import { math } from '../math/math.js';

import { hasAudioContext } from '../audio/capabilities.js';
import { Channel } from '../audio/channel.js';
import { Channel3d } from '../audio/channel3d.js';

import { Listener } from './listener.js';

const CONTEXT_STATE_RUNNING = 'running';
const CONTEXT_STATE_INTERRUPTED = 'interrupted';

/**
 * List of Window events to listen when AudioContext needs to be unlocked.
 */
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
         * The underlying AudioContext, lazy loaded in the 'context' property.
         *
         * @type {AudioContext}
         * @private
         */
        this._context = null;

        /**
         * @type {boolean}
         * @private
         */
        this._forceWebAudioApi = options.forceWebAudioApi;

        /**
         * The function callback attached to the Window events USER_INPUT_EVENTS
         *
         * @type {EventListenerOrEventListenerObject}
         * @private
         */
        this._resumeContextCallback = null;

        /**
         * Set to to true when suspend() was called explitly (either manually or on visibility change),
         * and reset to false after resume() is called.
         * This value is not directly bound to AudioContext.state.
         *
         * @type {boolean}
         * @private
         */
        this._selfSuspended = false;

        /**
         * If true, the AudioContext is in a special 'suspended' state where it needs to be resumed
         * from a User event. In addition, some devices and browsers require that a blank sound be played.
         *
         * @type {boolean}
         * @private
         */
        this._unlocked = false;

        /**
         * Set after the unlock flow is triggered, but hasn't completed yet.
         * Used to avoid starting multiple 'unlock' flows at the same time.
         *
         * @type {boolean}
         * @private
         */
        this._unlocking = false;

        if (!hasAudioContext() && !this._forceWebAudioApi) {
            Debug.warn('No support for 3D audio found');
        }

        this.listener = new Listener(this);

        this._volume = 1;
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

    get suspended() {
        return !this._context || !this._unlocked || this._context.state !== CONTEXT_STATE_RUNNING;
    }

    /**
     * Get the Web Audio API context.
     *
     * @type {AudioContext}
     * @ignore
     */
    get context() {
        // lazy create the AudioContext
        if (!this._context) {
            if (hasAudioContext() || this._forceWebAudioApi) {
                if (typeof AudioContext !== 'undefined') {
                    this._context = new AudioContext();
                } else if (typeof webkitAudioContext !== 'undefined') {
                    this._context = new webkitAudioContext();
                }

                // if context was successfully created, initialize it
                if (this._context) {
                    // AudioContext will start in a 'suspended' state if it is locked by the browser
                    this._unlocked = this._context.state === CONTEXT_STATE_RUNNING;
                    if (!this._unlocked) {
                        this._addContextUnlockListeners();
                    }

                    // When the browser window loses focus (i.e. switching tab, hiding the app on mobile, etc),
                    // the AudioContext state will be set to 'interrupted' (on iOS Safari) or 'suspended' (on other
                    // browsers), and 'resume' must be expliclty called.
                    const self = this;
                    this._context.onstatechange = function () {

                        // explicitly call .resume() when previous state was suspended or interrupted
                        if (self._unlocked && !self._selfSuspended && self._context.state !== CONTEXT_STATE_RUNNING) {
                            self._context.resume().then(() => {
                                // no-op
                            }, (e) => {
                                Debug.error(`Attempted to resume the AudioContext on onstatechange, but it was rejected`, e);
                            }).catch((e) => {
                                Debug.error(`Attempted to resume the AudioContext on onstatechange, but threw an exception`, e);
                            });
                        }
                    };
                }
            }
        }

        return this._context;
    }

    suspend() {
        this._selfSuspended = true;

        if (this.suspended) {
            // already suspended
            return;
        }

        this.fire('suspend');
    }

    resume() {
        this._selfSuspended = false;

        // cannot resume context if it wasn't created yet or if it's still locked
        if (!this._context || (!this._unlocked && !this._unlocking)) {
            return;
        }

        // Some browsers (mostly mobile) do not automatically resume the AudioContext, so explitly resume.
        // If context has already been resumed, _context.resume() will immediately trigger the onfulfilled promise.
        this._context.resume().then(() => {
            // context has reported to have been resumed
            this.fire('resume');
        }, (e) => {
            Debug.error(`Attempted to resume the AudioContext on SoundManager.resume(), but it was rejected`, e);
        }).catch((e) => {
            Debug.error(`Attempted to resume the AudioContext on SoundManager.resume(), but threw an exception`, e);
        });
    }

    destroy() {
        this._removeUserInputListeners();

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
     * Add the necessary Window EventListeners to comply with auto-play policies,
     * and correctly unlock and resume the AudioContext.
     * For more info, https://developers.google.com/web/updates/2018/11/web-audio-autoplay.
     *
     * @private
     */
    _addContextUnlockListeners() {
        this._unlocking = false;

        // resume AudioContext on user interaction because of autoplay policy
        if (!this._resumeContextCallback) {
            this._resumeContextCallback = () => {
                // prevent multiple unlock calls
                if (!this._context || this._unlocked || this._unlocking) {
                    return;
                }
                this._unlocking = true;

                // trigger the resume flow from a User-initiated event
                this.resume();

                // Some platforms (mostly iOS) require an additional sound to be played.
                // This also performs a sanity check and verifies sounds can be played.
                const buffer = this._context.createBuffer(1, 1, this._context.sampleRate);
                const source = this._context.createBufferSource();
                source.buffer = buffer;
                source.connect(this._context.destination);
                source.start(0);

                // onended is only called if everything worked as expected (context is running)
                source.onended = (event) => {
                    source.disconnect(0);

                    // unlocked!
                    this._unlocked = true;
                    this._unlocking = false;
                    this._removeUserInputListeners();
                };
            };
        }

        // attach to all user input events
        USER_INPUT_EVENTS.forEach((eventName) => {
            window.addEventListener(eventName, this._resumeContextCallback, false);
        });
    }

    /**
     * Remove all USER_INPUT_EVENTS unlock event listeners, if they're still attached.
     *
     * @private
     */
    _removeUserInputListeners() {
        if (!this._resumeContextCallback) {
            return;
        }

        USER_INPUT_EVENTS.forEach((eventName) => {
            window.removeEventListener(eventName, this._resumeContextCallback, false);
        });
        this._resumeContextCallback = null;
    }
}

export { SoundManager };
