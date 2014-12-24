pc.extend(pc, function () {
    /**
     * @private
     * @name pc.PackComponentSystem
     * @constructor Create a new PackComponentSystem
     * @class A Pack Component indicates the root of an Entity hierarchy that can be edited in the PlayCanvas Designer
     * @param {Object} context
     * @extends pc.ComponentSystem
     */
    var PackComponentSystem = function PackComponentSystem(context) {
        this.id = "pack";
        context.systems.add(this.id, this);

        this.ComponentType = pc.PackComponent;
        this.DataType = pc.PackComponentData;

        this.schema = [];
    };
    PackComponentSystem = pc.inherits(PackComponentSystem, pc.ComponentSystem);

    return {
        PackComponentSystem: PackComponentSystem
    };
    
}());

