pc.extend(pc.fw, function () {

    /**
     * @name pc.fw.HeaderComponentSystem
     * @constructor Create a new HeaderComponentSystem
     * @class All Entities have a header component which contains human-readable name and description for the Entity
     * @param {Object} context
     * @extends pc.fw.ComponentSystem
     */
    var HeaderComponentSystem = function HeaderComponentSystem(context) {
        context.systems.add("header", this);
    };
    HeaderComponentSystem = HeaderComponentSystem.extendsFrom(pc.fw.ComponentSystem);
    
    HeaderComponentSystem.prototype.createComponent = function (entity, data) {
        var componentData = new pc.fw.HeaderComponentData();
        var properties = ["name", "description"];        
        data = data || {};
        
        this.addComponent(entity, componentData);
        
        properties.forEach(function(value, index, arr) {
            this.set(entity, value, data[value]);
        }, this);

        return componentData;
    };
    
    return {
        HeaderComponentSystem: HeaderComponentSystem
    };
    
}());

