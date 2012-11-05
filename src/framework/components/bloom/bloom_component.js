pc.extend(pc.fw, function () {

    /**
     * @name pc.fw.BloomComponentSystem
     * @constructor Create a new BloomComponent
     * @class Applies a bloom filter to a render target, writing the result to the backbuffer.
     * @param {pc.fw.ApplicationContext} context
     * @extends pc.fw.ComponentSystem
     */
    var BloomComponent = function BloomComponent (context) {
    };
    BloomComponent = pc.inherits(BloomComponent, pc.fw.Component);

    return {
        BloomComponent: BloomComponent
    };
}());