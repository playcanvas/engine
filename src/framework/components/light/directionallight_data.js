pc.extend(pc.fw, function () {
    DirectionalLightComponentData = function () {
        this.light = null;
        this.enable = true;
        this.color = "0xffffff";
    };
    DirectionalLightComponentData.extendsFrom(pc.fw.ComponentData);

    return {
        DirectionalLightComponentData: DirectionalLightComponentData
    };
}());
editor.link.addComponentType("directionallight");

editor.link.expose({
    system: "directionallight",
    variable: "enable",
    displayName: "Enable",
    description: "Enable or disable the light",
    type: "boolean",
    defaultValue: true
});

editor.link.expose({
    system: "directionallight",
    variable: "color",
    displayName: "Color",
    description: "Light color",
    type: "string",
    defaultValue: "0xffffff"
});