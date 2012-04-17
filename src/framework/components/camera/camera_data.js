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
    CameraComponentData.extendsFrom(pc.fw.ComponentData);
    
    return {
        CameraComponentData: CameraComponentData
    };
}());
editor.link.addComponentType("camera");

editor.link.expose({
    system: "camera",
    variable: "clearColor",
    displayName: "Clear Color",
    description: "Clear Color",
    type: "rgba",
    defaultValue: "0xbabab1ff"
});

editor.link.expose({
    system: "camera",
    variable: "projection",
    displayName: "Projection",
    description: "Projection type of camera",
    type: "enumeration",
    options: {
        enumerations: [{
            name: 'Perspective',
            value: 0
        }, {
            name: 'Orthographic',
            value: 1
        }]
    },
    defaultValue: 0
});

editor.link.expose({
    system: "camera",
    variable: "fov",
    displayName: "Field of View",
    description: "Field of view in Y axis",
    type: "number",
    defaultValue: 45,
    options: {
        min: 0,
        max: 90
    }
});

editor.link.expose({
    system: "camera",
    variable: "orthoHeight",
    displayName: "Ortho Height",
    description: "View window half extent of camera in Y axis",
    type: "number",
    defaultValue: 100
});

editor.link.expose({
    system: "camera",
    variable: "nearClip",
    displayName: "Near Clip",
    description: "Near clipping distance",
    type: "number",
    defaultValue: 0.1,
    options: {
        min: 0
    }
});

editor.link.expose({
    system: "camera",
    variable: "farClip",
    displayName: "Far Clip",
    description: "Far clipping distance",
    type: "number",
    defaultValue: 1000,
    options: {
        min: 0
    }
});

editor.link.expose({
    system: "camera",
    variable: "activate",
    displayName: "Activate",
    description: "Activate camera when scene loads",
    type: "boolean",
    defaultValue: true
});

editor.link.expose({
    system: "camera",
    variable: "offscreen",
    displayName: "Offscreen",
    description: "Render to an offscreen buffer",
    type: "boolean",
    defaultValue: false
});