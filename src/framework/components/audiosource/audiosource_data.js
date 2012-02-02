pc.fw.AudioSourceComponentData = function AudioSourceComponentData() {
    // serialized
    this.assets = [];
    this.activate = true;
    this.volume = 1;
    this.loop = false;
    
    // not serialized
    this.paused = true;

    this.sources = {};
    this.currentSource = null;
    this.channel = null;
};
editor.link.addComponentType("audiosource");

editor.link.expose({
    system: "audiosource",
    variable: "assets",
    displayName: "Assets",
    description: "Audio assets",
    type: "asset",
    options: {
        max: 100
    },
    defaultValue: []
});

editor.link.expose({
    system: "audiosource",
    variable: "volume",
    displayName: "Volume",
    description: "The sound volume",
    type: "number",
    options: {
        max: 1,
        min: 0,
        step: 0.1
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
    variable: "activate",
    displayName: "Activate",
    description: "Play first audio sample when scene loads",
    type: "boolean",
    defaultValue: true
});