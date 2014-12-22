pc.extend(pc, function () {
    var DesignerComponentSystem = function (app) {
        app.systems.add("designer", this);
    };
    DesignerComponentSystem = pc.inherits(DesignerComponentSystem, pc.ComponentSystem);

    DesignerComponentSystem.prototype.createComponent = function (entity, data) {
        var componentData = new pc.DesignerComponentData();

        this.initializeComponent(entity, componentData, data, ['fillWindow', 'width', 'height']);

        return componentData;
    };

    return {
        DesignerComponentSystem: DesignerComponentSystem
    };
}());
