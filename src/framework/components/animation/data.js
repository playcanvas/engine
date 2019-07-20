Object.assign(pc, function () {
    var AnimationComponentData = function () {
        // Serialized
        this.assets = [];
        this.speed = 1.0;
        this.loop = true;
        this.activate = true;
        this.enabled = true;

        // Non-serialized
        this.animations = { };
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

    return {
        AnimationComponentData: AnimationComponentData
    };
}());
