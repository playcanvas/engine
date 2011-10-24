pc.extend(pc.fw, function () {
    function PrimitiveComponentData() {
        this.type = pc.shape.Type.BOX;
        this.color = "0xffffff";
        this.material = new pc.scene.Material();
        this.material.setState({
            cull: false,
            depthTest: true,
            depthWrite: true
        });
        var device = pc.gfx.Device.getCurrent();
        var programs = device.getProgramLibrary();
        this.material.setProgramName('phong');
        this.geometry = null;
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
    type: "string",
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

