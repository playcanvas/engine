pc.extend(pc.fw, function () {
    CameraComponentData = function () {
        this.camera = null;        
        this.clearColor = "0xbabab1ff";
        this.nearClip = 1;
        this.farClip = 100000;
        this.fov = 45;
        this.viewWindowX = 1.0;
        this.viewWindowY = 1.0;
        this.projection = pc.scene.Projection.PERSPECTIVE;
        this.activate = true;
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
        max: 180
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
    type: "number",
    defaultValue: 0
});
