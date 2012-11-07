pc.extend(pc.fw, function () {
    /**
     * @name pc.fw.CameraComponentData
     * @class ComponentData structure for Camera components.
     * @extends pc.fw.ComponentData
     */
    CameraComponentData = function () {
        /**
         * @name pc.fw.CameraComponentData#camera
         * @description The {@link pc.scene.CameraNode} used to render the scene
         * @type pc.scene.CameraNode
         */
        this.camera = null;        
        /**
         * @name pc.fw.CameraComponentData#clearColor
         * @description The color used to clear the canvas to before the camera starts to render
         * @type String
         */
        this.clearColor = "0xbabab1ff";
        /**
         * @name pc.fw.CameraComponentData#nearClip
         * @description The distance from the camera before which no rendering will take place
         * @type Number
         */
        this.nearClip = 0.1;
        /**
         * @name pc.fw.CameraComponentData#farClip
         * @description The distance from the camera after which no rendering will take place
         * @type Number
         */
        this.farClip = 1000;
        /**
         * @name pc.fw.CameraComponentData#fov
         * @description The Y-axis field of view of the camera, in degrees. Used for {@link pc.scene.Projection.PERSPECTIVE} cameras only. Defaults to 45.
         * @type Number
         */
        this.fov = 45;
        /**
         * @name pc.fw.CameraComponentData#orthoHeight
         * @description The half-height of the orthographic view window (in the Y-axis). Used for {@link pc.scene.Projection.ORTHOGRAPHIC} cameras only. Defaults to 10.
         * @type Number
         */
        this.orthoHeight = 100;
        /**
         * @name pc.fw.CameraComponentData#aspectRatio
         * @description The aspect ratio of the camera. This is the ratio of width divided by height. Default to 16/9.
         * @type Number
         */
        this.aspectRatio = 16 / 9;
        /**
         * @name pc.fw.CameraComponentData#projection
         * @description The type of projection used to render the camera.
         * @type {pc.scene.Projection}
         */
        this.projection = pc.scene.Projection.PERSPECTIVE;
        /**
         * @name pc.fw.CameraComponentData#activate
         * @description If true the {@link pc.fw.CameraComponentSystem} will setCurrent() for this camera as soon as it is loaded.
         * @type Boolean
         */
        this.activate = true;
        /**
         * @name pc.fw.CameraComponentData#offscreen
         * @description If true, the camera will render to an offscreen buffer.
         * @type Boolean
         */
        this.offscreen = false;
    };
    CameraComponentData = pc.inherits(CameraComponentData, pc.fw.ComponentData);
    
    return {
        CameraComponentData: CameraComponentData
    };
}());