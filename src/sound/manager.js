import { platform } from '../core/platform.js';
import { EventHandler } from '../core/event-handler.js';

import { math } from '../math/math.js';

import { hasAudio, hasAudioContext } from '../audio/capabilities.js';
import { Channel } from '../audio/channel.js';
import { Channel3d } from '../audio/channel3d.js';

import { Listener } from './listener.js';

/**
 * @class
 * @name pc.SoundManager
 * @augments pc.EventHandler
 * @classdesc The SoundManager is used to load and play audio. As well as apply system-wide settings
 * like global volume, suspend and resume.
 * @description Creates a new sound manager.
 * @param {object} [options] - Options options object.
 * @param {boolean} [options.forceWebAudioApi] - Always use the Web Audio API even check indicates that it if not available.
 * @property {number} volume Global volume for the manager. All {@link pc.SoundInstance}s will scale their volume with this volume. Valid between [0, 1].
 */
class SoundManager extends EventHandler {
    constructor(options) {
        super();

        if (hasAudioContext() || options.forceWebAudioApi) {
            if (typeof AudioContext !== 'undefined') {
                this.context = new AudioContext();
            } else if (typeof webkitAudioContext !== 'undefined') {
                this.context = new webkitAudioContext();
            }

            if (this.context) {
                var context = this.context;

                // resume AudioContext on user interaction because of new Chrome autoplay policy
                this.resumeContext = function () {
                    this.context.resume();
                    window.removeEventListener('mousedown', this.resumeContext);
                    window.removeEventListener('touchend', this.resumeContext);
                }.bind(this);

                window.addEventListener('mousedown', this.resumeContext);
                window.addEventListener('touchend', this.resumeContext);

                // iOS only starts sound as a response to user interaction
                if (platform.ios) {
                    // Play an inaudible sound when the user touches the screen
                    // This only happens once
                    var unlock = function () {
                        var buffer = context.createBuffer(1, 1, 44100);
                        var source = context.createBufferSource();
                        source.buffer = buffer;
                        source.connect(context.destination);
                        source.start(0);
                        source.disconnect();

                        // no further need for this so remove the listener
                        window.removeEventListener('touchend', unlock);
                    };

                    window.addEventListener('touchend', unlock);
                }
            }
        } else {
            console.warn('No support for 3D audio found');
        }

        if (!hasAudio())
            console.warn('No support for 2D audio found');

        this.listener = new Listener(this);

        this._volume = 1;
        this.suspended = false;
    }

    suspend() {
        this.suspended = true;
        this.fire('suspend');
    }

    resume() {
        this.suspended = false;
        this.fire('resume');
    }

    destroy() {
        window.removeEventListener('mousedown', this.resumeContext);
        window.removeEventListener('touchend', this.resumeContext);

        this.fire('destroy');
        if (this.context && this.context.close) {
            this.context.close();
            this.context = null;
        }
    }

    /**
     * @private
     * @function
     * @name pc.SoundManager#playSound
     * @description Create a new pc.Channel and begin playback of the sound.
     * @param {pc.Sound} sound - The Sound object to play.
     * @param {object} options - Optional options object.
     * @param {number} [options.volume] - The volume to playback at, between 0 and 1.
     * @param {boolean} [options.loop] - Whether to loop the sound when it reaches the end.
     * @returns {pc.Channel} The channel playing the sound.
     */
    playSound(sound, options) {
        options = options || {};
        var channel = null;
        if (Channel) {
            channel = new Channel(this, sound, options);
            channel.play();
        }
        return channel;
    }

    /**
     * @private
     * @function
     * @name pc.SoundManager#playSound3d
     * @description Create a new pc.Channel3d and begin playback of the sound at the position specified.
     * @param {pc.Sound} sound - The Sound object to play.
     * @param {pc.Vec3} position - The position of the sound in 3D space.
     * @param {object} options - Optional options object.
     * @param {number} [options.volume] - The volume to playback at, between 0 and 1.
     * @param {boolean} [options.loop] - Whether to loop the sound when it reaches the end.
     * @returns {pc.Channel3d} The 3D channel playing the sound.
     */
    playSound3d(sound, position, options) {
        options = options || {};
        var channel = null;
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

    get volume() {
        return this._volume;
    }

    set volume(volume) {
        volume = math.clamp(volume, 0, 1);
        this._volume = volume;
        this.fire('volumechange', volume);
    }
}

export { SoundManager };
