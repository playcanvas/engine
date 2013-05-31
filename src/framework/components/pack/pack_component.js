pc.extend(pc.fw, function () {
    /**
     * @private
     * @name pc.fw.PackComponent
     * @constructor Create a new PackComponent
     * @class A Pack Component indicates the root of an Entity hierarchy that can be edited in the PlayCanvas Designer
     * @param {pc.fw.PackComponentSystem} system The ComponentSystem that created this Component
     * @param {pc.fw.Entity} entity The Entity that this Component is attached to.
     * @extends pc.fw.Component
     */
    var PackComponent = function PackComponent(system, entity) {
        
    };
    PackComponent = pc.inherits(PackComponent, pc.fw.Component);

    return {
        PackComponent: PackComponent
    };
}());