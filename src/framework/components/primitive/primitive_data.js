pc.extend(pc.fw, function () {
    function PrimitiveComponentData() {
        // Serialized
        this.type = pc.shape.Type.BOX;
        this.color = "0xffffff";
        this.castShadows = false;
        this.receiveShadows = true;

        // Non-serialized
        this.material = null;
        this.model = null;
    };
    
    PrimitiveComponentData = pc.inherits(PrimitiveComponentData, pc.fw.ComponentData);
    
    return {
        PrimitiveComponentData: PrimitiveComponentData
    };
}());
editor.link.addComponentType("primitive");


editor.link.expose({
    system: "primitive",
    variable: "type",
    displayName: "Type",
    description: "Type of primitive",
    type: "enumeration",
    options: {
        enumerations: [{
            name: 'Box',
            value: pc.shape.Type.BOX
        }, {
            name: 'Sphere',
            value: pc.shape.Type.SPHERE
        }, {
            name: 'Cylinder',
            value: pc.shape.Type.CYLINDER
        }, {
            name: 'Cone',
            value: pc.shape.Type.CONE
        }]
    },
    defaultValue: "Box"
});

editor.link.expose({
    system: "primitive",
    variable: "color",
    displayName: "Color",
    description: "Material color",
    type: "rgb",
    defaultValue: "0xffffff"
});

editor.link.expose({
    system: "primitive",
    variable: "castShadows",
    displayName: "Cast shadows",
    description: "Occlude light from shadow casting lights",
    type: "boolean",
    defaultValue: false
});

editor.link.expose({
    system: "primitive",
    variable: "receiveShadows",
    displayName: "Receive shadows",
    description: "Receive shadows cast from occluders",
    type: "boolean",
    defaultValue: true
});