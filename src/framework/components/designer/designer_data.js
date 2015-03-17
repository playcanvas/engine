pc.extend(pc, function () {
    DesignerComponentData = function () {
        this.fillWindow = true;
        this.width = 800;
        this.height = 450;
    };
    DesignerComponentData = pc.inherits(DesignerComponentData, pc.ComponentData);

    return {
        DesignerComponentData: DesignerComponentData
    };
}());
