pc.extend(pc.fw, function () {
    function DirectionalLightComponentData() {
        // Serialized
        this.enable = true;
        this.color = "0xffffff";
        this.intensity = 1;
        this.castShadows = false;

        // Non-serialized
        this.model = null;
    };

    DirectionalLightComponentData = pc.inherits(DirectionalLightComponentData, pc.fw.ComponentData);

    return {
        DirectionalLightComponentData: DirectionalLightComponentData
    };
}());