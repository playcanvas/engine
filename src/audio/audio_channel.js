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
        * @param {Number} [options.volume=1] The playback volume, between 0 and 1.
        * @param {Boolean} [options.loop=false] Whether the sound should loop when it reaches the end or not.
        */
        Channel = function (manager, sound, options) {
            options = options || {};
            this.volume = (typeof options.volume === 'undefined') ? 1 : options.volume;
            this.loop = (typeof options.loop === 'undefined') ? false : options.loop;
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
        
        Channel.prototype = {
            /**
            * @function
            * @name pc.audio.Channel#play
            * @description Begin playback of sound
            */
            play: function () {
                if (this.source) {
                    throw new Error('Call stop() before calling play()');
                }

                this._createSource();

                // Initialize volume and loop
                this.setVolume(this.volume);
                this.setLoop(this.loop);

                this.startTime = this.manager.context.currentTime;
                this.source.start(0, this.startOffset % this.source.buffer.duration);

                this.manager.on('volumechange', this.onManagerVolumeChange, this);
                this.manager.on('suspend', this.onManagerSuspend, this);
                this.manager.on('resume', this.onManagerResume, this);
            },

            /**
            * @function
            * @name pc.audio.Channel#pause
            * @description Pause playback of sound. Call unpause() to resume playback from the same position
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
            * @function
            * @name pc.audio.Channel#unpause
            * @description Resume playback of the sound. Playback resumes at the point that the audio was paused
            */
            unpause: function () {
                if (this.source || !this.paused) {
                    throw new Error('Call pause() before unpausing.');
                }

                this._createSource();

                // Initialize volume and loop
                this.setVolume(this.volume);
                this.setLoop(this.loop);

                this.startTime = this.manager.context.currentTime;
                this.source.start(0, this.startOffset % this.source.buffer.duration);

                this.paused = false;
            },

            /**
            * @function 
            * @name pc.audio.Channel#stop
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
                if (this.gain) {
                    this.gain.gain.value = volume * this.manager.getVolume();
                }
            },

            isPlaying: function () {
                return (!this.paused && (this.source.playbackState === this.source.PLAYING_STATE));
            },

            getDuration: function () {
                if (this.source) {
                    return this.source.buffer.duration;
                }
                else {
                    return 0;
                }
            },

            _createSource: function () {
                var context = this.manager.context;

                this.source = context.createBufferSource();
                this.source.buffer = this.sound.buffer;

                // Connect up the nodes
                this.source.connect(this.gain);
                this.gain.connect(context.destination);
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
            
            this.source = sound.audio.cloneNode(false);
            this.source.pause(); // not initially playing
        };
        
        Channel.prototype = {
            play: function () {
                if (this.source) {
                    this.paused = false;
                    this.setVolume(this.volume);
                    this.setLoop(this.loop);
                    this.source.play();
                }

                this.manager.on('volumechange', this.onManagerVolumeChange, this);
                this.manager.on('suspend', this.onManagerSuspend, this);
                this.manager.on('resume', this.onManagerResume, this);

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
                    // Reset to beginning of sample.
                    this.source.currentTime = 0;
                }

                this.manager.off('volumechange', this.onManagerVolumeChange, this);
                this.manager.off('suspend', this.onManagerSuspend, this);
                this.manager.off('resume', this.onManagerResume, this);
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

            getDuration: function () {
                if (this.source) {
                    var d = this.source.duration;
                    if (d === d) {
                        // Not NaN
                        return d;
                    }
                }

                return 0;
            },

            isPlaying: function () {
                return !this.source.paused;
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
                this.unpause();
            }
        }
    });

    return {
        Channel: Channel
    };
}());
