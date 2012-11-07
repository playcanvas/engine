pc.extend(pc.fw, function () {
    var Body2dComponentData = function () {
        this.density = 1;
        this.friction = 0.5;
        this.restitution = 0;
        this.static = true;
        this.shape = pc.shape.Type.RECT;

        // Non-serialized properties
        this.bodyDef = null;
        this.body = null;
    };
    Body2dComponentData = pc.inherits(Body2dComponentData, pc.fw.ComponentData);

    return {
        Body2dComponentData: Body2dComponentData
    };
}());