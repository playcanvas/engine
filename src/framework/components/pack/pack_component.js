pc.extend(pc.fw, function () {
    /**
     * @name pc.fw.PackComponent
     * @constructor Create a new PackComponent
     * @class A Pack Component indicates the root of an Entity hierarchy that can be edited in the PlayCanvas Designer
     * @param {Object} context
     * @extends pc.fw.PackComponent
     */
    var PackComponent = function PackComponent() {
        
    };
    PackComponent = pc.inherits(PackComponent, pc.fw.Component);

    return {
        PackComponent: PackComponent
    };
    
}());

