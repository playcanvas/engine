pc.extend(pc.fw, function () {

    /**
     * @private
     * @name pc.fw.BallSocketJointComponentData
     * @constructor Create a new BallSocketJointComponentData
     * @class Data definition for ball-socket joints.
     * @extends pc.fw.ComponentData
     */
    var BallSocketJointComponentData = function () {
        this.pivot = [0, 0, 0];
        this.position = [0, 0, 0];
        this.tau = 0.3;
        this.damping = 1;
        this.impulseClamp = 0;

        // Non-serialized properties
        this.constraint = null;
    };
    BallSocketJointComponentData = pc.inherits(BallSocketJointComponentData, pc.fw.ComponentData);

    return {
        BallSocketJointComponentData: BallSocketJointComponentData
    };
}());