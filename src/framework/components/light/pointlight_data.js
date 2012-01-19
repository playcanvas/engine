pc.extend(pc.fw, function () {
    function PointLightComponentData() {
        // Serialized
        this.enable = true;
        this.color = "0xffffff";
        this.castShadows = false;
        this.attenuationEnd = 1;

        // Non-serialized
        this.light = null;
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
    variable: "castShadows",
    displayName: "Cast shadows",
    description: "Cast shadows from this light",
    type: "boolean",
    defaultValue: false
});

editor.link.expose({
    system: "pointlight",
    variable: "attenuationEnd",
    displayName: "Attenuation End",
    description: "The distance from the light where its contribution falls to zero",
    type: "number",
    defaultValue: 1,
    options: {
        min: 0
    }
});