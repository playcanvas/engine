pc.extend(pc.fw, function () {
    /**
     * @name pc.fw.ComponentData
     * @class Base class for all component data storage.
     */
    var ComponentData = function (entity) {
        /**
         * @name pc.fw.ComponentData#entity
         * @description The Entity that this Component is attached to
         * @type pc.fw.Entity
         */
        this.entity = entity;        
    };
        
    return {
        ComponentData: ComponentData
    };
}());
