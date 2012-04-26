pc.audio = function () {
    var AudioManager = function () {
        if (pc.audio.hasAudioContext()) {
            var AudioContext = window.AudioContext || window.webkitAudioContext;
            this.context = new AudioContext();
        }
        this.listener = new pc.audio.Listener(this);
    };
    
    AudioManager.prototype.createSound = function (url, success, error) {
        var sound = null;
        if (pc.audio.Sound) {
            sound = new pc.audio.Sound(this, url, success, error);
        } else {
            error();
        }
        return sound;
    };
    
    AudioManager.prototype.playSound = function (sound, options) {
        options = options || {};
        var channel = null;
        if (pc.audio.Channel) {
            channel = new pc.audio.Channel(this, sound, options);
            if (options.volume) {
                channel.setVolume(options.volume);
            }
            if (options.loop) {
                channel.setLoop(options.loop);
            }
            channel.play();
        }
        return channel;
    };

    AudioManager.prototype.playSound3d = function (sound, position, options) {
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
    };
    
    AudioManager.prototype.getListener = function () {
        return this.listener;
    };
    
    AudioManager.prototype.setVolume = function (volume) {
        this.volume = volume;
        // TODO set all channel volumes here
    };
    
/*
    Audio.prototype.createReverb = function () {
        
    };
    
    Audio.prototype.addReverb = function () {
        
    };
*/ 
    return {
        AudioManager: AudioManager,
        hasAudio: function () {
            return !!window.Audio;
        },
        hasAudioContext: function () {
            return !!(window.AudioContext || window.webkitAudioContext)
        },
        /**
        * @description Estimate from the url/extension, whether the browser can play this audio type
        */
        isSupported: function (url, audio) {
            var toMIME = {
                '.ogg': 'audio/ogg',
                '.mp3': 'audio/mpeg',
                '.wav': 'audio/x-wav'
            }

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

    }
}();
