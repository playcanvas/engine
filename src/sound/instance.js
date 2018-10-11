Object.assign(pc, function () {
    'use strict';

    var SoundInstance;

    var STATE_PLAYING = 0;
    var STATE_PAUSED = 1;
    var STATE_STOPPED = 2;

    // Return time % duration but always return a number
    // instead of NaN when duration is 0
    var capTime = function (time, duration) {
        return (time % duration) || 0;
    };

    if (pc.SoundManager.hasAudioContext()) {
       /**
        * @constructor
        * @name pc.SoundInstance
        * @classdesc A pc.SoundInstance plays a {@link pc.Sound}
        * @param {pc.SoundManager} manager The sound manager
        * @param {pc.Sound} sound The sound to play
        * @param {Object} options Options for the instance
        * @param {Number} [options.volume=1] The playback volume, between 0 and 1.
        * @param {Number} [options.pitch=1] The relative pitch, default of 1, plays at normal pitch.
        * @param {Boolean} [options.loop=false] Whether the sound should loop when it reaches the end or not.
        * @param {Number} [options.startTime=0] The time from which the playback will start in seconds. Default is 0 to start at the beginning.
        * @param {Number} [options.duration=null] The total time after the startTime in seconds when playback will stop or restart if loop is true.
        * @param {Function} [options.onPlay=null] Function called when the instance starts playing.
        * @param {Function} [options.onPause=null] Function called when the instance is paused.
        * @param {Function} [options.onResume=null] Function called when the instance is resumed.
        * @param {Function} [options.onStop=null] Function called when the instance is stopped.
        * @param {Function} [options.onEnd=null] Function called when the instance ends.
        * @property {Number} volume The volume modifier to play the sound with. In range 0-1.
        * @property {Number} pitch The pitch modifier to play the sound with. Must be larger than 0.01
        * @property {Number} startTime The start time from which the sound will start playing.
        * @property {Number} currentTime Gets or sets the current time of the sound that is playing. If the value provided is bigger than the duration of the instance it will wrap from the beginning.
        * @property {Number} duration The duration of the sound that the instance will play starting from startTime.
        * @property {Boolean} loop If true the instance will restart when it finishes playing
        * @property {Boolean} isPlaying Returns true if the instance is currently playing.
        * @property {Boolean} isPaused Returns true if the instance is currently paused.
        * @property {Boolean} isStopped Returns true if the instance is currently stopped.
        * @property {Boolean} isSuspended Returns true if the instance is currently suspended because the window is not focused.
        * @property {AudioBufferSourceNode} source Gets the source that plays the sound resource. If the Web Audio API is not supported the type of source is <a href="https://developer.mozilla.org/en-US/docs/Web/HTML/Element/audio" target="_blank">Audio</a>. Source is only available after calling play.
        * @property {pc.Sound} sound The sound resource that the instance will play.
        */
        SoundInstance = function (manager, sound, options) {
            pc.events.attach(this);

            options = options || {};

            this._volume = options.volume !== undefined ? pc.math.clamp(Number(options.volume) || 0, 0, 1) : 1;
            this._pitch = options.pitch !== undefined ? Math.max(0.01, Number(options.pitch) || 0) : 1;
            this._loop = !!(options.loop !== undefined ? options.loop : false);

            this._sound = sound;

            // start at 'stopped'
            this._state = STATE_STOPPED;

            // true if the manager was suspended
            this._suspended = false;
            // true if we want to suspend the event handled to the 'onended' event
            this._suspendEndEvent = false;
            // true if we want to suspend firing instance events
            this._suspendInstanceEvents = false;

            this._startTime = Math.max(0, Number(options.startTime) || 0);
            this._duration = Math.max(0, Number(options.duration) || 0);

            this._startedAt = 0;
            this._startOffset = null;

            // manually keep track of the playback position
            // because the Web Audio API does not provide a way to do this
            // accurately if the playbackRate is not 1
            this._currentTime = 0;
            this._currentOffset = 0;

            // if true then the instance will start playing its source
            // when its created
            this._playWhenLoaded = true;

            this._manager = manager;

            // The input node is the one that is connected to the source.
            this._inputNode = null;
            // the connected node is the one that is connected to the destination (speakers). Any
            // external nodes will be connected to this node.
            this._connectorNode = null;

            // The first external node set by a user
            this._firstNode = null;
            // The last external node set by a user
            this._lastNode = null;

            this._initializeNodes();

            // external event handlers
            this._onPlayCallback = options.onPlay;
            this._onPauseCallback = options.onPause;
            this._onResumeCallback = options.onResume;
            this._onStopCallback = options.onStop;
            this._onEndCallback = options.onEnd;

            // bind internal event handlers to 'this'
            this._endedHandler = this._onEnded.bind(this);

            // source is initialized when play() is called
            this.source = null;
        };

        Object.assign(SoundInstance.prototype, {
            /**
             * @function
             * @private
             * @name pc.SoundInstance#_initializeNodes
             * @description Creates internal audio nodes and connects them
             */
            _initializeNodes: function () {
                // create gain node for volume control
                this.gain = this._manager.context.createGain();
                this._inputNode = this.gain;
                // the gain node is also the connector node for 2D sound instances
                this._connectorNode = this.gain;
                this._connectorNode.connect(this._manager.context.destination);
            },

            /**
             * @function
             * @name pc.SoundInstance#play
             * @description Begins playback of sound. If the sound is not loaded this will return false.
             * If the sound is already playing this will restart the sound.
             * @returns {Boolean} True if the sound was started.
             */
            play: function () {
                if (this._state !== STATE_STOPPED) {
                    this.stop();
                }

                if (!this.source) {
                    this._createSource();
                }

                // calculate start offset
                var offset = capTime(this._startOffset, this.duration);
                offset = capTime(this._startTime + offset, this._sound.duration);
                // reset start offset now that we started the sound
                this._startOffset = null;

                // start source with specified offset and duration
                if (this._duration) {
                    this.source.start(0, offset, this._duration);
                } else {
                    this.source.start(0, offset);
                }

                // reset times
                this._startedAt = this._manager.context.currentTime;
                this._currentTime = 0;
                this._currentOffset = offset;

                // set state to playing
                this._state = STATE_PLAYING;
                // no need for this anymore
                this._playWhenLoaded = false;

                // Initialize volume and loop - note moved to be after start() because of Chrome bug
                this.volume = this._volume;
                this.loop = this._loop;
                this.pitch = this._pitch;

                // handle suspend events / volumechange events
                this._manager.on('volumechange', this._onManagerVolumeChange, this);
                this._manager.on('suspend', this._onManagerSuspend, this);
                this._manager.on('resume', this._onManagerResume, this);
                this._manager.on('destroy', this._onManagerDestroy, this);

                // suspend immediately if manager is suspended
                if (this._manager.suspended) {
                    this._onManagerSuspend();
                }

                if (!this._suspendInstanceEvents)
                    this._onPlay();

                return true;
            },

            /**
             * @function
             * @name pc.SoundInstance#pause
             * @description Pauses playback of sound. Call resume() to resume playback from the same position.
             * @returns {Boolean} Returns true if the sound was paused
             */
            pause: function () {
                if (this._state !== STATE_PLAYING || !this.source)
                    return false;

                // store current time
                this._updateCurrentTime();

                // set state to paused
                this._state = STATE_PAUSED;

                // Stop the source and re-create it because we cannot reuse the same source.
                // Suspend the end event as we are manually stopping the source
                this._suspendEndEvent = true;
                this.source.stop(0);
                this.source = null;

                // no need for this anymore
                this._playWhenLoaded = false;
                // reset user-set start offset
                this._startOffset = null;

                if (!this._suspendInstanceEvents)
                    this._onPause();

                return true;
            },

            /**
             * @function
             * @name pc.SoundInstance#resume
             * @description Resumes playback of the sound. Playback resumes at the point that the audio was paused
             * @returns {Boolean} Returns true if the sound was resumed.
             */
            resume: function () {
                if (this._state !== STATE_PAUSED) {
                    return false;
                }

                if (!this.source) {
                    this._createSource();
                }

                // start at point where sound was paused
                var offset = this.currentTime;

                // if the user set the 'currentTime' property while the sound
                // was paused then use that as the offset instead
                if (this._startOffset !== null) {
                    offset = capTime(this._startOffset, this.duration);
                    offset = capTime(this._startTime + offset, this._sound.duration);

                    // reset offset
                    this._startOffset = null;
                }

                // start source
                if (this._duration) {
                    this.source.start(0, offset, this._duration);
                } else {
                    this.source.start(0, offset);
                }

                // set state back to playing
                this._state = STATE_PLAYING;

                this._startedAt = this._manager.context.currentTime;
                this._currentOffset = offset;

                // Initialize parameters
                this.volume = this._volume;
                this.loop = this._loop;
                this.pitch = this._pitch;
                this._playWhenLoaded = false;

                if (!this._suspendInstanceEvents)
                    this._onResume();

                return true;
            },

            /**
             * @function
             * @name pc.SoundInstance#stop
             * @description Stops playback of sound. Calling play() again will restart playback from the beginning of the sound.
             * @returns {Boolean} Returns true if the sound was stopped.
             */
            stop: function () {
                if (this._state === STATE_STOPPED || !this.source)
                    return false;

                // unsubscribe from manager events
                this._manager.off('volumechange', this._onManagerVolumeChange, this);
                this._manager.off('suspend', this._onManagerSuspend, this);
                this._manager.off('resume', this._onManagerResume, this);
                this._manager.off('destroy', this._onManagerDestroy, this);

                // reset stored times
                this._startedAt = 0;
                this._currentTime = 0;
                this._currentOffset = 0;

                this._startOffset = null;
                this._playWhenLoaded = false;

                this._suspendEndEvent = true;
                if (this._state === STATE_PLAYING) {
                    this.source.stop(0);
                }
                this.source = null;

                // set the state to stopped
                this._state = STATE_STOPPED;

                if (!this._suspendInstanceEvents)
                    this._onStop();

                return true;
            },

            /**
             * @function
             * @name pc.SoundInstance#setExternalNodes
             * @description Connects external Web Audio API nodes. You need to pass
             * the first node of the node graph that you created externally and the last node of that graph. The first
             * node will be connected to the audio source and the last node will be connected to the destination of the
             * AudioContext (e.g. speakers). Requires Web Audio API support.
             * @param {AudioNode} firstNode The first node that will be connected to the audio source of sound instances.
             * @param {AudioNode} [lastNode] The last node that will be connected to the destination of the AudioContext.
             * If unspecified then the firstNode will be connected to the destination instead.
             * @example
             * var context = app.systems.sound.context;
             * var analyzer = context.createAnalyzer();
             * var distortion = context.createWaveShaper();
             * var filter = context.createBiquadFilter();
             * analyzer.connect(distortion);
             * distortion.connect(filter);
             * instance.setExternalNodes(analyzer, filter);
             */
            setExternalNodes: function (firstNode, lastNode) {
                if (!firstNode) {
                    console.error('The firstNode must be a valid Audio Node');
                    return;
                }

                if (!lastNode) {
                    lastNode = firstNode;
                }

                // connections are:
                // source -> inputNode -> connectorNode -> [firstNode -> ... -> lastNode] -> speakers

                var speakers = this._manager.context.destination;

                if (this._firstNode !== firstNode) {
                    if (this._firstNode) {
                        // if firstNode already exists means the connector node
                        // is connected to it so disconnect it
                        this._connectorNode.disconnect(this._firstNode);
                    } else {
                        // if firstNode does not exist means that its connected
                        // to the speakers so disconnect it
                        this._connectorNode.disconnect(speakers);
                    }

                    // set first node and connect with connector node
                    this._firstNode = firstNode;
                    this._connectorNode.connect(firstNode);
                }

                if (this._lastNode !== lastNode) {
                    if (this._lastNode) {
                        // if last node exists means it's connected to the speakers so disconnect it
                        this._lastNode.disconnect(speakers);
                    }

                    // set last node and connect with speakers
                    this._lastNode = lastNode;
                    this._lastNode.connect(speakers);
                }
            },

            /**
             * @function
             * @name pc.SoundInstance#clearExternalNodes
             * @description Clears any external nodes set by {@link pc.SoundInstance#setExternalNodes}.
             */
            clearExternalNodes: function () {
                var speakers = this._manager.context.destination;

                // break existing connections
                if (this._firstNode) {
                    this._connectorNode.disconnect(this._firstNode);
                    this._firstNode = null;
                }

                if (this._lastNode) {
                    this._lastNode.disconnect(speakers);
                    this._lastNode = null;
                }

                // reset connect to speakers
                this._connectorNode.connect(speakers);
            },


            /**
             * @function
             * @name pc.SoundInstance#getExternalNodes
             * @description Gets any external nodes set by {@link pc.SoundInstance#setExternalNodes}.
             * @returns {AudioNode[]} Returns an array that contains the two nodes set by {@link pc.SoundInstance#setExternalNodes}.
             */
            getExternalNodes: function () {
                return [this._firstNode, this._lastNode];
            },

            /**
             * @private
             * @function
             * @description Creates the source for the instance
             */

            _createSource: function () {
                if (!this._sound) {
                    return null;
                }

                var context = this._manager.context;

                if (this._sound.buffer) {
                    this.source = context.createBufferSource();
                    this.source.buffer = this._sound.buffer;

                    // Connect up the nodes
                    this.source.connect(this._inputNode);

                    // set events
                    this.source.onended = this._endedHandler;

                    // set loopStart and loopEnd so that the source starts and ends at the correct user-set times
                    this.source.loopStart = capTime(this._startTime, this.source.buffer.duration);
                    if (this._duration) {
                        this.source.loopEnd = Math.max(this.source.loopStart, capTime(this._startTime + this._duration, this.source.buffer.duration));
                    }
                }

                return this.source;
            },

            /**
             * @private
             * @function
             * @name pc.SoundInstance#_updateCurrentTime
             * @description Sets the current time taking into account the time the instance started playing, the current pitch and the current time offset.
             */
            _updateCurrentTime: function () {
                this._currentTime = capTime((this._manager.context.currentTime - this._startedAt) * this._pitch + this._currentOffset, this.duration);
            },

            /**
             * @private
             * @function
             * @name pc.SoundInstance#_onManagerDestroy
             * @description Handle the manager's 'destroy' event.
             */
            _onManagerDestroy: function () {
                if (this.source && this._state === STATE_PLAYING) {
                    this.source.stop(0);
                    this.source = null;
                }
            }
        });

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
                // set offset to current time so that
                // we calculate the rest of the time with the new pitch
                // from now on
                this._currentOffset = this.currentTime;
                this._startedAt = this._manager.context.currentTime;

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

                if (this._state !== STATE_STOPPED) {
                    this.stop();
                } else {
                    this._createSource();
                }
            }
        });

        Object.defineProperty(SoundInstance.prototype, 'currentTime', {
            get: function () {
                // if the user has set the currentTime and we have not used it yet
                // then just return that
                if (this._startOffset !== null) {
                    return this._startOffset;
                }

                // if the sound is paused return the currentTime calculated when
                // pause() was called
                if (this._state === STATE_PAUSED) {
                    return this._currentTime;
                }

                // if the sound is stopped or we don't have a source
                // return 0
                if (this._state === STATE_STOPPED || !this.source) {
                    return 0;
                }

                // recalculate current time
                this._updateCurrentTime();
                return this._currentTime;
            },
            set: function (value) {
                if (value < 0) return;

                if (this._state === STATE_PLAYING) {
                    // stop first which will set _startOffset to null
                    this.stop();

                    var suspend = this._suspendInstanceEvents;
                    this._suspendInstanceEvents = true;
                    // set _startOffset and play
                    this._startOffset = value;
                    this.play();
                    this._suspendInstanceEvents = suspend;
                } else {
                    // set _startOffset which will be used when the instance will start playing
                    this._startOffset = value;
                    // set _currentTime
                    this._currentTime = value;
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

            this._isReady = false;

            this._manager = manager;

            this._loadedMetadataHandler = this._onLoadedMetadata.bind(this);
            this._timeUpdateHandler = this._onTimeUpdate.bind(this);
            this._endedHandler = this._onEnded.bind(this);

            // external event handlers
            this._onPlayCallback = options.onPlay;
            this._onPauseCallback = options.onPause;
            this._onResumeCallback = options.onResume;
            this._onStopCallback = options.onStop;
            this._onEndCallback = options.onEnd;

            this.source = null;
            this._createSource();
        };

        Object.assign(SoundInstance.prototype, {
            play: function () {
                if (this._state !== STATE_STOPPED) {
                    this.stop();
                }

                if (!this.source) {
                    if (!this._createSource()) {
                        return false;
                    }
                }

                this.volume = this._volume;
                this.pitch = this._pitch;
                this.loop = this._loop;

                this.source.play();
                this._state = STATE_PLAYING;
                this._playWhenLoaded = false;

                this._manager.on('volumechange', this._onManagerVolumeChange, this);
                this._manager.on('suspend', this._onManagerSuspend, this);
                this._manager.on('resume', this._onManagerResume, this);
                this._manager.on('destroy', this._onManagerDestroy, this);

                // suspend immediately if manager is suspended
                if (this._manager.suspended)
                    this._onManagerSuspend();

                if (!this._suspendInstanceEvents)
                    this._onPlay();

                return true;

            },

            pause: function () {
                if (!this.source || this._state !== STATE_PLAYING)
                    return false;

                this._suspendEndEvent = true;
                this.source.pause();
                this._playWhenLoaded = false;
                this._state = STATE_PAUSED;
                this._startOffset = null;

                if (!this._suspendInstanceEvents)
                    this._onPause();

                return true;
            },

            resume: function () {
                if (!this.source || this._state !== STATE_PAUSED)
                    return false;

                this._state = STATE_PLAYING;
                this._playWhenLoaded = false;
                if (this.source.paused) {
                    this.source.play();

                    if (!this._suspendInstanceEvents)
                        this._onResume();
                }

                return true;
            },

            stop: function () {
                if (!this.source || this._state === STATE_STOPPED)
                    return false;

                this._manager.off('volumechange', this._onManagerVolumeChange, this);
                this._manager.off('suspend', this._onManagerSuspend, this);
                this._manager.off('resume', this._onManagerResume, this);
                this._manager.off('destroy', this._onManagerDestroy, this);

                this._suspendEndEvent = true;
                this.source.pause();
                this._playWhenLoaded = false;
                this._state = STATE_STOPPED;
                this._startOffset = null;

                if (!this._suspendInstanceEvents)
                    this._onStop();

                return true;
            },

            setExternalNodes: function () {
                // not supported
            },

            clearExternalNodes: function () {
                // not supported
            },

            getExternalNodes: function () {
                // not supported but return same type of result
                return [null, null];
            },

            // Sets start time after loadedmetadata is fired which is required by most browsers
            _onLoadedMetadata: function () {
                this.source.removeEventListener('loadedmetadata', this._loadedMetadataHandler);

                this._isReady = true;

                // calculate start time for source
                var offset = capTime(this._startOffset, this.duration);
                offset = capTime(this._startTime + offset, this._sound.duration);
                // reset currentTime
                this._startOffset = null;

                // set offset on source
                this.source.currentTime = offset;
            },

            _createSource: function () {
                if (this._sound && this._sound.audio) {

                    this._isReady = false;
                    this.source = this._sound.audio.cloneNode(true);

                    // set events
                    this.source.addEventListener('loadedmetadata', this._loadedMetadataHandler);
                    this.source.addEventListener('timeupdate', this._timeUpdateHandler);
                    this.source.onended = this._endedHandler;
                }

                return this.source;
            },

            // called every time the 'currentTime' is changed
            _onTimeUpdate: function () {
                if (!this._duration)
                    return;

                // if the currentTime passes the end then if looping go back to the beginning
                // otherwise manually stop
                if (this.source.currentTime > capTime(this._startTime + this._duration, this.source.duration)) {
                    if (this.loop) {
                        this.source.currentTime = capTime(this._startTime, this.source.duration);
                    } else {
                        // remove listener to prevent multiple calls
                        this.source.removeEventListener('timeupdate', this._timeUpdateHandler);
                        this.source.pause();

                        // call this manually because it doesn't work in all browsers in this case
                        this._onEnded();
                    }
                }
            },

            /**
             * @private
             * @function
             * @name pc.SoundInstance#_onManagerDestroy
             * @description Handle the manager's 'destroy' event.
             */
            _onManagerDestroy: function () {
                if (this.source) {
                    this.source.pause();
                }
            }
        });

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
            }
        });


        Object.defineProperty(SoundInstance.prototype, 'currentTime', {
            get: function () {
                if (this._startOffset !== null) {
                    return this._startOffset;
                }

                if (this._state === STATE_STOPPED || !this.source) {
                    return 0;
                }

                return this.source.currentTime - this._startTime;
            },
            set: function (value) {
                if (value < 0) return;

                this._startOffset = value;
                if (this.source && this._isReady) {
                    this.source.currentTime = capTime(this._startTime + capTime(value, this.duration), this._sound.duration);
                    this._startOffset = null;
                }
            }
        });

    } else {
        SoundInstance = function () { };
    }

    // Add functions which don't depend on source type
    Object.assign(SoundInstance.prototype, {

        _onPlay: function () {
            this.fire('play');

            if (this._onPlayCallback)
                this._onPlayCallback(this);
        },

        _onPause: function () {
            this.fire('pause');

            if (this._onPauseCallback)
                this._onPauseCallback(this);
        },

        _onResume: function () {
            this.fire('resume');

            if (this._onResumeCallback)
                this._onResumeCallback(this);
        },

        _onStop: function () {
            this.fire('stop');

            if (this._onStopCallback)
                this._onStopCallback(this);
        },

        _onEnded: function () {
            // the callback is not fired synchronously
            // so only reset _suspendEndEvent to false when the
            // callback is fired
            if (this._suspendEndEvent) {
                this._suspendEndEvent = false;
                return;
            }

            this.fire('end');

            if (this._onEndCallback)
                this._onEndCallback(this);

            this.stop();
        },

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
            if (this._state === STATE_PLAYING && !this._suspended) {
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
            var isPlaying = this._state === STATE_PLAYING;
            this.stop();
            if (isPlaying) {
                this.play();
            }
        }
    });

    Object.defineProperty(SoundInstance.prototype, 'duration', {
        get: function () {
            if (!this._sound) {
                return 0;
            }
            if (this._duration) {
                return capTime(this._duration, this._sound.duration);
            }
            return this._sound.duration;
        },
        set: function (value) {
            this._duration = Math.max(0, Number(value) || 0);

            // restart
            var isPlaying = this._state === STATE_PLAYING;
            this.stop();
            if (isPlaying) {
                this.play();
            }
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

    Object.defineProperty(SoundInstance.prototype, 'isSuspended', {
        get: function () {
            return this._suspended;
        }
    });


    return {
        SoundInstance: SoundInstance
    };
}());

// Events Documentation

/**
 * @event
 * @name pc.SoundInstance#play
 * @description Fired when the instance starts playing its source
 */

/**
 * @event
 * @name pc.SoundInstance#pause
 * @description Fired when the instance is paused.
 */

/**
 * @event
 * @name pc.SoundInstance#resume
 * @description Fired when the instance is resumed.
 */

/**
 * @event
 * @name pc.SoundInstance#stop
 * @description Fired when the instance is stopped.
 */

/**
 * @event
 * @name pc.SoundInstance#end
 * @description Fired when the sound currently played by the instance ends.
 */
