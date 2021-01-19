import { math } from '../math/math.js';

import { hasAudio, hasAudioContext } from './capabilities.js';

/**
 * @private
 * @class
 * @name Channel
 * @classdesc A channel is created when the {@link SoundManager} begins playback of a {@link Sound}. Usually created internally by
 * {@link SoundManager#playSound} or {@link SoundManager#playSound3d}. Developers usually won't have to create Channels manually.
 * @param {SoundManager} manager - The SoundManager instance.
 * @param {Sound} sound - The sound to playback.
 * @param {object} [options] - Optional options object.
 * @param {number} [options.volume=1] - The playback volume, between 0 and 1.
 * @param {number} [options.pitch=1] - The relative pitch, default of 1, plays at normal pitch.
 * @param {boolean} [options.loop=false] - Whether the sound should loop when it reaches the end or not.
 */
class Channel {
    constructor(manager, sound, options = {}) {
        this.volume = (options.volume === undefined) ? 1 : options.volume;
        this.loop = (options.loop === undefined) ? false : options.loop;
        this.pitch = (options.pitch === undefined ? 1 : options.pitch);

        this.sound = sound;

        this.paused = false;
        this.suspended = false;

        this.manager = manager;

        this.source = null;

        if (hasAudioContext()) {
            this.startTime = 0;
            this.startOffset = 0;

            const context = manager.context;
            this.gain = context.createGain();
        } else if (hasAudio()) {
            // handle the case where sound was
            if (sound.audio) {
                this.source = sound.audio.cloneNode(false);
                this.source.pause(); // not initially playing
            }
        }
    }

    /**
     * @private
     * @function
     * @name Channel#getVolume
     * @description Get the current value for the volume. Between 0 and 1.
     * @returns {number} The volume of the channel.
     */
    getVolume() {
        return this.volume;
    }

    /**
     * @private
     * @function
     * @name Channel#getLoop
     * @description Get the current looping state of the Channel.
     * @returns {boolean} The loop property for the channel.
     */
    getLoop() {
        return this.loop;
    }

    /**
     * @private
     * @function
     * @name Channel#setLoop
     * @description Enable/disable the loop property to make the sound restart from the beginning when it reaches the end.
     * @param {boolean} loop - True to loop the sound, false otherwise.
     */
    setLoop(loop) {
        this.loop = loop;
        if (this.source) {
            this.source.loop = loop;
        }
    }

    /**
     * @private
     * @function
     * @name Channel#getPitch
     * @description Get the current pitch of the Channel.
     * @returns {number} The pitch of the channel.
     */
    getPitch() {
        return this.pitch;
    }

    /**
     * @private
     * @function
     * @name Channel#onManagerVolumeChange
     * @description Handle the manager's 'volumechange' event.
     */
    onManagerVolumeChange() {
        this.setVolume(this.getVolume());
    }

    /**
     * @private
     * @function
     * @name Channel#onManagerSuspend
     * @description Handle the manager's 'suspend' event.
     */
    onManagerSuspend() {
        if (this.isPlaying() && !this.suspended) {
            this.suspended = true;
            this.pause();
        }
    }

    /**
     * @private
     * @function
     * @name Channel#onManagerResume
     * @description Handle the manager's 'resume' event.
     */
    onManagerResume() {
        if (this.suspended) {
            this.suspended = false;
            this.unpause();
        }
    }
}

if (hasAudioContext()) {
    Object.assign(Channel.prototype, {
        /**
         * @private
         * @function
         * @name Channel#play
         * @description Begin playback of sound.
         */
        play: function () {
            if (this.source) {
                throw new Error('Call stop() before calling play()');
            }

            this._createSource();
            if (!this.source) {
                return;
            }


            this.startTime = this.manager.context.currentTime;
            this.source.start(0, this.startOffset % this.source.buffer.duration);

            // Initialize volume and loop - note moved to be after start() because of Chrome bug
            this.setVolume(this.volume);
            this.setLoop(this.loop);
            this.setPitch(this.pitch);

            this.manager.on('volumechange', this.onManagerVolumeChange, this);
            this.manager.on('suspend', this.onManagerSuspend, this);
            this.manager.on('resume', this.onManagerResume, this);

            // suspend immediately if manager is suspended
            if (this.manager.suspended)
                this.onManagerSuspend();
        },

        /**
         * @private
         * @function
         * @name Channel#pause
         * @description Pause playback of sound. Call unpause() to resume playback from the same position.
         */
        pause: function () {
            if (this.source) {
                this.paused = true;

                this.startOffset += this.manager.context.currentTime - this.startTime;
                this.source.stop(0);
                this.source = null;
            }
        },

        /**
         * @private
         * @function
         * @name Channel#unpause
         * @description Resume playback of the sound. Playback resumes at the point that the audio was paused.
         */
        unpause: function () {
            if (this.source || !this.paused) {
                console.warn('Call pause() before unpausing.');
                return;
            }

            this._createSource();
            if (!this.source) {
                return;
            }

            this.startTime = this.manager.context.currentTime;
            this.source.start(0, this.startOffset % this.source.buffer.duration);

            // Initialize parameters
            this.setVolume(this.volume);
            this.setLoop(this.loop);
            this.setPitch(this.pitch);

            this.paused = false;
        },

        /**
         * @private
         * @function
         * @name Channel#stop
         * @description Stop playback of sound. Calling play() again will restart playback from the beginning of the sound.
         */
        stop: function () {
            if (this.source) {
                this.source.stop(0);
                this.source = null;
            }

            this.manager.off('volumechange', this.onManagerVolumeChange, this);
            this.manager.off('suspend', this.onManagerSuspend, this);
            this.manager.off('resume', this.onManagerResume, this);
        },

        /**
         * @private
         * @function
         * @name Channel#setVolume
         * @description Set the volume of playback between 0 and 1.
         * @param {number} volume - The volume of the sound. Will be clamped between 0 and 1.
         */
        setVolume: function (volume) {
            volume = math.clamp(volume, 0, 1);
            this.volume = volume;
            if (this.gain) {
                this.gain.gain.value = volume * this.manager.volume;
            }
        },

        setPitch: function (pitch) {
            this.pitch = pitch;
            if (this.source) {
                this.source.playbackRate.value = pitch;
            }
        },

        isPlaying: function () {
            return (!this.paused && (this.source.playbackState === this.source.PLAYING_STATE));
        },

        getDuration: function () {
            return this.source ? this.source.buffer.duration : 0;
        },

        _createSource: function () {
            const context = this.manager.context;

            if (this.sound.buffer) {
                this.source = context.createBufferSource();
                this.source.buffer = this.sound.buffer;

                // Connect up the nodes
                this.source.connect(this.gain);
                this.gain.connect(context.destination);

                if (!this.loop) {
                    // mark source as paused when it ends
                    this.source.onended = this.pause.bind(this);
                }
            }
        }
    });
} else if (hasAudio()) {
    Object.assign(Channel.prototype, {
        play: function () {
            if (this.source) {
                this.paused = false;
                this.setVolume(this.volume);
                this.setLoop(this.loop);
                this.setPitch(this.pitch);
                this.source.play();
            }

            this.manager.on('volumechange', this.onManagerVolumeChange, this);
            this.manager.on('suspend', this.onManagerSuspend, this);
            this.manager.on('resume', this.onManagerResume, this);

            // suspend immediately if manager is suspended
            if (this.manager.suspended)
                this.onManagerSuspend();

        },

        pause: function () {
            if (this.source) {
                this.paused = true;
                this.source.pause();
            }
        },

        unpause: function () {
            if (this.source) {
                this.paused = false;
                this.source.play();
            }
        },

        stop: function () {
            if (this.source) {
                this.source.pause();
            }

            this.manager.off('volumechange', this.onManagerVolumeChange, this);
            this.manager.off('suspend', this.onManagerSuspend, this);
            this.manager.off('resume', this.onManagerResume, this);
        },

        setVolume: function (volume) {
            volume = math.clamp(volume, 0, 1);
            this.volume = volume;
            if (this.source) {
                this.source.volume = volume * this.manager.volume;
            }
        },

        setPitch: function (pitch) {
            this.pitch = pitch;
            if (this.source) {
                this.source.playbackRate = pitch;
            }
        },

        getDuration: function () {
            return this.source && !isNaN(this.source.duration) ? this.source.duration : 0;
        },

        isPlaying: function () {
            return !this.source.paused;
        }
    });
}

export { Channel };
