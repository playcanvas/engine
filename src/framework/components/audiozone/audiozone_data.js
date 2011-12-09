pc.extend(pc.fw, function () {
    var AudioZoneComponentData = function () {
    };
    AudioZoneComponentData = AudioZoneComponentData.extendsFrom(pc.fw.ComponentData);
    
    return {
        AudioZoneComponentData: AudioZoneComponentData
    };
}());
editor.link.addComponentType("audiozone");
