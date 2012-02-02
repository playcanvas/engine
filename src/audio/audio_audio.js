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
            channel.play();
        }
        
        return channel;
    };
    
    AudioManager.prototype.getListener = function () {
        return this.listener;
    };
    
    AudioManager.prototype.setVolume = function (volume) {
        this.volume = volume;    
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
        }
    }
}();
