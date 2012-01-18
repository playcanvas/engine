pc.extend(pc.fw, function () {
    function PrimitiveComponentData() {
        // Serialized
        this.type = pc.shape.Type.BOX;
        this.color = "0xffffff";

        // Non-serialized
        this.material = null;
        this.model = null;
    };
    
    PrimitiveComponentData = PrimitiveComponentData.extendsFrom(pc.fw.ComponentData);
    
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
    type: "string",
    defaultValue: "0xffffff"
});

