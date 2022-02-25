import { platform } from '../core/platform.js';
import { EventHandler } from '../core/event-handler.js';

import { math } from '../math/math.js';

import { hasAudioContext } from '../audio/capabilities.js';
import { Channel } from '../audio/channel.js';
import { Channel3d } from '../audio/channel3d.js';

import { Listener } from './listener.js';

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
         * @type {boolean}
         * @private
         */
        this._forceWebAudioApi = options.forceWebAudioApi;

        this._resumeContext = null;
        this._unlock = null;

        if (hasAudioContext() || this._forceWebAudioApi) {
            // resume AudioContext on user interaction because of new Chrome autoplay policy
            this._resumeContext = () => {
                window.removeEventListener('mousedown', this._resumeContext);
                window.removeEventListener('touchend', this._resumeContext);

                if (this.context) {
                    this.context.resume();
                }
            };

            window.addEventListener('mousedown', this._resumeContext);
            window.addEventListener('touchend', this._resumeContext);

            // iOS only starts sound as a response to user interaction
            if (platform.ios) {
                // Play an inaudible sound when the user touches the screen
                // This only happens once
                this._unlock = () => {
                    // no further need for this so remove the listener
                    window.removeEventListener('touchend', this._unlock);

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

                window.addEventListener('touchend', this._unlock);
            }
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
            }
        }

        return this._context;
    }

    suspend() {
        this.suspended = true;
        this.fire('suspend');
    }

    resume() {
        const resumeFunction = () => {
            this.suspended = false;
            this.fire('resume');
        };

        // On iOS safari, switching tab or minimizing the browser will set the AudioContext state as 'interrupted'.
        // On other browsers, AudioContext state will be set to 'suspended'.
        // In those situations, the .resume() API must be called explicitly
        if ((hasAudioContext() || this._forceWebAudioApi) &&
            (this.context.state === 'interrupted' || this.context.state === 'suspended')) {
            this.context.resume().then(resumeFunction);
        } else
            resumeFunction();
    }

    destroy() {
        if (this._resumeContext) {
            window.removeEventListener('mousedown', this._resumeContext);
            window.removeEventListener('touchend', this._resumeContext);
        }

        if (this._unlock) {
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
}

export { SoundManager };
