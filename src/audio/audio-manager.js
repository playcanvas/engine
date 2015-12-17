pc.extend(pc, function () {
    'use strict';

    /**
     * @private
     * @function
     * @name pc.AudioManager.hasAudio
     * @description Reports whether this device supports the HTML5 Audio tag API
     * @returns true if HTML5 Audio tag API is supported and false otherwise
     */
    function hasAudio() {
        return (typeof Audio !== 'undefined');
    }

    /**
     * @private
     * @function
     * @name pc.AudioManager.hasAudioContext
     * @description Reports whether this device supports the Web Audio API
     * @returns true if Web Audio is supported and false otherwise
     */
    function hasAudioContext() {
        return !!(typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined');
    }

    /**
     * @private
     * @function
     * @name pc.AudioManager.isSupported
     * @description Estimate from the url/extension, whether the browser can play this audio type
     */
    function isSupported(url, audio) {
        var toMIME = {
            '.ogg': 'audio/ogg',
            '.mp3': 'audio/mpeg',
            '.wav': 'audio/x-wav'
        };

        var ext = pc.path.getExtension(url);

        if (toMIME[ext]) {
            if (!audio) {
                try {
                    audio = new Audio();
                } catch (e) {
                    return false;
                }
            }
            return audio.canPlayType(toMIME[ext]) !== '';
        } else {
            return false;
        }
    }

    /**
     * @private
     * @name pc.AudioManager
     * @class The AudioManager is used to load and play audio. As well as apply system-wide settings
     * like global volume, suspend and resume.
     * @description Creates a new audio manager.
     */
    var AudioManager = function () {
        if (hasAudioContext()) {
            if (typeof AudioContext !== 'undefined') {
                this.context = new AudioContext();
            } else if (typeof webkitAudioContext !== 'undefined') {
                this.context = new webkitAudioContext();
            }
        }
        this.listener = new pc.Listener(this);

        this.volume = 1;
        this.suspended = false;

        pc.events.attach(this);
    };

    AudioManager.hasAudio = hasAudio;
    AudioManager.hasAudioContext = hasAudioContext;
    AudioManager.isSupported = isSupported;

    AudioManager.prototype = {

        /**
        * @private
        * @function
        * @name pc.AudioManager#playSound
        * @description Create a new pc.Channel and begin playback of the sound.
        * @param {pc.Sound} sound The Sound object to play.
        * @param {Object} options
        * @param {Number} [options.volume] The volume to playback at, between 0 and 1.
        * @param {Boolean} [options.loop] Whether to loop the sound when it reaches the end.
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
        * @name pc.AudioManager#playSound3d
        * @description Create a new pc.Channel3d and begin playback of the sound at the position specified
        * @param {pc.Sound} sound The Sound object to play.
        * @param {pc.Vec3} position The position of the sound in 3D space.
        * @param {Object} options
        * @param {Number} [options.volume] The volume to playback at, between 0 and 1.
        * @param {Boolean} [options.loop] Whether to loop the sound when it reaches the end.
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
                channel.play();
            }

            return channel;
        },

        getListener: function () {
            return this.listener;
        },

        getVolume: function () {
            return this.volume;
        },

        setVolume: function (volume) {
            volume = pc.math.clamp(volume, 0, 1);
            this.volume = volume;
            this.fire('volumechange', volume);
        },

        suspend: function  () {
            this.suspended = true;
            this.fire('suspend');
        },

        resume: function () {
            this.suspended = false;
            this.fire('resume');
        },

        destroy: function () {
            if (this.context && this.context.close) {
                this.context.close();
                this.context = null;
            }
        }
    };

    return {
        AudioManager: AudioManager
    };
}());
