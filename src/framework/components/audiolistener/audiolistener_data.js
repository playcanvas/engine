pc.extend(pc.fw, function () {
    var AudioListenerComponentData = function () {
        // Serialized
        this.enabled = true;
    };
    AudioListenerComponentData = pc.inherits(AudioListenerComponentData, pc.fw.ComponentData);
    
    return {
        AudioListenerComponentData: AudioListenerComponentData
    };
}());
