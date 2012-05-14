pc.extend(pc.fw, function () {
    function DirectionalLightComponentData() {
        // Serialized
        this.enable = true;
        this.color = "0xffffff";
        this.intensity = 1;
        this.castShadows = false;

        // Non-serialized
        this.light = null;
    };

    DirectionalLightComponentData = pc.inherits(DirectionalLightComponentData, pc.fw.ComponentData);

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
    type: "rgb",
    defaultValue: "0xffffff"
});

editor.link.expose({
    system: "directionallight",
    variable: "intensity",
    displayName: "Intensity",
    description: "Factors the light color",
    type: "number",
    defaultValue: 1,
    options: {
        min: 0,
        max: 10,
        step: 0.05
    }
});

editor.link.expose({
    system: "directionallight",
    variable: "castShadows",
    displayName: "Cast shadows",
    description: "Cast shadows from this light",
    type: "boolean",
    defaultValue: false
});