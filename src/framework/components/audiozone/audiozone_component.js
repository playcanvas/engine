pc.extend(pc.fw, function () {

    var PositionFilter = function () {
        this.transform = new pc.Matrix4();
        this.audioNode = null;
    };

    var AudioZoneComponentSystem = function () {
        context.systems.add("audiozone", this);
    };
    
    AudioZoneComponentSystem.prototype.update = function (dt) {
        
    };
    
    AudioZoneComponentSystem.prototype.getFilter = function () {
        
    };
    
    return {
        AudioZoneComponentSystem: AudioZoneComponentSystem 
    };
}());