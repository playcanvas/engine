pc.extend(pc.fw, function() {
    var AnimationComponentData = function () {
        // Serialized
        this.assets = null;
        this.speed = 1.0;
        this.loop = true;
        this.activate = true;

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
        this.playing = false;
    };
    AnimationComponentData = pc.inherits(AnimationComponentData, pc.fw.ComponentData);

    return {
        AnimationComponentData: AnimationComponentData 
    };
}());