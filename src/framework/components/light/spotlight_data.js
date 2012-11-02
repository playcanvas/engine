pc.extend(pc.fw, function () {
    function SpotLightComponentData() {
        // Serialized
        this.enable = true;
        this.color = "0xffffff";
        this.intensity = 1;
        this.castShadows = false;
        this.attenuationEnd = 10;
        this.innerConeAngle = 40;
        this.outerConeAngle = 45;

        // Non-serialized
        this.light = null;
    };

    SpotLightComponentData = pc.inherits(SpotLightComponentData, pc.fw.ComponentData);

    return {
        SpotLightComponentData: SpotLightComponentData
    };
}());
// editor.link.addComponentType("spotlight");

// editor.link.expose({
//     system: "spotlight",
//     variable: "enable",
//     displayName: "Enable",
//     description: "Enable or disable the light",
//     type: "boolean",
//     defaultValue: true
// });

// editor.link.expose({
//     system: "spotlight",
//     variable: "color",
//     displayName: "Color",
//     description: "Light color",
//     type: "rgb",
//     defaultValue: "0xffffff"
// });

// editor.link.expose({
//     system: "spotlight",
//     variable: "intensity",
//     displayName: "Intensity",
//     description: "Factors the light color",
//     type: "number",
//     defaultValue: 1,
//     options: {
//         min: 0,
//         max: 10,
//         step: 0.05
//     }
// });

// editor.link.expose({
//     system: "spotlight",
//     variable: "castShadows",
//     displayName: "Cast shadows",
//     description: "Cast shadows from this light",
//     type: "boolean",
//     defaultValue: false
// });

// editor.link.expose({
//     system: "spotlight",
//     variable: "attenuationEnd",
//     displayName: "Attenuation End",
//     description: "The distance from the light where its contribution falls to zero",
//     type: "number",
//     defaultValue: 10,
//     options: {
//         min: 0
//     }
// });

// editor.link.expose({
//     system: "spotlight",
//     variable: "innerConeAngle",
//     displayName: "Inner Cone Angle",
//     description: "Spotlight inner cone angle",
//     type: "number",
//     defaultValue: 40,
//     options: {
//         min: 0,
//         max: 90
//     }
// });
// editor.link.expose({
//     system: "spotlight",
//     variable: "outerConeAngle",
//     displayName: "Outer Cone Angle",
//     description: "Spotlight outer cone angle",
//     type: "number",
//     defaultValue: 45,
//     options: {
//         min: 0,
//         max: 90
//     }
// });