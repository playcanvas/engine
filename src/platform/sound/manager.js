import { Debug } from '../../core/debug.js';

import { EventHandler } from '../../core/event-handler.js';

import { math } from '../../core/math/math.js';

import { Channel } from '../audio/channel.js';
import { Channel3d } from '../audio/channel3d.js';

import { Listener } from './listener.js';

const CONTEXT_STATE_RUNNING = 'running';

/**
 * List of Window events to listen when AudioContext needs to be unlocked.
 */
const USER_INPUT_EVENTS = [
    'click', 'touchstart', 'mousedown'
];

/**
 * The SoundManager is used to load and play audio. It also applies system-wide settings like
 * global volume, suspend and resume.
 *
 * @category Sound
 */
class SoundManager extends EventHandler {
    /**
     * Create a new SoundManager instance.
     *
     */
    constructor() {
        super();

        /**
         * The underlying AudioContext, lazy loaded in the 'context' property.
         *
         * @type {AudioContext}
         * @private
         */
        this._context = null;

        this.AudioContext = (typeof AudioContext !== 'undefined' && AudioContext) ||
                            (typeof webkitAudioContext !== 'undefined' && webkitAudioContext);

        if (!this.AudioContext) {
            Debug.warn('No support for 3D audio found');
        }

        this._unlockHandlerFunc = this._unlockHandler.bind(this);

        // user suspended audio
        this._userSuspended = false;

        this.listener = new Listener(this);

        this._volume = 1;
    }

    /**
     * Sets the global volume for the manager. All {@link SoundInstance}s will scale their volume
     * with this volume. Valid between [0, 1].
     *
     * @type {number}
     */
    set volume(volume) {
        volume = math.clamp(volume, 0, 1);
        this._volume = volume;
        this.fire('volumechange', volume);
    }

    /**
     * Gets the global volume for the manager.
     *
     * @type {number}
     */
    get volume() {
        return this._volume;
    }

    get suspended() {
        return this._userSuspended;
    }

    /**
     * Get the Web Audio API context.
     *
     * @type {AudioContext}
     * @ignore
     */
    get context() {
        // lazy create the AudioContext
        if (!this._context && this.AudioContext) {
            this._context = new this.AudioContext();

            if (this._context.state !== CONTEXT_STATE_RUNNING) {
                this._registerUnlockListeners();
            }
        }

        return this._context;
    }

    suspend() {
        if (!this._userSuspended) {
            this._userSuspended = true;
            if (this._context && this._context.state === CONTEXT_STATE_RUNNING) {
                this._suspend();
            }
        }
    }

    resume() {
        if (this._userSuspended) {
            this._userSuspended = false;
            if (this._context && this._context.state !== CONTEXT_STATE_RUNNING) {
                this._resume();
            }
        }
    }

    destroy() {
        this.fire('destroy');

        if (this._context) {
            this._removeUnlockListeners();
            this._context?.close();
            this._context = null;
        }
    }

    /**
     * Create a new {@link Channel} and begin playback of the sound.
     *
     * @param {import('./sound.js').Sound} sound - The Sound object to play.
     * @param {object} [options] - Optional options object.
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
     * @param {import('./sound.js').Sound} sound - The Sound object to play.
     * @param {import('../../core/math/vec3.js').Vec3} position - The position of the sound in 3D space.
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

    // resume the sound context
    _resume() {
        this._context.resume().then(() => {
            // Some platforms (mostly iOS) require an additional sound to be played.
            // This also performs a sanity check and verifies sounds can be played.
            const source = this._context.createBufferSource();
            source.buffer = this._context.createBuffer(1, 1, this._context.sampleRate);
            source.connect(this._context.destination);
            source.start(0);

            // onended is only called if everything worked as expected (context is running)
            source.onended = (event) => {
                source.disconnect(0);
                this.fire('resume');
            };
        }, (e) => {
            Debug.error(`Attempted to resume the AudioContext on SoundManager.resume(), but it was rejected ${e}`);
        }).catch((e) => {
            Debug.error(`Attempted to resume the AudioContext on SoundManager.resume(), but threw an exception ${e}`);
        });
    }

    // resume the sound context and fire suspend event if it succeeds
    _suspend() {
        this._context.suspend().then(() => {
            this.fire('suspend');
        }, (e) => {
            Debug.error(`Attempted to suspend the AudioContext on SoundManager.suspend(), but it was rejected ${e}`);
        }).catch((e) => {
            Debug.error(`Attempted to suspend the AudioContext on SoundManager.suspend(), but threw an exception ${e}`);
        });
    }

    _unlockHandler() {
        this._removeUnlockListeners();

        if (!this._userSuspended && this._context.state !== CONTEXT_STATE_RUNNING) {
            this._resume();
        }
    }

    _registerUnlockListeners() {
        // attach to all user input events
        USER_INPUT_EVENTS.forEach((eventName) => {
            window.addEventListener(eventName, this._unlockHandlerFunc, false);
        });
    }

    _removeUnlockListeners() {
        USER_INPUT_EVENTS.forEach((eventName) => {
            window.removeEventListener(eventName, this._unlockHandlerFunc, false);
        });
    }
}

export { SoundManager };
