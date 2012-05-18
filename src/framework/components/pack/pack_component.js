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
    PackComponentSystem = pc.inherits(PackComponentSystem, pc.fw.ComponentSystem);
    
    PackComponentSystem.prototype.createComponent = function (entity, data) {
        var componentData = new pc.fw.PackComponentData();

        this.initialiseComponent(entity, componentData, data, []);
    
        return componentData;
    }
    
    return {
        PackComponentSystem: PackComponentSystem
    };
    
}());

