pc.extend(pc.audio, function () {
    /**
     * @name pc.audio.AmbientAudio
     * @class Audio with no specific location
     * @constructor Create a new AmbientAudio object
     * @extends pc.audio.AudioBase
     */
    var AmbientAudio = function () {
    };
    AmbientAudio = AmbientAudio.extendsFrom(pc.audio.AudioBase);
    
    return {
        AmbientAudio: AmbientAudio
    };
}());
