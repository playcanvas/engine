import { math } from '../../core/math/math.js';

import { hasAudioContext } from './capabilities.js';

/**
 * A channel is created when the {@link SoundManager} begins playback of a {@link Sound}. Usually
 * created internally by {@link SoundManager#playSound} or {@link SoundManager#playSound3d}.
 * Developers usually won't have to create Channels manually.
 *
 * @ignore
 */
class Channel {
    /**
     * Create a new Channel instance.
     *
     * @param {import('../sound/manager.js').SoundManager} manager - The SoundManager instance.
     * @param {import('../sound/sound.js').Sound} sound - The sound to playback.
     * @param {object} [options] - Optional options object.
     * @param {number} [options.volume] - The playback volume, between 0 and 1. Defaults to 1.
     * @param {number} [options.pitch] - The relative pitch. Defaults to 1 (plays at normal pitch).
     * @param {boolean} [options.loop] - Whether the sound should loop when it reaches the
     * end or not. Defaults to false.
     */
    constructor(manager, sound, options = {}) {
        this.volume = options.volume ?? 1;
        this.loop = options.loop ?? false;
        this.pitch = options.pitch ?? 1;

        this.sound = sound;

        this.paused = false;
        this.suspended = false;

        this.manager = manager;

        /** @type {globalThis.Node | null} */
        this.source = null;

        if (hasAudioContext()) {
            this.startTime = 0;
            this.startOffset = 0;

            const context = manager.context;
            this.gain = context.createGain();
        } else if (sound.audio) {
            // handle the case where sound was
            this.source = sound.audio.cloneNode(false);
            this.source.pause(); // not initially playing
        }
    }

    /**
     * Get the current value for the volume. Between 0 and 1.
     *
     * @returns {number} The volume of the channel.
     */
    getVolume() {
        return this.volume;
    }

    /**
     * Get the current looping state of the Channel.
     *
     * @returns {boolean} The loop property for the channel.
     */
    getLoop() {
        return this.loop;
    }

    /**
     * Enable/disable the loop property to make the sound restart from the beginning when it
     * reaches the end.
     *
     * @param {boolean} loop - True to loop the sound, false otherwise.
     */
    setLoop(loop) {
        this.loop = loop;
        if (this.source) {
            this.source.loop = loop;
        }
    }

    /**
     * Get the current pitch of the Channel.
     *
     * @returns {number} The pitch of the channel.
     */
    getPitch() {
        return this.pitch;
    }

    /**
     * Handle the manager's 'volumechange' event.
     */
    onManagerVolumeChange() {
        this.setVolume(this.getVolume());
    }

    /**
     * Handle the manager's 'suspend' event.
     */
    onManagerSuspend() {
        if (this.isPlaying() && !this.suspended) {
            this.suspended = true;
            this.pause();
        }
    }

    /**
     * Handle the manager's 'resume' event.
     */
    onManagerResume() {
        if (this.suspended) {
            this.suspended = false;
            this.unpause();
        }
    }

    /**
     * Begin playback of sound.
     */
    play() {
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
    }

    /**
     * Pause playback of sound. Call unpause() to resume playback from the same position.
     */
    pause() {
        if (this.source) {
            this.paused = true;

            this.startOffset += this.manager.context.currentTime - this.startTime;
            this.source.stop(0);
            this.source = null;
        }
    }

    /**
     * Resume playback of the sound. Playback resumes at the point that the audio was paused.
     */
    unpause() {
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
    }

    /**
     * Stop playback of sound. Calling play() again will restart playback from the beginning of the
     * sound.
     */
    stop() {
        if (this.source) {
            this.source.stop(0);
            this.source = null;
        }

        this.manager.off('volumechange', this.onManagerVolumeChange, this);
        this.manager.off('suspend', this.onManagerSuspend, this);
        this.manager.off('resume', this.onManagerResume, this);
    }

    /**
     * Set the volume of playback between 0 and 1.
     *
     * @param {number} volume - The volume of the sound. Will be clamped between 0 and 1.
     */
    setVolume(volume) {
        volume = math.clamp(volume, 0, 1);
        this.volume = volume;
        if (this.gain) {
            this.gain.gain.value = volume * this.manager.volume;
        }
    }

    setPitch(pitch) {
        this.pitch = pitch;
        if (this.source) {
            this.source.playbackRate.value = pitch;
        }
    }

    isPlaying() {
        return (!this.paused && (this.source.playbackState === this.source.PLAYING_STATE));
    }

    getDuration() {
        return this.source ? this.source.buffer.duration : 0;
    }

    _createSource() {
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
}

if (!hasAudioContext()) {
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
