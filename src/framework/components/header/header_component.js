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
    HeaderComponentSystem = pc.inherits(HeaderComponentSystem, pc.fw.ComponentSystem);
    
    HeaderComponentSystem.prototype.createComponent = function (entity, data) {
        var componentData = new pc.fw.HeaderComponentData();

        this.initialiseComponent(entity, componentData, data, ['name', 'description']);

        return componentData;
    };
    
    return {
        HeaderComponentSystem: HeaderComponentSystem
    };
    
}());

