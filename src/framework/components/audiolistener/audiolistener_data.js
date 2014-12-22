pc.extend(pc, function () {
    var AudioListenerComponentData = function () {
        // Serialized
        this.enabled = true;
    };
    AudioListenerComponentData = pc.inherits(AudioListenerComponentData, pc.ComponentData);
    
    return {
        AudioListenerComponentData: AudioListenerComponentData
    };
}());
