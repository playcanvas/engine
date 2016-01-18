pc.extend(pc, function () {
    'use strict';

    var SoundInstance;

    var STATE_PLAYING = 0;
    var STATE_PAUSED = 1;
    var STATE_STOPPED = 2;

    var isFirefox = (typeof InstallTrigger !== 'undefined');

    var capTime = function (time, duration) {
        return (time % duration) || 0;
    };

    if (pc.SoundManager.hasAudioContext()) {
        /**
        * @private
        * @name pc.SoundInstance
        * @class A pc.SoundInstance plays a {@link pc.Sound}
        * @param {pc.SoundManager} manager The sound manager
        * @param {pc.Sound} sound The sound to play
        * @param {Object} options
        * @param {Number} [options.volume=1] The playback volume, between 0 and 1.
        * @param {Number} [options.pitch=1] The relative pitch, default of 1, plays at normal pitch.
        * @param {Boolean} [options.loop=false] Whether the sound should loop when it reaches the end or not.
        */
        SoundInstance = function (manager, sound, options) {
            pc.events.attach(this);

            options = options || {};

            this._volume = options.volume !== undefined ? pc.math.clamp(Number(options.volume) || 0, 0, 1) : 1;
            this._pitch = options.pitch !== undefined ? Math.max(0.01, Number(options.pitch) || 0) : 1;
            this._loop = !!(options.loop !== undefined ? options.loop : false);

            this._sound = sound;

            this._state = STATE_STOPPED;

            this._suspended = false;
            this._suspendEndEvent = false;
            this._suspendInstanceEvents = false;

            this._startTime = Math.max(0, Number(options.startTime) || 0);
            this._duration = Math.max(0, Number(options.duration) || 0);

            this._startedAt = 0;
            this._pausedAt = 0;
            this._startOffset = null;

            this._currentTime = 0;
            this._calculatedCurrentTimeAt = 0;

            this._playWhenLoaded = true;

            this._manager = manager;

            this._inputNode = null;
            this._connectorNode = null;

            this._firstNode = null;
            this._lastNode = null;

            this._initializeNodes();

            this.source = null;
            this._createSource();
        };

        SoundInstance.prototype = {
            _initializeNodes: function () {
                this.gain = this._manager.context.createGain();
                this._inputNode = this.gain;
                this._connectorNode = this.gain;
                this._connectorNode.connect(this._manager.context.destination);
            },

            /**
             * @private
             * @function
             * @name pc.SoundInstance#play
             * @description Begin playback of sound
             */
            play: function () {
                if (this._state !== STATE_STOPPED) {
                    this.stop();
                }

                if (!this.source) {
                    return false;
                }

                var offset = capTime(this._startOffset, this.duration);
                offset = capTime(this._startTime + offset, this._sound.duration);
                // reset start offset now that we started the sound
                this._startOffset = null;

                if (this._duration) {
                    this.source.start(0, offset, this._duration);
                } else {
                    this.source.start(0, offset);
                }

                this._startedAt = this._manager.context.currentTime - offset;
                this._pausedAt = 0;
                this._currentTime = 0;
                this._calculatedCurrentTimeAt = this._manager.context.currentTime;

                this._state = STATE_PLAYING;
                this._playWhenLoaded = false;

                // Initialize volume and loop - note moved to be after start() because of Chrome bug
                this.volume = this._volume;
                this.loop = this._loop;
                this.pitch = this._pitch;

                this._manager.on('volumechange', this._onManagerVolumeChange, this);
                this._manager.on('suspend', this._onManagerSuspend, this);
                this._manager.on('resume', this._onManagerResume, this);

                // suspend immediately if manager is suspended
                if (this._manager.suspended)
                    this._onManagerSuspend();

                if (! this._suspendInstanceEvents)
                    this.fire('play', this);

                return true;
            },

            /**
             * @private
             * @function
             * @name pc.SoundInstance#pause
             * @description Pause playback of sound. Call resume() to resume playback from the same position
             */
            pause: function () {
                if (this._state !== STATE_PLAYING || !this.source)
                    return false;

                this._state = STATE_PAUSED;
                this._pausedAt = capTime(this._manager.context.currentTime - this._startedAt, this.duration);
                this._currentTime = capTime(this._currentTime + (this._manager.context.currentTime - this._calculatedCurrentTimeAt) * this.pitch, this.duration);
                this._calculatedCurrentTimeAt = this._manager.context.currentTime;

                this._suspendEndEvent = true;
                this.source.stop(0);
                this._createSource();
                this._playWhenLoaded = false;
                this._startOffset = null;

                if (! this._suspendInstanceEvents)
                    this.fire('pause', this);

                return true;
            },

            unpause: function () {
                console.warn('DEPRECATED: "unpause" is deprecated. Please call "resume" instead');
                return this.resume();
            },

            /**
             * @private
             * @function
             * @name pc.SoundInstance#resume
             * @description Resume playback of the sound. Playback resumes at the point that the audio was paused
             */
            resume: function () {
                if (this._state !== STATE_PAUSED || !this.source) {
                    return false;
                }

                var offset = this._pausedAt;
                if (this._startOffset !== null) {
                    offset = capTime(this._startOffset, this.duration);
                    offset = capTime(this._startTime + offset, this._sound.duration);
                }

                // reset offset
                this._startOffset = null;

                if (this._duration) {
                    this.source.start(0, offset, this._duration);
                } else {
                    this.source.start(0, offset);
                }
                this._state = STATE_PLAYING;

                // Initialize parameters
                this.volume = this._volume;
                this.loop = this._loop;
                this.pitch = this._pitch;
                this._playWhenLoaded = false;

                if (! this._suspendInstanceEvents)
                    this.fire('resume', this);

                return true;
            },

            /**
             * @private
             * @function
             * @name pc.SoundInstance#stop
             * @description Stop playback of sound. Calling play() again will restart playback from the beginning of the sound.
             */
            stop: function () {
                if (this._state === STATE_STOPPED || !this.source)
                    return false;

                this._manager.off('volumechange', this._onManagerVolumeChange, this);
                this._manager.off('suspend', this._onManagerSuspend, this);
                this._manager.off('resume', this._onManagerResume, this);

                this._startedAt = 0;
                this._pausedAt = 0;
                this._startOffset = null;
                this._playWhenLoaded = false;

                this._suspendEndEvent = true;
                if (this._state === STATE_PLAYING) {
                    this.source.stop(0);
                }

                this._state = STATE_STOPPED;
                this._createSource();

                if (! this._suspendInstanceEvents)
                    this.fire('stop', this);

                return true;
            },

            setExternalNodes: function (firstNode, lastNode) {
                if (! firstNode) {
                    logError('The firstNode must be a valid Audio Node');
                    return;
                }

                if (! lastNode) {
                    lastNode = firstNode;
                }

                // connections are:
                // source -> inputNode -> connectorNode -> [firstNode -> ... -> lastNode] -> speakers

                var speakers = this._manager.context.destination;

                if (this._firstNode !== firstNode) {
                    if (this._firstNode) {
                        this._connectorNode.disconnect(this._firstNode);
                    } else {
                        this._connectorNode.disconnect(speakers);
                    }

                    this._firstNode = firstNode;
                    this._connectorNode.connect(firstNode);
                }

                if (this._lastNode !== lastNode) {
                    if (this._lastNode) {
                        this._lastNode.disconnect(speakers);
                    }

                    this._lastNode = lastNode;
                    this._lastNode.connect(speakers);
                }
            },

            clearExternalNodes: function () {
                var speakers = this._manager.context.destination;

                if (this._firstNode) {
                    this._connectorNode.disconnect(this._firstNode);
                    this._firstNode = null;
                }

                if (this._lastNode) {
                    this._lastNode.disconnect(speakers);
                    this._lastNode = null;
                }

                this._connectorNode.connect(speakers);
            },


            getExternalNodes: function () {
                return [this._firstNode, this._lastNode];
            },

            _createSource: function () {
                if (! this._sound) {
                    return null;
                }

                var context = this._manager.context;

                if (this._sound.buffer) {
                    this.source = context.createBufferSource();
                    this.source.buffer = this._sound.buffer;

                    // Connect up the nodes
                    this.source.connect(this._inputNode);
                    this.source.onended = this._onEnded.bind(this);

                    this.source.loopStart = capTime(this._startTime, this.source.buffer.duration);
                    if (this._duration) {
                        this.source.loopEnd = Math.max(this.source.loopStart, capTime(this._startTime + this._duration, this.source.buffer.duration));
                    }

                    if (! this._suspendInstanceEvents)
                        this.fire('ready', this.source);
                }

                return this.source;
            },

            _onEnded: function () {
                // the callback is not fired synchronously
                // so only reset _suspendEndEvent to false when the
                // callback is fired
                if (this._suspendEndEvent) {
                    this._suspendEndEvent = false;
                    return;
                }

                this.fire('end', this);
                this.stop();
            }
        };

        Object.defineProperty(SoundInstance.prototype, 'volume', {
            get: function () {
                return this._volume;
            },

            set: function (volume) {
                volume = pc.math.clamp(volume, 0, 1);
                this._volume = volume;
                if (this.gain) {
                    this.gain.gain.value = volume * this._manager.volume;
                }
            }
        });

        Object.defineProperty(SoundInstance.prototype, 'pitch', {
            get: function () {
                return this._pitch;
            },

            set: function (pitch) {
                var old = this._pitch;

                if (this._startedAt) {
                    this._currentTime = capTime(this._currentTime + (this._manager.context.currentTime - this._calculatedCurrentTimeAt) * old, this.duration);
                    this._calculatedCurrentTimeAt = this._manager.context.currentTime;
                }

                this._pitch = Math.max(Number(pitch) || 0, 0.01);
                if (this.source) {
                    this.source.playbackRate.value = this._pitch;
                }

            }
        });

        Object.defineProperty(SoundInstance.prototype, 'loop', {
            get: function () {
                return this._loop;
            },

            set: function (loop) {
                this._loop = !!loop;
                if (this.source) {
                    this.source.loop = this._loop;
                }
            }
        });

        Object.defineProperty(SoundInstance.prototype, 'sound', {
            get: function () {
                return this._sound;
            },

            set: function (value) {
                this._sound = value;

                if (!this.isStopped) {
                    this.stop();
                } else {
                    this._createSource();
                }
            }
        });

        Object.defineProperty(SoundInstance.prototype, 'isPlaying', {
            get: function () {
                return this._state === STATE_PLAYING &&
                        !!this.source &&
                        this.source.playbackState === this.source.PLAYING_STATE;
            }
        });

        Object.defineProperty(SoundInstance.prototype, 'isPaused', {
            get: function () {
                return this._state === STATE_PAUSED;
            }
        });

        Object.defineProperty(SoundInstance.prototype, 'isStopped', {
            get: function () {
                return this._state === STATE_STOPPED;
            }
        });

        Object.defineProperty(SoundInstance.prototype, 'currentTime', {
            get: function () {
                if (this._startOffset !== null) {
                    return this._startOffset;
                }

                if (this.isStopped || !this.source) {
                    return 0;
                }

                this._currentTime = capTime(this._currentTime + (this._manager.context.currentTime - this._calculatedCurrentTimeAt) * this.pitch, this.duration);
                this._calculatedCurrentTimeAt = this._manager.context.currentTime;
                return this._currentTime;
            },
            set: function (value) {
                if (this.isPlaying) {
                    this.stop();

                    var suspend = this._suspendInstanceEvents;
                    this._suspendInstanceEvents = true;
                    this._startOffset = value;
                    this.play();
                    this._suspendInstanceEvents = suspend;
                } else {
                    this._startOffset = value;
                    this._currentTime = value;
                    this._calculatedCurrentTimeAt = this._manager.context.currentTime;
                }
            }
        });

    } else if (pc.SoundManager.hasAudio()) {
        SoundInstance = function (manager, resource, options) {
            pc.events.attach(this);

            options = options || {};

            this._volume = options.volume !== undefined ? pc.math.clamp(Number(options.volume) || 0, 0, 1) : 1;
            this._pitch = options.pitch !== undefined ? Math.max(0.01, Number(options.pitch) || 0) : 1;
            this._loop = !!(options.loop !== undefined ? options.loop : false);

            this._sound = resource;
            this._state = STATE_STOPPED;
            this._suspended = false;
            this._suspendEndEvent = false;
            this._suspendInstanceEvents = false;
            this._playWhenLoaded = true;

            this._startTime = Math.max(0, Number(options.startTime) || 0);
            this._duration = Math.max(0, Number(options.duration) || 0);
            this._startOffset = null;

            this._isReady = isFirefox ? false : true;

            this._manager = manager;
            this._manager.on('destroy', this._onManagerDestroy, this);

            this.source = null;
            this._createSource();
        };

        SoundInstance.prototype = {
            play: function () {
                if (this._state !== STATE_STOPPED) {
                    this.stop();
                }

                if (! this.source) {
                    return false;
                }

                this.volume = this._volume;
                this.pitch = this._pitch;
                this.loop = this._loop;

                // set the start time for the audio. Firefox
                // does this in 'canplaythrough' handler
                if (! isFirefox) {
                    var offset = capTime(this._startOffset, this.duration);
                    offset = capTime(this._startTime + offset, this._sound.duration);
                    this._startOffset = null;
                    this.source.currentTime = offset;
                }

                this.source.play();
                this._state = STATE_PLAYING;
                this._playWhenLoaded = false;

                this._manager.on('volumechange', this._onManagerVolumeChange, this);
                this._manager.on('suspend', this._onManagerSuspend, this);
                this._manager.on('resume', this._onManagerResume, this);

                // suspend immediately if manager is suspended
                if (this._manager.suspended)
                    this._onManagerSuspend();

                if (! this._suspendInstanceEvents)
                    this.fire('play', this);

                return true;

            },

            pause: function () {
                if (! this.source || this._state !== STATE_PLAYING)
                    return false;

                this._suspendEndEvent = true;
                this.source.pause();
                this._playWhenLoaded = false;
                this._state = STATE_PAUSED;
                this._startOffset = null;

                if (! this._suspendInstanceEvents)
                    this.fire('pause', this);

                return true;
            },

            unpause: function () {
                console.warn('DEPRECATED: "unpause" is deprecated. Please call "resume" instead');
                return this.resume();
            },

            resume: function () {
                if (! this.source || this._state !== STATE_PAUSED)
                    return false;

                this._state = STATE_PLAYING;
                this._playWhenLoaded = false;
                if (this.source.paused) {
                    this.source.play();

                    if (! this._suspendInstanceEvents)
                        this.fire('resume', this);
                }

                return true;
            },

            stop: function () {
                if (! this.source || this._state === STATE_STOPPED)
                    return false;

                this._manager.off('volumechange', this._onManagerVolumeChange, this);
                this._manager.off('suspend', this._onManagerSuspend, this);
                this._manager.off('resume', this._onManagerResume, this);

                this._suspendEndEvent = true;
                this.source.pause();
                this._playWhenLoaded = false;
                this._state = STATE_STOPPED;
                this._startOffset = null;

                if (! this._suspendInstanceEvents)
                    this.fire('stop', this);

                return true;
            },

            connect: function () {
                console.warn('Cannot connect audio nodes to sound instance because Audio Context is not supported');
            },

            _createSource: function () {
                if (this._sound && this._sound.audio) {
                    if (isFirefox)
                        this._isReady = false;

                    this.source = this._sound.audio.cloneNode(true);

                    // necessary for Firefox - we cannot set the currentTime
                    // on an audio element clone unless we wait for it to be ready first
                    if (isFirefox) {
                        var onReady = function () {
                            this.source.removeEventListener('canplaythrough', onReady);
                            this._isReady = true;
                            var offset = capTime(this._startTime + this._startOffset, this._sound.duration);
                            // reset currentTime
                            this._startOffset = null;

                            // set offset on source
                            this.source.currentTime = offset;
                        }.bind(this);

                        this.source.addEventListener('canplaythrough', onReady);
                    }


                    this._timeUpdateHandler = this._onTimeUpdate.bind(this);
                    this.source.addEventListener('timeupdate', this._timeUpdateHandler);
                    this.source.onended = this._onEnded.bind(this);

                    if (! this._suspendInstanceEvents)
                        this.fire('ready', this.source);
                }

                return this.source;
            },

            _onTimeUpdate: function () {
                if (!this._duration)
                    return;

                if (this.source.currentTime > capTime(this._startTime + this._duration, this.source.duration)) {
                    if (this.loop) {
                        this.source.currentTime = capTime(this._startTime, this.source.duration);
                    } else {
                        // remove listener to prevent multiple calls
                        this.source.removeEventListener('timeupdate', this._timeUpdateHandler);
                        this.source.pause();
                        this._onEnded();
                    }
                }
            },

            _onEnded: function () {
                // the callback is not fired synchronously
                // so only reset _suspendEndEvent to false when the
                // callback is fired
                if (this._suspendEndEvent) {
                    this._suspendEndEvent = false;
                    return;
                }

                this.fire('end', this);
                this.stop();
            },

            _onManagerDestroy: function () {
                if (this.source) {
                    this.source.pause();
                }
            }
        };

        Object.defineProperty(SoundInstance.prototype, 'volume', {
            get: function () {
                return this._volume;
            },

            set: function (volume) {
                volume = pc.math.clamp(volume, 0, 1);
                this._volume = volume;
                if (this.source) {
                    this.source.volume = volume * this._manager.volume;
                }
            }
        });

        Object.defineProperty(SoundInstance.prototype, 'pitch', {
            get: function () {
                return this._pitch;
            },

            set: function (pitch) {
                this._pitch = Math.max(Number(pitch) || 0, 0.01);
                if (this.source) {
                    this.source.playbackRate = this._pitch;
                }
            }
        });

        Object.defineProperty(SoundInstance.prototype, 'loop', {
            get: function () {
                return this._loop;
            },

            set: function (loop) {
                this._loop = !!loop;
                if (this.source) {
                    this.source.loop = this._loop;
                }
            }
        });

        Object.defineProperty(SoundInstance.prototype, 'sound', {
            get: function () {
                return this._sound;
            },

            set: function (value) {
                this.stop();
                this._sound = value;
                this._createSource();
            }
        });


        Object.defineProperty(SoundInstance.prototype, 'isPlaying', {
            get: function () {
                return this._state === STATE_PLAYING;
            }
        });

        Object.defineProperty(SoundInstance.prototype, 'isPaused', {
            get: function () {
                return this._state === STATE_PAUSED;
            }
        });

        Object.defineProperty(SoundInstance.prototype, 'isStopped', {
            get: function () {
                return this._state === STATE_STOPPED;
            }
        });

        Object.defineProperty(SoundInstance.prototype, 'currentTime', {
            get: function () {
                if (this._startOffset !== null) {
                    return this._startOffset;
                }

                if (this.isStopped || !this.source) {
                    return 0;
                }

                return this.source.currentTime - this._startTime;
            },
            set: function (value) {
                this._startOffset = value;
                if (this.source && this._isReady) {
                    this.source.currentTime = capTime(this._startTime + capTime(value, this.duration), this._sound.duration);
                    this._startOffset = null;
                }
            }
        });

    } else {
        console.warn('No support for 2D audio found');
        SoundInstance = function () {
        };
    }

    // Add functions which don't depend on source type
    pc.extend(SoundInstance.prototype, {
        /**
         * @private
         * @function
         * @name pc.SoundInstance#_onManagerVolumeChange
         * @description Handle the manager's 'volumechange' event.
         */
        _onManagerVolumeChange: function () {
            this.volume = this._volume;
        },

        /**
         * @private
         * @function
         * @name pc.SoundInstance#_onManagerSuspend
         * @description Handle the manager's 'suspend' event.
         */
        _onManagerSuspend: function () {
            if (this.isPlaying && !this._suspended) {
                this._suspended = true;
                this.pause();
            }
        },

        /**
         * @private
         * @function
         * @name pc.SoundInstance#_onManagerResume
         * @description Handle the manager's 'resume' event.
         */
        _onManagerResume: function () {
            if (this._suspended) {
                this._suspended = false;
                this.resume();
            }
        }
    });

    Object.defineProperty(SoundInstance.prototype, 'startTime', {
        get: function () {
            return this._startTime;
        },

        set: function (value) {
            this._startTime = Math.max(0, Number(value) || 0);

            // restart
            var isPlaying = this.isPlaying;
            this.stop();
            if (isPlaying) {
                this.play();
            }
        }
    });

    Object.defineProperty(SoundInstance.prototype, 'duration', {
        get: function () {
            if (! this._sound)
                return 0;

            if (this._duration) {
                return capTime(this._duration, this._sound.duration);
            } else {
                return this._sound.duration;
            }
        },
        set: function (value) {
            this._duration = Math.max(0, Number(value) || 0);

            // restart
            var isPlaying = this.isPlaying;
            this.stop();
            if (isPlaying) {
                this.play();
            }
        }
    });


    return {
        SoundInstance: SoundInstance
    };
}());
