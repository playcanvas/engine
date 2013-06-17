pc.extend(pc.fw, function () {
    /**
    * @private
    * @name pc.fw.RigidBodyComponentData
    * @constructor Create a new data structure for a RigidBodyComponent
    * @class Contains data for the RigidBodyComponent
    * @extends pc.fw.ComponentData
    */
    var RigidBodyComponentData = function () {
        this.mass = 1;
        this.friction = 0.5;
        this.restitution = 0;
        this.bodyType = pc.fw.RIGIDBODY_TYPE_STATIC;

        // Non-serialized properties
        this.body = null;
    };
    RigidBodyComponentData = pc.inherits(RigidBodyComponentData, pc.fw.ComponentData);

    return {
        RigidBodyComponentData: RigidBodyComponentData
    };
}());