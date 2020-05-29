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
        this.model = null;
        this.prevAnim = null;
        this.currAnim = null;
        this.blending = false;
        this.blend = 0;
        this.blendSpeed = 0;
        this.playing = false;

        // json animation skeleton
        this.skeleton = null;
        this.fromSkel = null;
        this.toSkel = null;

        // glb animation controller
        this.animEvaluator = null;
    };

    return {
        AnimationComponentData: AnimationComponentData
    };
}());
