pc.extend(pc.audio, function () {
    function _linearFallOff(position, cutoff) {
        var offset = pc.math.vec3.create(0,0,0);
        var distance;
        var factor;
        
        pc.math.vec3.subtract(this._position, position, offset);
        distance = pc.math.vec3.length(offset);
        
        factor = 1 - (distance / cutoff);
        if(factor < 0) {
            factor = 0;
        }
        return factor;
    }
    
    
    /**
     * @name pc.audio.PointAudio
     * @class An audio playback object with a position and size/shape. The volume heard is determined by the position of the listener relative to the position and shape of the object. 
     * @param {Object} options
     * @extends pc.audio.AudioBase
     */
    var PointAudio = function (options) {
        options = options || {};
        
        this._radius = options.radius || 1;
        this._volume = 1.0; // store the 'real' volume
        this._position = pc.math.vec3.create(0,0,0);
        this._listenerPosition = pc.math.vec3.create(0,0,0);
        
        this._falloffFunction = _linearFallOff;
    };
    PointAudio = PointAudio.extendsFrom(pc.audio.AudioBase);
    
    PointAudio.prototype.setPosition = function (position) {
        this._position = position
        this._update();
    };
    
    PointAudio.prototype.getPosition = function () {
        return this._position;
    };
    
    PointAudio.prototype.setVolume = function (volume) {
        this._volume = volume;
    };
    
    PointAudio.prototype.getVolume = function () {
        return this._volume;
    };
    
    /**
     * @function
     * @name pc.audio.PointAudio#setRadius
     * @description Set the radius of the falloff for the audio. TODO: remove this and attach shapes (sphere, cube) to the audio instead.
     * @param {Object} radius
     */
    PointAudio.prototype.setRadius = function (radius) {
        this._radius = radius;
    };
    
    PointAudio.prototype.setListenerPosition = function (position) {
        this._listenerPosition = position;
        this._update();
    };
    
    PointAudio.prototype.getVolumeAtPosition = function (position) {
        var factor = this._falloffFunction(position, this._radius);
        return this.getVolume() * factor;
    };
    
    PointAudio.prototype._update = function () {
        var v = this.getVolumeAtPosition(this._listenerPosition);
        this._audio.volume = v;
    }
    
    return {
        PointAudio: PointAudio
    };
}());
