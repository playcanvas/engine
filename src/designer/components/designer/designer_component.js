pc.extend(pc.designer, function () {
    DesignerComponentSystem = function DesignerComponentSystem(context) {
        this.context.systems.add('designer', this);
        //this.bind("set", pc.callback(this, _onSet));
    };        
    DesignerComponentSystem = DesignerComponentSystem.extendsFrom(pc.fw.ComponentSystem);
    
    DesignerComponentSystem.prototype.update = function (dt) {
    };
        
    DesignerComponentSystem.prototype.createComponent = function(entity, data) {
        var componentData = new pc.designer.DesignerComponentData();
        this.addComponent(entity, componentData);
        
        return componentData;
    };
    
    return {
        DesignerComponentSystem: DesignerComponentSystem
    };
    
}());

