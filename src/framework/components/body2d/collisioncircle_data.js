pc.extend(pc.fw, function () {
    var CollisionCircleComponentData = function () {
        this.density = 1;
        this.friction = 0.5;
        this.restitution = 0;
        this.radius = 1;
    };
    CollisionCircleComponentData = pc.inherits(CollisionCircleComponentData, pc.fw.ComponentData);

    return {
        CollisionCircleComponentData: CollisionCircleComponentData
    };
}());
editor.link.addComponentType("collisioncircle");

editor.link.expose({
    system: "collisioncircle",
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
    system: "collisioncircle",
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
    system: "collisioncircle",
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
    system: "collisioncircle",
    variable: "radius",
    displayName: "Radius",
    description: "The size of the Rect in the x-axis",
    type: "number",
    options: {
        min: 0,
        step: 0.1,
    },
    defaultValue: 1
});