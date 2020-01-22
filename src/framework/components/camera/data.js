Object.assign(pc, function () {
    /**
     * @private
     * @class
     * @name pc.CameraComponentData
     * @augments pc.ComponentData
     * @classdesc ComponentData structure for Camera components.
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
        this.rect = new pc.Vec4(0, 0, 1, 1);
        this.scissorRect = new pc.Vec4(0, 0, 1, 1);
        this.enabled = true;
        this.frustumCulling = false;
        this.cullFaces = true;
        this.flipFaces = false;
        this.layers = [pc.LAYERID_WORLD, pc.LAYERID_DEPTH, pc.LAYERID_SKYBOX, pc.LAYERID_UI, pc.LAYERID_IMMEDIATE]; // default to original world, depth skybox and gizmos layers

        // not serialized
        this.camera = null;
        this.aspectRatio = 16 / 9;
        this.aspectRatioMode = pc.ASPECT_AUTO;
        this.renderTarget = null;
        this.postEffects = null;
        this.isRendering = false;
        this.calculateTransform = null;
        this.calculateProjection = null;
    };

    return {
        CameraComponentData: CameraComponentData
    };
}());
