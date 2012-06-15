pc.extend(pc.fw, function () {
    var Body2dComponentData = function () {
        this.density = 1;
        this.friction = 0.5;
        this.restitution = 0;
        this.static = true;
        this.shape = pc.shape.Type.RECT;
    };
    Body2dComponentData = pc.inherits(Body2dComponentData, pc.fw.ComponentData);

    return {
        Body2dComponentData: Body2dComponentData
    };
}());
editor.link.addComponentType("body2d");

editor.link.expose({
    system: "body2d",
    variable: "density",
    displayName: "Density",
    description: "The density of the body, this determine the mass",
    type: "number",
    options: {
        min: 0,
        step: 0.01
    },
    defaultValue: 1
});

editor.link.expose({
    system: "body2d",
    variable: "friction",
    displayName: "Friction",
    description: "The friction when the body slides along another body",
    type: "number",
    options: {
        min: 0,
        step: 0.01
    },
    defaultValue: 0.5
});

editor.link.expose({
    system: "body2d",
    variable: "restitution",
    displayName: "Restitution",
    description: "The restitution determines the elasticity of collisions. 0 means an object doesn't bounce at all, a value of 1 will be a perfect reflection",
    type: "number",
    options: {
        min: 0,
        step: 0.01
    },
    defaultValue: 0
});

editor.link.expose({
    system: "body2d",
    variable: "static",
    displayName: "Static",
    description: "Static bodies are immovable and do not collide with other static bodies.",
    type: "boolean",
    defaultValue: true
});

editor.link.expose({
    system: "body2d",
    variable: "shape",
    displayName: "Shape",
    description: "The shape of the body. Note, Circle shape radius is defined by the X scale, Y,Z are ignored.",
    type: "enumeration",
    options: {
        enumerations: [{
            name: 'Rect',
            value: pc.shape.Type.RECT
        }, {
            name: 'Circle',
            value: pc.shape.Type.CIRCLE
        }]
    },    
    defaultValue: pc.shape.Type.RECT
});
