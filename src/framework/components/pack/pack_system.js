pc.extend(pc.fw, function () {
    /**
     * @private
     * @name pc.fw.PackComponentSystem
     * @constructor Create a new PackComponentSystem
     * @class A Pack Component indicates the root of an Entity hierarchy that can be edited in the PlayCanvas Designer
     * @param {Object} context
     * @extends pc.fw.ComponentSystem
     */
    var PackComponentSystem = function PackComponentSystem(context) {
        this.id = "pack";
        context.systems.add(this.id, this);

        this.ComponentType = pc.fw.PackComponent;
        this.DataType = pc.fw.PackComponentData;

        this.schema = [{
            name: "pc.fw.PackComponent",
            type: "componentType"
        }];
    };
    PackComponentSystem = pc.inherits(PackComponentSystem, pc.fw.ComponentSystem);

    return {
        PackComponentSystem: PackComponentSystem
    };
    
}());

