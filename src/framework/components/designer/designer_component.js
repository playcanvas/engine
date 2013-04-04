pc.extend(pc.fw, function () {
    var DesignerComponentSystem = function (context) {
        context.systems.add("designer", this);
    };
    DesignerComponentSystem = pc.inherits(DesignerComponentSystem, pc.fw.ComponentSystem);
    
    DesignerComponentSystem.prototype.createComponent = function (entity, data) {
        var componentData = new pc.fw.DesignerComponentData();

        this.initializeComponent(entity, componentData, data, ['fillWindow', 'width', 'height']);

        return componentData;
    };

    return {
        DesignerComponentSystem: DesignerComponentSystem
    };
}());