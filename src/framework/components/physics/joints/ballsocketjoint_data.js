pc.extend(pc, function () {

    /**
     * @private
     * @name pc.BallSocketJointComponentData
     * @constructor Create a new BallSocketJointComponentData
     * @class Data definition for ball-socket joints.
     * @extends pc.ComponentData
     */
    var BallSocketJointComponentData = function () {
        this.pivot = new pc.Vec3(0, 0, 0);
        this.position = new pc.Vec3(0, 0, 0);
        this.tau = 0.3;
        this.damping = 1;
        this.impulseClamp = 0;

        // Non-serialized properties
        this.constraint = null;
    };
    BallSocketJointComponentData = pc.inherits(BallSocketJointComponentData, pc.ComponentData);

    return {
        BallSocketJointComponentData: BallSocketJointComponentData
    };
}());