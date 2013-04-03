/**
* @namespace Low-level audio API
* @name pc.audio
* @description 
*/
pc.audio = function () {

    /**
    * @name pc.audio.AudioManager
    * @class The AudioManager is used to load and play audio. As well as apply system-wide settings like global volume, suspend and resume.
    */
    var AudioManager = function () {
        if (pc.audio.hasAudioContext()) {
            if (typeof AudioContext !== "undefined") {
                this.context = new AudioContext();
            } else if (typeof webkitAudioContext !== "undefined") {
                this.context = new webkitAudioContext();
            }
        }
        this.listener = new pc.audio.Listener(this);
        
        this.volume = 1;
        this.suspended = false;

        pc.extend(this, pc.events);
    };
    
    AudioManager.prototype = {
        /**
        * @function
        * @name pc.audio.AudioManager#createSound
        * @description Load audio data from the url provided and create a pc.audio.Sound object. Pass this to the success callback when complete
        * or use the error callback if something goes wrong.
        * @param {String} url The url of audio file to load, supported filetypes are mp3, ogg, wav.
        * @param {Function} success Callback used when pc.audio.Sound is successfully created from the loaded audio data. The callback is passed the new pc.audio.Sound object.
        * @param {Function} error Callback used if an error occurs.
        */
        createSound: function (url, success, error) {
            var sound = null;
            if (pc.audio.Sound) {
                sound = new pc.audio.Sound(this, url, success, error);
            } else {
                error();
            }
            return sound;
        },
        

        /**
        * @function
        * @name pc.audio.AudioManager#playSound
        * @description Create a new pc.audio.Channel and begin playback of the sound.
        * @param {pc.audio.Sound} sound The Sound object to play.
        * @param {Object} options
        * @param {Number} [options.volume] The volume to playback at, between 0 and 1.
        * @param {Boolean} [options.loop] Whether to loop the sound when it reaches the end.
        */
        playSound: function (sound, options) {
            options = options || {};
            var channel = null;
            if (pc.audio.Channel) {
                channel = new pc.audio.Channel(this, sound, options);
                channel.play();
            }
            return channel;
        },

        /**
        * @function
        * @name pc.audio.AudioManager#playSound3d
        * @description Create a new pc.audio.Channel3d and begin playback of the sound at the position specified
        * @param {pc.audio.Sound} sound The Sound object to play.
        * @param {pc.math.vec3} position The position of the sound in 3D space.
        * @param {Object} options
        * @param {Number} [options.volume] The volume to playback at, between 0 and 1.
        * @param {Boolean} [options.loop] Whether to loop the sound when it reaches the end.
        */
        playSound3d: function (sound, position, options) {
            options = options || {};
            var channel = null;
            if (pc.audio.Channel3d) {
                channel = new pc.audio.Channel3d(this, sound, options);
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
        }
    };

    return {
        AudioManager: AudioManager,
        hasAudio: function () {
            return typeof(Audio) !== 'undefined';
        },
        hasAudioContext: function () {
            return !!(typeof(AudioContext) !== 'undefined' || typeof(webkitAudioContext) !== 'undefined');
        },
        /**
        * @description Estimate from the url/extension, whether the browser can play this audio type
        */
        isSupported: function (url, audio) {
            var toMIME = {
                '.ogg': 'audio/ogg',
                '.mp3': 'audio/mpeg',
                '.wav': 'audio/x-wav'
            };

            var ext = pc.path.getExtension(url);

            if (toMIME[ext]) {
                if (!audio) {
                    audio = new Audio();
                }
                return audio.canPlayType(toMIME[ext]) !== '';
            } else {
                return false;
            }

        }
    };
}();
