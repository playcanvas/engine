pc.extend(pc, function () {
    /**
     * @private
     * @name pc.PackComponent
     * @constructor Create a new PackComponent
     * @class A Pack Component indicates the root of an Entity hierarchy that can be edited in the PlayCanvas Designer
     * @param {pc.PackComponentSystem} system The ComponentSystem that created this Component
     * @param {pc.Entity} entity The Entity that this Component is attached to.
     * @extends pc.Component
     */
    var PackComponent = function PackComponent(system, entity) {
        
    };
    PackComponent = pc.inherits(PackComponent, pc.Component);

    return {
        PackComponent: PackComponent
    };
}());