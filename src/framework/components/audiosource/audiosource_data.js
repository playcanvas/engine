pc.fw.AudioSourceComponentData = function AudioSourceComponentData() {
    // serialized
    this.assets = [];
    this.activate = true;
    this.volume = 1;
    this.loop = false;
    this['3d'] = true;
    
    this.minDistance = 1;
    this.maxDistance = 10000;
    this.rollOffFactor = 1;
    
    // not serialized
    this.paused = true;

    this.sources = {};
    this.currentSource = null;
    this.channel = null;
};
// editor.link.addComponentType("audiosource");

// editor.link.expose({
//     system: "audiosource",
//     variable: "assets",
//     displayName: "Assets",
//     description: "Audio assets",
//     type: "asset",
//     options: {
//         max: 100
//     },
//     defaultValue: []
// });

// editor.link.expose({
//     system: "audiosource",
//     variable: "volume",
//     displayName: "Volume",
//     description: "The sound volume",
//     type: "number",
//     options: {
//         max: 1,
//         min: 0,
//         step: 0.1
//     },
//     defaultValue: 1
// });

// editor.link.expose({
//     system: "audiosource",
//     variable: "loop",
//     displayName: "Loop",
//     description: "Set whether sound loops or not",
//     type: "boolean",
//     defaultValue: false
// });

// editor.link.expose({
//     system: "audiosource",
//     variable: "activate",
//     displayName: "Activate",
//     description: "Play first audio sample when scene loads",
//     type: "boolean",
//     defaultValue: true
// });

// editor.link.expose({
//     system: "audiosource",
//     variable: "3d",
//     displayName: "3d",
//     description: "3d sounds are positioned in space, and their sound is dependent on listener position/orientation. Non-3d sounds are uniform aross space",
//     type: "boolean",
//     defaultValue: true
// });

// editor.link.expose({
//     system: "audiosource",
//     variable: "minDistance",
//     displayName: "Min Distance",
//     description: "Distance from listener under which the sound is at full volume",
//     type: "number",
//     defaultValue: 1,
//     options: {
//         min: 0
//     }
// });

// editor.link.expose({
//     system: "audiosource",
//     variable: "maxDistance",
//     displayName: "Max Distance",
//     description: "Distance from listener over which the sound cannot be heard",
//     type: "number",
//     defaultValue: 10000,
//     options: {
//         min: 0
//     }
// });


// editor.link.expose({
//     system: "audiosource",
//     variable: "rollOffFactor",
//     displayName: "Roll-off factor",
//     description: "Strength of the roll off",
//     type: "number",
//     defaultValue: 1,
//     options: {
//         min: 0
//     }
// });