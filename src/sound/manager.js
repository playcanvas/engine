Object.assign(pc, function () {
    'use strict';

    /**
     * @private
     * @function
     * @name pc.SoundManager.hasAudio
     * @description Reports whether this device supports the HTML5 Audio tag API
     * @returns {boolean} true if HTML5 Audio tag API is supported and false otherwise
     */
    function hasAudio() {
        return (typeof Audio !== 'undefined');
    }

    /**
     * @private
     * @function
     * @name pc.SoundManager.hasAudioContext
     * @description Reports whether this device supports the Web Audio API
     * @returns {boolean} true if Web Audio is supported and false otherwise
     */
    function hasAudioContext() {
        return !!(typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined');
    }

    /**
     * @class
     * @name pc.SoundManager
     * @augments pc.EventHandler
     * @classdesc The SoundManager is used to load and play audio. As well as apply system-wide settings
     * like global volume, suspend and resume.
     * @description Creates a new sound manager.
     * @param {object} [options] - Options options object.
     * @param {boolean} [options.forceWebAudioApi] - Always use the Web Audio API even check indicates that it if not available
     * @property {number} volume Global volume for the manager. All {@link pc.SoundInstance}s will scale their volume with this volume. Valid between [0, 1].
     */
    var SoundManager = function (options) {
        pc.EventHandler.call(this);

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
                if (pc.platform.ios) {
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

        this.listener = new pc.Listener(this);

        this._volume = 1;
        this.suspended = false;
    };
    SoundManager.prototype = Object.create(pc.EventHandler.prototype);
    SoundManager.prototype.constructor = SoundManager;

    SoundManager.hasAudio = hasAudio;
    SoundManager.hasAudioContext = hasAudioContext;

    Object.assign(SoundManager.prototype, {
        suspend: function  () {
            this.suspended = true;
            this.fire('suspend');
        },

        resume: function () {
            this.suspended = false;
            this.fire('resume');
        },

        destroy: function () {
            window.removeEventListener('mousedown', this.resumeContext);
            window.removeEventListener('touchend', this.resumeContext);

            this.fire('destroy');
            if (this.context && this.context.close) {
                this.context.close();
                this.context = null;
            }
        },

        getListener: function () {
            console.warn('DEPRECATED: getListener is deprecated. Get the "listener" field instead.');
            return this.listener;
        },

        getVolume: function () {
            console.warn('DEPRECATED: getVolume is deprecated. Get the "volume" property instead.');
            return this.volume;
        },

        setVolume: function (volume) {
            console.warn('DEPRECATED: setVolume is deprecated. Set the "volume" property instead.');
            this.volume = volume;
        },

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
        playSound: function (sound, options) {
            options = options || {};
            var channel = null;
            if (pc.Channel) {
                channel = new pc.Channel(this, sound, options);
                channel.play();
            }
            return channel;
        },

        /**
         * @private
         * @function
         * @name pc.SoundManager#playSound3d
         * @description Create a new pc.Channel3d and begin playback of the sound at the position specified
         * @param {pc.Sound} sound - The Sound object to play.
         * @param {pc.Vec3} position - The position of the sound in 3D space.
         * @param {object} options - Optional options object.
         * @param {number} [options.volume] - The volume to playback at, between 0 and 1.
         * @param {boolean} [options.loop] - Whether to loop the sound when it reaches the end.
         * @returns {pc.Channel3d} The 3D channel playing the sound.
         */
        playSound3d: function (sound, position, options) {
            options = options || {};
            var channel = null;
            if (pc.Channel3d) {
                channel = new pc.Channel3d(this, sound, options);
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
    });

    Object.defineProperty(SoundManager.prototype, 'volume', {
        get: function () {
            return this._volume;
        },
        set: function (volume) {
            volume = pc.math.clamp(volume, 0, 1);
            this._volume = volume;
            this.fire('volumechange', volume);
        }
    });

    // backwards compatibility
    pc.AudioManager = SoundManager;

    return {
        SoundManager: SoundManager
    };
}());
