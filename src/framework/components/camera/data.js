pc.extend(pc, function () {
    /**
     * @private
     * @name pc.CameraComponentData
     * @class ComponentData structure for Camera components.
     * @extends pc.ComponentData
     */
    var CameraComponentData = function () {
        // serialized
        this.clearColor = new pc.Color(0.722, 0.722, 0.722, 1);
        this.clearColorBuffer = true;
        this.clearDepthBuffer = true;
        this.clearStencilBuffer = true;
        this.nearClip = 0.1;
        this.farClip = 1000;
        this.fov = 45;
        this.orthoHeight = 100;
        this.projection = pc.PROJECTION_PERSPECTIVE;
        this.priority = 0;
        this.rect = new pc.Vec4(0,0,1,1);
        this.enabled = true;
        this.frustumCulling = false;

        // not serialized
        this.camera = null;
        this.aspectRatio = 16 / 9;
        this.renderTarget = null;
        this.postEffects = null;
        this.isRendering = false;
    };
    CameraComponentData = pc.inherits(CameraComponentData, pc.ComponentData);

    return {
        CameraComponentData: CameraComponentData
    };
}());
