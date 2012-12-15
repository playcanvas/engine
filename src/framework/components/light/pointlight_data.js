pc.extend(pc.fw, function () {
    function PointLightComponentData() {
        // Serialized
        this.enable = true;
        this.color = "0xffffff";
        this.intensity = 1;
        this.castShadows = false;
        this.attenuationEnd = 10;

        // Non-serialized
        this.model = null;
    };

    PointLightComponentData = pc.inherits(PointLightComponentData, pc.fw.ComponentData);

    return {
        PointLightComponentData: PointLightComponentData
    };
}());