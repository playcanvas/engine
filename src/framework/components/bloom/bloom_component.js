pc.extend(pc.fw, function () {

    /**
     * @name pc.fw.BloomComponent
     * @constructor Create a new BloomComponent
     * @class Applies a bloom filter to a render target, writing the result to the backbuffer.
     * @param {pc.fw.BloomComponentSystem} system The ComponentSystem that created this Component
     * @param {pc.fw.Entity} entity The Entity that this Component is attached to
     * @extends pc.fw.Component
     */
    var BloomComponent = function BloomComponent (system, entity) {
    };
    BloomComponent = pc.inherits(BloomComponent, pc.fw.Component);

    return {
        BloomComponent: BloomComponent
    };
}());