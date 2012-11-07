pc.extend(pc.fw, function () {
    function SpotLightComponentData() {
        // Serialized
        this.enable = true;
        this.color = "0xffffff";
        this.intensity = 1;
        this.castShadows = false;
        this.attenuationEnd = 10;
        this.innerConeAngle = 40;
        this.outerConeAngle = 45;

        // Non-serialized
        this.light = null;
    };

    SpotLightComponentData = pc.inherits(SpotLightComponentData, pc.fw.ComponentData);

    return {
        SpotLightComponentData: SpotLightComponentData
    };
}());