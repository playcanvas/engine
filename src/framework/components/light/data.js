pc.extend(pc, function () {
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
        this.normalOffsetBias = 0.0;
        this.range = 10;
        this.innerConeAngle = 40;
        this.outerConeAngle = 45;
        this.falloffMode = pc.LIGHTFALLOFF_LINEAR;
        this.shadowType = pc.SHADOW_DEPTH;
        this.vsmBlurSize = 11;
        this.vsmBlurMode = pc.BLUR_GAUSSIAN;
        this.vsmBias = 0.01 * 0.25;
        this.cookie = null;
        this.cookieIntensity = 1;
        this.cookieFalloff = true;
        this.cookieChannel = "rgb";
        this.shadowUpdateMode = pc.SHADOWUPDATE_REALTIME;
        this.mask = 1;
        this.affectDynamic = true;
        this.affectLightmapped = false;
        this.bake = false;

        // Non-serialized
        this.light = null;
        this.model = null;
    };

    LightComponentData = pc.inherits(LightComponentData, pc.ComponentData);

    return {
        LightComponentData: LightComponentData
    };
}());
