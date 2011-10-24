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
    BloomComponentSystem = BloomComponentSystem.extendsFrom(pc.fw.ComponentSystem);
    
    BloomComponentSystem.prototype.createComponent = function (entity, data) {
        var componentData = new pc.fw.BloomComponentData();
        var properties = ["bloomThreshold", "blurAmount", "bloomIntensity", "baseIntensity", "bloomSaturation", "baseSaturation"];
        data = data || {};
        
        this.addComponent(entity, componentData);
        
        properties.forEach(function(value, index, arr) {
            this.set(entity, value, data[value]);
        }, this);
        
        return componentData;
    };
    
    BloomComponentSystem.prototype.deleteComponent = function (entity) {
        var componentData = this._getComponentData(entity);
        this.removeComponent(entity);
    };
    
    BloomComponentSystem.prototype.render = function (fn) {
        var id;
        var entity;
        var componentData;
        var components = this._getComponents();

        for (id in components) {
            if (components.hasOwnProperty(id)) {
                entity = components[id].entity;
                componentData = components[id].component;

                var offscreen = this.context.systems.camera.get(entity, "offscreen");
                var camera = this.context.systems.camera.get(entity, "camera");
                var currentCamera = this.context.systems.camera._camera;

                if (offscreen && (currentCamera === camera)) {
                    this.context.scene.enqueue("post", (function(data, camera) {
                            return function () {
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
                        })(componentData, currentCamera));
                }
            }
        }
    };

    return {
        BloomComponentSystem: BloomComponentSystem
    }
}());