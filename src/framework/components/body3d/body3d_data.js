pc.extend(pc.fw, function () {
    var Body3dComponentData = function () {
        this.mass = 1;
        this.friction = 0.5;
        this.restitution = 0;
        this.static = true;

        // Non-serialized properties
        this.body = null;
    };
    Body3dComponentData = pc.inherits(Body3dComponentData, pc.fw.ComponentData);

    return {
        Body3dComponentData: Body3dComponentData
    };
}());