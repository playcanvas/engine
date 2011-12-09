pc.extend(pc.fw, function () {
    var AudioListenerComponentData = function () {
    };
    AudioListenerComponentData = AudioListenerComponentData.extendsFrom(pc.fw.ComponentData);
    
    return {
        AudioListenerComponentData: AudioListenerComponentData
    };
}());
editor.link.addComponentType("audiolistener");
