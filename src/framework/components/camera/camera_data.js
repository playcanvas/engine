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
        this.nearClip = 1;
        /**
         * @name pc.fw.CameraComponentData#farClip
         * @description The distance from the camera after which no rendering will take place
         * @type Number
         */
        this.farClip = 100000;
        /**
         * @name pc.fw.CameraComponentData#fov
         * @description The Y-axis field of view of the camera, in degrees. Used for {@link pc.scene.Projection.PERSPECTIVE} cameras only.
         * @type Number
         */
        this.fov = 45;
        /**
         * @name pc.fw.CameraComponentData#viewWindowX
         * @description The size of the view window in the X-axis. Used for {@link pc.scene.Projection.ORTHOGRAPHIC} cameras only.
         * @type Number
         */
        this.viewWindowX = 1.0;
        /**
         * @name pc.fw.CameraComponentData#viewWindowY
         * @description The size of the view window in the Y-axis. Used for {@link pc.scene.Projection.ORTHOGRAPHIC} cameras only.
         * @type Number
         */
        this.viewWindowY = 1.0;
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
    type: "string",
    defaultValue: "0xbabab1ff"
});

editor.link.expose({
    system: "camera",
    variable: "fov",
    displayName: "Field of view",
    description: "Field Of View",
    type: "number",
    defaultValue: 45,
    options: {
        min: 0,
        max: 90
    }
});

editor.link.expose({
    system: "camera",
    variable: "viewWindowX",
    displayName: "View Window X",
    description: "View window half extent of camera in X axis",
    type: "number",
    defaultValue: 1
});

editor.link.expose({
    system: "camera",
    variable: "viewWindowY",
    displayName: "View Window Y",
    description: "View window half extent of camera in Y axis",
    type: "number",
    defaultValue: 1
});

editor.link.expose({
    system: "camera",
    variable: "nearClip",
    displayName: "Near Clip",
    description: "Near clipping distance",
    type: "number",
    defaultValue: 1,
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
    defaultValue: 100000,
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
