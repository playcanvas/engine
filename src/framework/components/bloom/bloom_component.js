pc.extend(pc.fw, function () {

    /**
     * @name pc.fw.BloomComponentSystem
     * @constructor Create a new BloomComponent
     * @class Applies a bloom filter to a render target, writing the result to the backbuffer.
     * @param {pc.fw.ApplicationContext} context
     * @extends pc.fw.ComponentSystem
     */
    var BloomComponentSystem = function BloomComponentSystem (context) {
        context.systems.add("bloom", this);
    }
    BloomComponentSystem = pc.inherits(BloomComponentSystem, pc.fw.ComponentSystem);
    
    BloomComponentSystem.prototype.createComponent = function (entity, data) {
        var componentData = new pc.fw.BloomComponentData();

        this.initializeComponent(entity, componentData, data, ['bloomThreshold', 'blurAmount', 'bloomIntensity', 'baseIntensity', 'bloomSaturation', 'baseSaturation']);

        return componentData;
    };
    
    BloomComponentSystem.prototype.deleteComponent = function (entity) {
        var componentData = this.getComponentData(entity);
        this.removeComponent(entity);
    };
    
    BloomComponentSystem.prototype.update = function (dt) {
        var components = this.getComponents();

        for (var id in components) {
            if (components.hasOwnProperty(id)) {
                var entity = components[id].entity;
                var componentData = components[id].component;

                this.context.scene.enqueue("post", (function(data, e, c) {
                        return function () {
                            var offscreen = c.systems.camera.get(e, "offscreen");
                            var camera = c.systems.camera.get(e, "camera");
                            var currentEntity = c.systems.camera.getCurrent();
                            var currentCamera = c.systems.camera.get(currentEntity, "camera");

                            if (offscreen && (currentCamera === camera)) {
                                var input = camera.getRenderTarget();
                                var output = new pc.gfx.RenderTarget(pc.gfx.FrameBuffer.getBackBuffer());

                                // HACK: Remove when BitBucket #70 is fixed
                                data.bloomThreshold = typeof data.bloomThreshold == "string" ? parseFloat(data.bloomThreshold) : data.bloomThreshold;
                                data.blurAmount = typeof data.blurAmount == "string" ? parseFloat(data.blurAmount) : data.blurAmount;
                                data.bloomIntensity = typeof data.bloomIntensity == "string" ? parseFloat(data.bloomIntensity) : data.bloomIntensity;
                                data.baseIntensity = typeof data.baseIntensity == "string" ? parseFloat(data.baseIntensity) : data.baseIntensity;
                                data.bloomSaturation = typeof data.bloomSaturation == "string" ? parseFloat(data.bloomSaturation) : data.bloomSaturation;
                                data.baseSaturation = typeof data.baseSaturation == "string" ? parseFloat(data.baseSaturation) : data.baseSaturation;

                                pc.gfx.post.bloom.render(input, output, {
                                    bloomThreshold: data.bloomThreshold,
                                    blurAmount: data.blurAmount,
                                    bloomIntensity: data.bloomIntensity,
                                    baseIntensity: data.baseIntensity,
                                    bloomSaturation: data.bloomSaturation,
                                    baseSaturation: data.baseSaturation
                                });
                            }
                        }
                    })(componentData, entity, this.context));
            }
        }
    };

    return {
        BloomComponentSystem: BloomComponentSystem
    }
}());