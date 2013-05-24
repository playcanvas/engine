pc.extend(pc.fw, function () {
    var DirectionalLightComponentData = function () {
        // Serialized
        this.enable = true;
        this.color = new pc.Color(1,1,1);
        this.intensity = 1;
        this.castShadows = false;
        this.shadowResolution = 1024;

        // Non-serialized
        this.model = null;
    };

    DirectionalLightComponentData = pc.inherits(DirectionalLightComponentData, pc.fw.ComponentData);

    return {
        DirectionalLightComponentData: DirectionalLightComponentData
    };
}());