import { Debug } from '../core/debug.js';

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
        this._selfSuspended = false;
        this._unlocked = false;
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
        // lazy create the AudioContext if possible
        if (!this._context) {
            if (hasAudioContext() || this._forceWebAudioApi) {
                if (typeof AudioContext !== 'undefined') {
                    this._context = new AudioContext();
                } else if (typeof webkitAudioContext !== 'undefined') {
                    this._context = new webkitAudioContext();
                }

                this._state = this._context ? this._context.state || CONTEXT_STATE_SUSPENDED : CONTEXT_STATE_SUSPENDED;
                console.log(`manager._state: ${this._state}`);

                if (this._context) {
                    this._unlocked = this._state === CONTEXT_STATE_RUNNING;
                    if (!this._unlocked) {
                        this._addContextUnlockListeners();
                    }

                    // When the browser window loses focus (i.e. switching tab, hiding the app on mobile, etc),
                    // the AudioContext state will be set to 'interrupted' (on iOS Safari) or 'suspended' (on other
                    // browsers), and 'resume' must be expliclty called.
                    const self = this;
                    this._context.onstatechange = function () {
                        console.log(`context: onstatechange: ${self._context.state}`);

                        // explicitly call .resume() when previous state was suspended or interrupted
                        // @ts-ignore
                        if (self._unlocked && !this._selfSuspended && ((self._context.state === CONTEXT_STATE_INTERRUPTED && self._state === CONTEXT_STATE_RUNNING))) {
                            self._context.resume().then(() => {
                                console.warn(`onstatechange: _context.resume(): success`);
                            }, (e) => {
                                console.warn(`onstatechange: _context.resume(): rejected`);
                                console.warn(e);
                            }).catch(() => {
                                console.warn(`onstatechange: _context.resume(): fail`);
                            });
                        }
                    };
                }
            }
        }

        return this._context;
    }

    suspend() {
        console.log(`manager.suspend`);
        this._selfSuspended = true;

        if (this.suspended) {
            console.log(`manager.suspend: already suspended: ${!this._context} || ${!this._unlocked} || ${this._context.state}`);
            return;
        }

        console.log(`manager.suspend: fired suspend`);
        this.fire('suspend');
    }

    resume() {
        console.log(`manager.resume`);
        this._selfSuspended = false;

        if (!this._context) {
            console.log(`manager.resume: no context!`);
            return;
        }

        if (!this._unlocked && !this._unlocking) {
            console.log(`manager.resume: still locked!`);
            return;
        }

        // @ts-ignore
        if (this._state === CONTEXT_STATE_SUSPENDED || this._state === CONTEXT_STATE_RUNNING && this._context.state === CONTEXT_STATE_INTERRUPTED) {
            console.log(`manager.resume: _context.resume()`);

            this._context.resume().then(() => {
                console.warn(`manager.resume: _context.resume(): success & fired resume`);
                this._state = CONTEXT_STATE_RUNNING;
                console.log(`manager._state: ${this._state}`);

                this.fire('resume');
            }, (e) => {
                console.warn(`manager.resume: _context.resume(): rejected`);
                console.warn(e);
                setTimeout(this.resume, 0);
            }).catch((e) => {
                console.warn(`manager.resume: _context.resume(): fail`);
                console.warn(e);
            });
        } else {
            console.log(`manager.resume: fired resume`);
            this.fire('resume');
        }
    }

    destroy() {
        if (this._resumeContext && this._resumeContextAttached) {
            USER_INPUT_EVENTS.forEach((eventName) => {
                window.removeEventListener(eventName, this._resumeContext, false);
            });
        }

        this.fire('destroy');

        if (this._context && this._context.close) {
            console.log(`destroy(): _context.close()`);
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

    _removeUserInputListeners() {
        if (!this._resumeContextAttached) {
            return;
        }

        USER_INPUT_EVENTS.forEach((eventName) => {
            window.removeEventListener(eventName, this._resumeContext, false);
        });
        this._resumeContextAttached = false;
        this._resumeContext = null;
    }

    /**
     * Add the necessary Window EventListeners for resuming the AudioContext to comply with auto-play policies.
     * For more info, https://developers.google.com/web/updates/2018/11/web-audio-autoplay.
     *
     * @private
     */
    _addContextUnlockListeners() {
        // resume AudioContext on user interaction because of autoplay policy
        if (!this._resumeContext) {
            this._resumeContext = () => {
                if (!this._context || this._unlocked || this._unlocking) {
                    return;
                }
                this._unlocking = true;

                this.resume();

                const buffer = this._context.createBuffer(1, 1, this._context.sampleRate);
                const source = this._context.createBufferSource();
                source.buffer = buffer;
                source.connect(this._context.destination);
                source.start(0);
                console.warn(`unlock: played source`);
                source.onended = (event) => {
                    console.warn(`unlock: ended source`);
                    source.disconnect(0);
                    this._unlocked = true;
                    this._unlocking = false;
                    this._removeUserInputListeners();
                };
            };
        }

        if (!this._resumeContextAttached) {
            console.warn(`attach _context resume`);
            USER_INPUT_EVENTS.forEach((eventName) => {
                window.addEventListener(eventName, this._resumeContext, false);
            });
            this._resumeContextAttached = true;
        }
    }
}

export { SoundManager };
