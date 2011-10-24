pc.extend(pc.fw, function () {
    /**
     * @name pc.fw.PackComponentSystem
     * @constructor Create a new PackComponentSystem
     * @class A Pack Component indicates the root of an Entity hierarchy that can be edited in the PlayCanvas Designer
     * @param {Object} context
     * @extends pc.fw.ComponentSystem
     */
    var PackComponentSystem = function PackComponentSystem(context) {
        context.systems.add("pack", this);
    };
    PackComponentSystem = PackComponentSystem.extendsFrom(pc.fw.ComponentSystem);
    
    PackComponentSystem.prototype.createComponent = function (entity, data) {
        var componentData = new pc.fw.PackComponentData();
        var properties = [];
        data = data || {};
               
        this.addComponent(entity, componentData);

        properties.forEach(function(value, index, arr) {
            this.set(entity, value, data[value]);
        }, this);
    
        return componentData;
    }
    
    return {
        PackComponentSystem: PackComponentSystem
    };
    
}());

