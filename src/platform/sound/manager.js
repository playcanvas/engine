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
     * @type {AudioContext|null}
     * @private
     */
    _context = null;

    /**
     * @type {() => void}
     * @private
     */
    _unlockHandlerFunc;

    /** @private */
    _userSuspended = false;

    /**
     * The listener associated with this manager.
     *
     * @type {Listener}
     */
    listener;

    /** @private */
    _volume = 1;

    /**
     * Create a new SoundManager instance.
     */
    constructor() {
        super();

        this._unlockHandlerFunc = this._unlockHandler.bind(this);
        this.listener = new Listener(this);
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
     * Get the Web Audio API context. Returns null if the environment does not support the Web
     * Audio API.
     *
     * @type {AudioContext|null}
     * @ignore
     */
    get context() {
        // lazy create the AudioContext
        if (!this._context) {
            const AudioContextCtor =
                (typeof AudioContext !== 'undefined' && AudioContext) ||
                (typeof webkitAudioContext !== 'undefined' && webkitAudioContext);

            if (!AudioContextCtor) {
                Debug.warnOnce('No support for Web Audio API found');
                return null;
            }

            this._context = new AudioContextCtor();

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

        const context = this._context;
        if (context) {
            this._removeUnlockListeners();
            context.close();
            this._context = null;
        }
    }

    // resume the sound context
    _resume() {
        const context = this._context;
        if (!context) return;

        context.resume().then(() => {
            // Some platforms (mostly iOS) require an additional sound to be played.
            // This also performs a sanity check and verifies sounds can be played.
            const source = context.createBufferSource();
            source.buffer = context.createBuffer(1, 1, context.sampleRate);
            source.connect(context.destination);
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
        const context = this._context;
        if (!context) return;

        context.suspend().then(() => {
            this.fire('suspend');
        }, (e) => {
            Debug.error(`Attempted to suspend the AudioContext on SoundManager.suspend(), but it was rejected ${e}`);
        }).catch((e) => {
            Debug.error(`Attempted to suspend the AudioContext on SoundManager.suspend(), but threw an exception ${e}`);
        });
    }

    _unlockHandler() {
        this._removeUnlockListeners();

        if (!this._userSuspended && this._context && this._context.state !== CONTEXT_STATE_RUNNING) {
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
