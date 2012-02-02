pc.extend(pc.audio, function () {
    var Channel;
    
    if (pc.audio.hasAudioContext()) {
        Channel = function (manager, sound, options) {
            this.manager = manager;
            this.volume = 1;
            this.sound = sound;
            
            this.source = this.manager.context.createBufferSource();
            this.source.buffer = sound.buffer;
            this.source.connect(this.manager.context.destination);            
        };
    
        Channel.prototype.setVolume = function (volume) {
            this.volume = volume;
            this.source.gain.value = volume;
        };
         
        Channel.prototype.getVolume = function () {
            return this.volume;
        };
    
        Channel.prototype.play = function () {
            this.source.noteOn(0);
        };
        
        Channel.prototype.stop = function () {
            this.source.noteOff(0);
            this.source = null;
        };
        
    } else if (pc.audio.hasAudio()) {
        Channel = function (manager, sound, options) {
            this.manager = manager;
            this.volume = 1;
            this.sound = sound;
            
            this.source = sound.audio.cloneNode(false);
        }
        
        Channel.prototype.play = function () {
            this.source.play();
        };
        
        Channel.prototype.stop = function () {
            this.source.pause();
            this.source = null;
        };
        
        Channel.prototype.setVolume = function (volume) {
            this.volume = volume;
            this.source.volume = volume;
        };
         
        Channel.prototype.getVolume = function () {
            return this.volume;
        };
    
    }
     
    return {
        Channel: Channel
    };
}());
