pc.extend(pc.fw, function () {
    var LightComponentData = function () {
        // Serialized
        this.type = 'directional';
        this.enabled = true;
        this.color = new pc.Color(1, 1, 1);
        this.intensity = 1;
        this.castShadows = false;
        this.shadowDistance = 40;
        this.shadowResolution = 1024;
        this.shadowBias = 0.05;
        this.normalOffsetShadowBias = 0.0;
        this.range = 10;
        this.innerConeAngle = 40;
        this.outerConeAngle = 45;
        this.falloffMode = pc.scene.LIGHTFALLOFF_LINEAR;

        // Non-serialized
        this.model = null;
    };

    LightComponentData = pc.inherits(LightComponentData, pc.fw.ComponentData);

    return {
        LightComponentData: LightComponentData
    };
}());
