pc.extend(pc.fw, function() {
    function PickComponentData() {
        this.layer = "default";
        this.shapes = [];
        this.geometries = [];
        this.pickMaterial = null;
        /*
        new pc.scene.Material();
        this.pickMaterial.setState({
            cull: false,
            depthTest: true,
            depthWrite: true
        });
        var device = pc.gfx.Device.getCurrent();
        var programs = device.getProgramLibrary();
        this.pickMaterial.setProgram(programs.getProgram("pick", { skinning: false }));
        */
    };
    PickComponentData = PickComponentData.extendsFrom(pc.fw.ComponentData);
    
    return {
        PickComponentData: PickComponentData    
    }
}());
