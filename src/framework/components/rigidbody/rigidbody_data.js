pc.extend(pc.fw, function () {
    /**
    * @name pc.fw.RigidBodyComponentData
    * @constructor Create a new data structure for a RigidBodyComponent
    * @class Contains data for the RigidBodyComponent
    * @property {Number} mass The mass of the body. This is only relevant for {@link pc.fw.RIGIDBODY_TYPE_DYNAMIC} bodies, other types have infinite mass.
    * @property {Number} friction The friction value used when contacts occur between two bodies. A higher value indicates more friction.
    * @property {Number} restitution The amount of energy lost when two objects collide, this determines the bounciness of the object. 
    * A value of 0 means that no energy is lost in the collision, a value of 1 means that all energy is lost. 
    * So the higher the value the less bouncy the object is.
    * @property {pc.fw.RIGIDBODY_TYPE} bodyType The type of RigidBody determines how it is simulated. 
    * Static objects have infinite mass and cannot move, 
    * Dynamic objects are simulated according to the forces applied to them, 
    * Kinematic objects have infinite mass and do not respond to forces, but can still be moved by setting their velocity or position.
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