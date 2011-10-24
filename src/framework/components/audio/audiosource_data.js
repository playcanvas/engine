pc.fw.AudioSourceComponentData = function AudioSourceComponentData() {
    this.uri = "";
    this.radius = 1;
    this.ambient = false;
    this.activate = true;
    this.audio = new pc.audio.PointAudio();
};
editor.link.addComponentType("audiosource");

editor.link.expose({
    system: "audiosource",
    variable: "uri",
    displayName: "Source URI",
    description: "The source file for the audio",
    type: "string",
    defaultValue: ""
});

editor.link.expose({
    system: "audiosource",
    variable: "volume",
    displayName: "Volume",
    description: "The sound volume",
    type: "number",
    options: {
        max: 1,
        min: 0
    },
    defaultValue: 1
});

editor.link.expose({
    system: "audiosource",
    variable: "radius",
    displayName: "Radius",
    description: "The radius of the sound",
    type: "number",
    options: {
        min: 0
    },
    defaultValue: 1
});

editor.link.expose({
    system: "audiosource",
    variable: "loop",
    displayName: "Loop",
    description: "Set whether sound loops or not",
    type: "boolean",
    defaultValue: false
});

editor.link.expose({
    system: "audiosource",
    variable: "ambient",
    displayName: "Ambient",
    description: "Ambient sounds ignore the position and are constant volume everywhere",
    type: "boolean",
    defaultValue: false
});

editor.link.expose({
    system: "audiosource",
    variable: "activate",
    displayName: "Activate",
    description: "Play first audio sample when scene loads",
    type: "boolean",
    defaultValue: true
});