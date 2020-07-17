import { math } from '../math/math.js';

import { hasAudio, hasAudioContext } from './capabilities.js';

var Channel;

if (hasAudioContext()) {
    /**
     * @private
     * @class
     * @name pc.Channel
     * @classdesc A channel is created when the pc.SoundManager begins playback of a pc.Sound. Usually created internally by
     * pc.SoundManager#playSound or pc.SoundManager#playSound3d. Developers usually won't have to create Channels manually.
     * @param {pc.SoundManager} manager - The SoundManager instance.
     * @param {pc.Sound} sound - The sound to playback.
     * @param {object} [options] - Optional options object.
     * @param {number} [options.volume=1] - The playback volume, between 0 and 1.
     * @param {number} [options.pitch=1] - The relative pitch, default of 1, plays at normal pitch.
     * @param {boolean} [options.loop=false] - Whether the sound should loop when it reaches the end or not.
     */
    Channel = function (manager, sound, options) {
        options = options || {};
        this.volume = (options.volume === undefined) ? 1 : options.volume;
        this.loop = (options.loop === undefined) ? false : options.loop;
        this.pitch = (options.pitch === undefined ? 1 : options.pitch);

        this.sound = sound;

        this.paused = false;
        this.suspended = false;

        this.startTime = 0;
        this.startOffset = 0;

        this.manager = manager;

        this.source = null;
        var context = manager.context;
        this.gain = context.createGain();
    };

    Object.assign(Channel.prototype, {
        /**
         * @private
         * @function
         * @name pc.Channel#play
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
         * @name pc.Channel#pause
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
         * @name pc.Channel#unpause
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
         * @name pc.Channel#stop
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
         * @name pc.Channel#setLoop
         * @description Enable/disable the loop property to make the sound restart from the beginning when it reaches the end.
         * @param {boolean} loop - True to loop the sound, false otherwise.
         */
        setLoop: function (loop) {
            this.loop = loop;
            if (this.source) {
                this.source.loop = loop;
            }
        },

        /**
         * @private
         * @function
         * @name pc.Channel#setVolume
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
            var context = this.manager.context;

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
    Channel = function (manager, sound, options) {
        this.volume = options.volume || 1;
        this.loop = options.loop || false;
        this.sound = sound;
        this.pitch = options.pitch !== undefined ? options.pitch : 1;

        this.paused = false;
        this.suspended = false;

        this.manager = manager;

        // handle the case where sound was
        if (sound.audio) {
            this.source = sound.audio.cloneNode(false);
            this.source.pause(); // not initially playing
        }
    };

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

        setLoop: function (loop) {
            this.loop = loop;
            if (this.source) {
                this.source.loop = loop;
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
} else {
    Channel = function () {
    };
}

// Add functions which don't depend on source type
Object.assign(Channel.prototype, {
    /**
     * @private
     * @function
     * @name pc.Channel#getVolume
     * @description Get the current value for the volume. Between 0 and 1.
     * @returns {number} The volume of the channel.
     */
    getVolume: function () {
        return this.volume;
    },

    /**
     * @private
     * @function
     * @name pc.Channel#getLoop
     * @description Get the current looping state of the Channel.
     * @returns {boolean} The loop property for the channel.
     */
    getLoop: function () {
        return this.loop;
    },

    /**
     * @private
     * @function
     * @name pc.Channel#getPitch
     * @description Get the current pitch of the Channel.
     * @returns {number} The pitch of the channel.
     */
    getPitch: function () {
        return this.pitch;
    },

    /**
     * @private
     * @function
     * @name pc.Channel#onManagerVolumeChange
     * @description Handle the manager's 'volumechange' event.
     */
    onManagerVolumeChange: function () {
        this.setVolume(this.getVolume());
    },

    /**
     * @private
     * @function
     * @name pc.Channel#onManagerSuspend
     * @description Handle the manager's 'suspend' event.
     */
    onManagerSuspend: function () {
        if (this.isPlaying() && !this.suspended) {
            this.suspended = true;
            this.pause();
        }
    },

    /**
     * @private
     * @function
     * @name pc.Channel#onManagerResume
     * @description Handle the manager's 'resume' event.
     */
    onManagerResume: function () {
        if (this.suspended) {
            this.suspended = false;
            this.unpause();
        }
    }
});

export { Channel };
