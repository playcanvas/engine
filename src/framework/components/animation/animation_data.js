pc.extend(pc.fw, function() {
    function AnimationComponentData() {
        // Serialized
        this.assets = null;
        this.speed = 1.0;
        this.loop = true;

        // Non-serialized
        this.animations = null;
        this.skeleton = null;
        this.model = null;
        this.prevAnim = null;
        this.currAnim = null;
        this.fromSkel = null;
        this.toSkel = null;
        this.blending = false;
        this.blendTime = 0;
        this.blendTimeRemaining = 0;
    }
    AnimationComponentData = AnimationComponentData.extendsFrom(pc.fw.ComponentData);

    return {
        AnimationComponentData: AnimationComponentData 
    };
}());
editor.link.addComponentType("animation");

editor.link.expose({
    system: "animation",
    variable: "assets",
    displayName: "Asset",
    description: "Animation Asset",
    type: "asset",
    options: {
        max: 100
    },
    defaultValue: null
});

editor.link.expose({
    system: "animation",
    variable: "speed",
    displayName: "Speed Factor",
    description: "Scale the animation playback speed",
    type: "number",
    options: {
        max: 2.0,
        min: 0.0
    },
    defaultValue: 1.0
});

editor.link.expose({
    system: "animation",
    variable: "loop",
    displayName: "Loop",
    description: "Loop the animation back to the start on completion",
    type: "boolean",
    defaultValue: true
});