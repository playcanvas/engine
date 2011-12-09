/**
 * @name pc.audio
 * @namespace Functionality for playing audio files.
 */
pc.extend(pc.audio, function () {
    /**
     * @name pc.audio.AudioBase
     * @class Base class for Audio objects
     * @constructor Create a new AudioBase object
     */
    var AudioBase = function () {
       this._audio = new Audio();
       
       this._loadedDataHandler = function () {
            this.fire("loadeddata");  
       };
       
       this._errorHandler = function () {
           this.fire("error");
       };
              
       this._audio.addEventListener("loadeddata", pc.callback(this, this._loadedDataHandler), false);
       
       // Add event support
       pc.extend(this, pc.events);
    };
    
    /**
     * @function
     * @name pc.audio.AudioBase#setSource
     * @description Set the URI of the source file
     * @param {String} src URI of the audio resource
     */
    AudioBase.prototype.setSource = function (src) {
        this._audio.src = src;
    };
    
    /**
     * @function
     * @name pc.audio.AudioBase#getSource
     * @description Returns the URI string of the source file
     */
    AudioBase.prototype.getSource = function () {
        return this._audio.src;
    };

    AudioBase.prototype.setVolume = function (volume) {
        this._audio.volume = volume;
    };
    
    AudioBase.prototype.getVolume = function () {
        return this._audio.volume;
    };
    
    AudioBase.prototype.setLooping = function (looping) {
        this._audio.loop = looping;
    };
    
    AudioBase.prototype.getLooping = function () {
        return this._audio.loop;
    };
    
    /**
     * @function
     * @name pc.audio.AudioBase#play
     * @description Begin playback of the audio resource
     */
    AudioBase.prototype.play = function () {
        if(!this._audio.src) {
            throw new Error("Audio has no source");
        }
        this._audio.play();
    };
    
    /**
     * @function 
     * @name pc.audio.AudioBase#pause
     * @description Pause playback of the audio resource, downloading continues
     */
    AudioBase.prototype.pause = function () {
        this._audio.pause();
    };
    
    /**
     * @function
     * @name pc.audio.AudioBase#isPaused
     * @description Returns true if the audio has been paused.
     */
    AudioBase.prototype.isPaused = function () {
        return this._audio.paused;
    };
    
    /**
     * @function
     * @name pc.audio.AudioBase#cancel
     * @description Pause playback and stop downloading any further data. You must call setSource() again to resume playback if you use cancel().
     */
    AudioBase.prototype.cancel = function () {
        this._audio.pause();
        this._audio.src = "";
    };
    
    return {
        AudioBase: AudioBase
    }
}());

