pc.extend(pc.fw, function () {
    PointLightComponentData = function () {
        this.light = null;
        this.enable = true;
        this.color = "0xffffff";
        this.radius = 1.0;
    };
    PointLightComponentData.extendsFrom(pc.fw.ComponentData);

    return {
        PointLightComponentData: PointLightComponentData
    };
}());
editor.link.addComponentType("pointlight");

editor.link.expose({
    system: "pointlight",
    variable: "enable",
    displayName: "Enable",
    description: "Enable or disable the light",
    type: "boolean",
    defaultValue: true
});

editor.link.expose({
    system: "pointlight",
    variable: "color",
    displayName: "Color",
    description: "Light color",
    type: "string",
    defaultValue: "0xffffff"
});

editor.link.expose({
    system: "pointlight",
    variable: "radius",
    displayName: "Radius",
    description: "Light radius",
    type: "number",
    defaultValue: 1.0
});