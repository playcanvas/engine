import { Debug } from '../../core/debug.js';
import { EventHandler } from '../../core/event-handler.js';
import { math } from '../../core/math/math.js';
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
     */
    constructor() {
        super();

        /**
         * The underlying AudioContext, lazy loaded in the 'context' property.
         *
         * @type {AudioContext|null}
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
