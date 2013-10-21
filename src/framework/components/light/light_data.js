pc.extend(pc.fw, function () {
    var LightComponentData = function () {
        // Serialized
        this.type = 'directional';
        this.enable = true;
        this.color = new pc.Color(1,1,1);
        this.intensity = 1;
        this.castShadows = false;
        this.shadowResolution = 1024;
        this.range = 10;
        this.innerConeAngle = 40;
        this.outerConeAngle = 45;

        // Non-serialized
        this.model = null;
    };

    LightComponentData = pc.inherits(LightComponentData, pc.fw.ComponentData);

    return {
        LightComponentData: LightComponentData
    };
}());