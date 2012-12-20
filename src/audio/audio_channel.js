pc.extend(pc.audio, function () {
    var Channel;
    
    if (pc.audio.hasAudioContext()) {
        /**
        * @name pc.audio.Channel
        * @class A channel is created when the pc.audio.AudioManager begins playback of a pc.audio.Sound. Usually created internally by 
        * pc.audio.AudioManager#playSound or pc.audio.AudioManager#playSound3d. Developers usually won't have to create Channels manually.
        * @param {pc.audio.AudioManager} manager The AudioManager instance
        * @param {pc.audio.Sound} sound The sound to playback
        * @param {Object} options
        * @param {Number} [options.volume] The playback volume, between 0 and 1.
        * @param {Boolean} [options.loop] Whether the sound should loop when it reaches the end or not.
        */
        Channel = function (manager, sound, options) {
            options = options || {};
            this.volume = options.volume || 1;
            this.loop = options.loop || false;
            this.sound = sound;
                
            this.paused = false;
            this.suspended = false;

            this.startedAt = null;
            this.pausedAt = null;

            this.manager = manager;
            this.manager.on('volumechange', this.onManagerVolumeChange, this)
            this.manager.on('suspend', this.onManagerSuspend, this);
            this.manager.on('resume', this.onManagerResume, this);

            this.source = null;

            this.resetTimeout = null;
        };
        
        Channel.prototype = {
            /**
            * @function
            * @name pc.audio.Channel#play
            * @description Begin playback of sound
            */
            play: function () {
                this.source = this.manager.context.createBufferSource();
                this.source.buffer = this.sound.buffer;
                this.source.connect(this.manager.context.destination);
                this.startedAt = this.manager.context.currentTime;

                // Initialize volume and loop
                this.setVolume(this.volume);
                this.setLoop(this.loop);

                if (!this.paused) {
                    // First call to play(), store the startedAt time to use when restarting if paused
                    this.source.noteOn(0);
                } else {
                    this.startedAt -= this.pausedAt;
                    var remainingTime = this.source.buffer.duration - this.pausedAt;
                    this.source.noteGrainOn(0, this.pausedAt, remainingTime);

                    var channel = this;
                    this.resetTimeout = setTimeout(function () {
                            // The loop property may have changed since the sound was restarted so check...
                            if (channel.getLoop()) {
                                channel.stop();
                                channel.play();
                            }
                        }, remainingTime * 1000);

                    this.paused = false;
                }
            },

            /**
            * @function
            * @name pc.audio.Channel#pause
            * @description Pause playback of sound. Call play() to resume playback from the same position
            */
            pause: function () {
                if (this.source) {
                    if (this.resetTimeout !== null) {
                      clearTimeout(this.resetTimeout);
                    }
                    this.paused = true;
                    this.pausedAt = (this.manager.context.currentTime - this.startedAt) % this.source.buffer.duration;
                    this.source.noteOff(0);
                }
            },
            
            /**
            * @function 
            * @name pc.audio.Channel#stop
            * @description Stop playback of sound. Calling play() again will restart playback from the beginning of the sound.
            */
            stop: function () {
                if (this.source) {
                    if (this.resetTimeout !== null) {
                      clearTimeout(this.resetTimeout);
                    }
                    this.source.noteOff(0);
                    this.source = null;
                }
            },
            
            /**
            * @function
            * @name pc.audio.Channel#setLoop
            * @description Enable/disable the loop property to make the sound restart from the beginning when it reaches the end.
            */
            setLoop: function (loop) {
                this.loop = loop;
                if (this.source) {
                    this.source.loop = loop;
                }
            },

            /**
            * @function 
            * @name pc.audio.Channel#setVolume
            * @description Set the volume of playback between 0 and 1.
            */
            setVolume: function (volume) {
                this.volume = volume;
                if (this.source) {
                    this.source.gain.value = volume * this.manager.getVolume();
                }
            },

            isPlaying: function () {
                return this.source.playbackState === this.source.PLAYING_STATE;
            }

        };
    } else if (pc.audio.hasAudio()) {
        Channel = function (manager, sound, options) {
            this.volume = options.volume || 1;
            this.loop = options.loop || false;
            this.sound = sound;

            this.paused = false;
            this.suspended = false;

            this.manager = manager;
            this.manager.on('volumechange', this.onManagerVolumeChange, this)
            this.manager.on('suspend', this.onManagerSuspend, this);
            this.manager.on('resume', this.onManagerResume, this);
            
            this.source = sound.audio.cloneNode(false);
            this.source.pause(); // not initially playing
        }
        
        Channel.prototype = {
            play: function () {
                if (this.source) {
                    this.paused = false;
                    this.setVolume(this.volume);
                    this.setLoop(this.loop);
                    this.source.play();
                }
            },

            pause: function () {
                if (this.source) {
                    this.paused = true;
                    this.source.pause();
                }
            },
            
            stop: function () {
                if (this.source) {                
                    this.source.pause();
                    // Reset to beginning of sample.
                    this.source.currentTime = 0;
                }
            },
            
            setVolume: function (volume) {
                this.volume = volume;
                if (this.source) {
                    this.source.volume = volume * this.manager.getVolume();
                }
            },
             
            setLoop: function (loop) {
                this.loop = loop;
                if (this.source) {
                    this.source.loop = loop;
                }
            },

            isPlaying: function () {
                return this.source.isPlaying();
            }
        };
    } else {
        console.warn('No support for 2D audio found');
        Channel = function () {
        };
    }

    // Add functions which don't depend on source type
    pc.extend(Channel.prototype, {
        /**
        * @function
        * @name pc.audio.Channel#getVolume
        * @description Get the current value for the volume. Between 0 and 1.
        */
        getVolume: function () {
            return this.volume;
        },

        /**
        * @function
        * @name pc.audio.Channel#getLoop
        * @description Get the current looping state of the Channel
        */
        getLoop: function () {
            return this.loop;
        },

        /**
        * @function
        * @private
        * @name pc.audio.Channel#onManagerVolumeChange
        * @description Handle the manager's 'volumechange' event.
        */
        onManagerVolumeChange: function () {
            this.setVolume(this.getVolume());
        },
        
        /**
        * @function
        * @private
        * @name pc.audio.Channel#onManagerSuspend
        * @description Handle the manager's 'suspend' event.
        */
        onManagerSuspend: function () {
            if (this.isPlaying() && !this.suspended) {
                this.suspended = true;
                this.pause();
            }
        },

        /**
        * @function
        * @private
        * @name pc.audio.Channel#onManagerResume
        * @description Handle the manager's 'resume' event.
        */
        onManagerResume: function () {
            if (this.suspended) {
                this.suspended = false;
                this.play();
            }
        }
    });

    return {
        Channel: Channel
    };
}());
