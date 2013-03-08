pc.extend(pc.fw, function () {
    /**
     * @private
     * @name pc.fw.CameraComponentData
     * @class ComponentData structure for Camera components.
     * @extends pc.fw.ComponentData
     */
    CameraComponentData = function () {
        // serialized
        this.clearColor = "0xbabab1ff";
        this.nearClip = 0.1;
        this.farClip = 1000;
        this.fov = 45;
        this.orthoHeight = 100;
        this.projection = pc.scene.Projection.PERSPECTIVE;
        this.activate = true;
        this.offscreen = false;

        // not serialized
        this.camera = null;
        this.aspectRatio = 16 / 9;
    };
    CameraComponentData = pc.inherits(CameraComponentData, pc.fw.ComponentData);
    
    return {
        CameraComponentData: CameraComponentData
    };
}());