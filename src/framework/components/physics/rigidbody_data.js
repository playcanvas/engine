pc.extend(pc.fw, function () {
    /**
    * @private
    * @name pc.fw.RigidBodyComponentData
    * @constructor Create a new data structure for a RigidBodyComponent
    * @class Contains data for the RigidBodyComponent
    * @extends pc.fw.ComponentData
    */
    var RigidBodyComponentData = function () {
        this.enabled = true;
        this.mass = 1;
        this.linearDamping = 0;
        this.angularDamping = 0;
        this.linearFactor = new pc.Vec3(1, 1, 1);
        this.angularFactor = new pc.Vec3(1, 1, 1);

        this.friction = 0.5;
        this.restitution = 0;

        this.type = pc.BODYTYPE_STATIC;

        this.group = pc.BODYGROUP_STATIC;
        this.mask = pc.BODYMASK_NOT_STATIC_KINEMATIC;

        // Non-serialized properties
        this.body = null;
        this.simulationEnabled = false;
    };
    RigidBodyComponentData = pc.inherits(RigidBodyComponentData, pc.fw.ComponentData);

    return {
        RigidBodyComponentData: RigidBodyComponentData
    };
}());
