pc.extend(pc.fw, function () {
    /**
     * @private
     * @name pc.fw.CameraComponentData
     * @class ComponentData structure for Camera components.
     * @extends pc.fw.ComponentData
     * @property {pc.scene.Camera} camera The {@link pc.scene.CameraNode} used to render the scene
     * @property {String} clearColor The color used to clear the canvas to before the camera starts to render
     * @property {Number} nearClip The distance from the camera before which no rendering will take place
     * @property {Number} farClip The distance from the camera after which no rendering will take place
     * @property {Number} fov The Y-axis field of view of the camera, in degrees. Used for {@link pc.scene.Projection.PERSPECTIVE} cameras only. Defaults to 45.
     * @property {Number} orthoHeight The half-height of the orthographic view window (in the Y-axis). Used for {@link pc.scene.Projection.ORTHOGRAPHIC} cameras only. Defaults to 10.
     * @property {Number} aspectRatio The aspect ratio of the camera. This is the ratio of width divided by height. Default to 16/9.
     * @property {pc.scene.Projection} projection The type of projection used to render the camera.
     * @property {Boolean} activate Activate on load. If true the {@link pc.fw.CameraComponentSystem} will set {@link pc.fw.CameraComponentSystem#current} to this camera as soon as it is loaded.
     * @property {Boolean} offscreen Render offscreen. If true, the camera will render to an offscreen buffer.
     */
    CameraComponentData = function () {
        // serialized
        this.clearColor = "0xbabab1ff";
        this.nearClip = 0.1;
        this.farClip = 1000;
        this.fov = 45;
        this.orthoHeight = 100;
        this.aspectRatio = 16 / 9;
        this.projection = pc.scene.Projection.PERSPECTIVE;
        this.activate = true;
        this.offscreen = false;

        // not serialized
        this.camera = null;
    };
    CameraComponentData = pc.inherits(CameraComponentData, pc.fw.ComponentData);
    
    return {
        CameraComponentData: CameraComponentData
    };
}());