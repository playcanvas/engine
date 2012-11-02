pc.extend(pc.fw, function() {
    function BloomComponentData() {
        this.bloomThreshold = 0.25;
        this.blurAmount = 4;
        this.bloomIntensity = 1.25;
        this.baseIntensity = 1.0;
        this.bloomSaturation = 1.0;
        this.baseSaturation = 1.0;
    }
    BloomComponentData = pc.inherits(BloomComponentData, pc.fw.ComponentData);
    
    return {
        BloomComponentData: BloomComponentData 
    };
}());
// editor.link.addComponentType("bloom");

// editor.link.expose({
// 	system: "bloom",
// 	variable: "bloomThreshold",
// 	displayName: "Bloom Threshold",
//     description: "The luminance threshold above which blooming is applied",
//     type: "number",
//     options: {
//         max: 1,
//         min: 0,
//         step: 0.05
//     },
//     defaultValue: 0.25
// });

// editor.link.expose({
// 	system: "bloom",
// 	variable: "blurAmount",
// 	displayName: "Blur Amount",
//     description: "The luminance threshold above which blooming is applied",
//     type: "number",
//     options: {
//         max: 10,
//         min: 1,
//         step: 0.5
//     },
//     defaultValue: 4
// });

// editor.link.expose({
// 	system: "bloom",
// 	variable: "bloomIntensity",
// 	displayName: "Bloom Intensity",
// 	description: "TBD",
//     type: "number",
//     options: {
//         max: 3,
//         min: 0,
//         step: 0.05
//     },
//     defaultValue: 1.25
// });

// editor.link.expose({
// 	system: "bloom",
// 	variable: "baseIntensity",
// 	displayName: "Base Intensity",
// 	description: "TBD",
//     type: "number",
//     options: {
//         max: 3,
//         min: 0,
//         step: 0.05
//     },
//     defaultValue: 1
// });

// editor.link.expose({
// 	system: "bloom",
// 	variable: "bloomSaturation",
// 	displayName: "Bloom Saturation",
// 	description: "TBD",
//     type: "number",
//     options: {
//         max: 3,
//         min: 0,
//         step: 0.05
//     },
//     defaultValue: 1
// });

// editor.link.expose({
// 	system: "bloom",
// 	variable: "baseSaturation",
// 	displayName: "Base Saturation",
// 	description: "TBD",
//     type: "number",
//     options: {
//         max: 3,
//         min: 0,
//         step: 0.05
//     },
//     defaultValue: 1
// });
