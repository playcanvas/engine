pc.extend(pc.fw, function () {
    var SpotLightComponentData = function () {
        // Serialized
        this.enable = true;
        this.color = "0xffffff";
        this.intensity = 1;
        this.attenuationEnd = 10;
        this.innerConeAngle = 40;
        this.outerConeAngle = 45;
        this.castShadows = false;
        this.shadowResolution = 1024;

        // Non-serialized
        this.model = null;
    };
    SpotLightComponentData = pc.inherits(SpotLightComponentData, pc.fw.ComponentData);

    return {
        SpotLightComponentData: SpotLightComponentData
    };
}());