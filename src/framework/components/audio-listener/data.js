Object.assign(pc, (function () {
    function AudioListenerComponentData() {
        // Serialized
        this.enabled = true;
    }
    AudioListenerComponentData = pc.inherits(AudioListenerComponentData, pc.ComponentData);

    return {
        AudioListenerComponentData: AudioListenerComponentData
    };
}()));
