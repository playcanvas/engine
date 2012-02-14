pc.extend(pc.fw, function () {
    var DesignerComponentSystem = function (context) {
            context.systems.add("designer", this);
        };

    DesignerComponentSystem = DesignerComponentSystem.extendsFrom(pc.fw.ComponentSystem);
    
    DesignerComponentSystem.prototype.createComponent = function (entity, data) {
        var componentData = new pc.fw.DesignerComponentData();

        this.initialiseComponent(entity, componentData, data, ['fillWindow', 'width', 'height']);

        return componentData;
    }

    return {
        DesignerComponentSystem: DesignerComponentSystem
    };
}());