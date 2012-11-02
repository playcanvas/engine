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
// editor.link.addComponentType("body2d");

// editor.link.expose({
//     system: "body2d",
//     variable: "static",
//     displayName: "Static",
//     description: "Static bodies are immovable and do not collide with other static bodies.",
//     type: "boolean",
//     defaultValue: true
// });
