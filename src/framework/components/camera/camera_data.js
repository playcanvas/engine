pc.extend(pc.fw, function () {
    /**
     * @private
     * @name pc.fw.CameraComponentData
     * @class ComponentData structure for Camera components.
     * @extends pc.fw.ComponentData
     */
    CameraComponentData = function () {
        // serialized
        this.clearColor = new pc.Color(0.729411780834198, 0.729411780834198, 0.6941176652908325, 1);
        this.clearColorBuffer = true;
        this.clearDepthBuffer = true;
        this.nearClip = 0.1;
        this.farClip = 1000;
        this.fov = 45;
        this.orthoHeight = 100;
        this.projection = pc.scene.Projection.PERSPECTIVE;
        this.priority = 0;
        this.rect = new pc.Vec4(0,0,1,1);
        this.enabled = true;

        // not serialized
        this.camera = null;
        this.aspectRatio = 16 / 9;
        this.renderTarget = null;
        this.postEffects = null;
        this.isRendering = false;
    };
    CameraComponentData = pc.inherits(CameraComponentData, pc.fw.ComponentData);

    return {
        CameraComponentData: CameraComponentData
    };
}());