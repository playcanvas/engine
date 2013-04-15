pc.extend(pc.fw, function () {

    /**
     * @name pc.fw.BloomComponentSystem
     * @constructor Create a new BloomComponent
     * @class Applies a bloom filter to a render target, writing the result to the backbuffer.
     * @param {pc.fw.ApplicationContext} context
     * @extends pc.fw.ComponentSystem
     */
    var BloomComponentSystem = function BloomComponentSystem(context) {
        this.id = "bloom";
        context.systems.add(this.id, this);

        this.ComponentType = pc.fw.BloomComponent;
        this.DataType = pc.fw.BloomComponentData;

        this.schema = [{
         name: "bloomThreshold",
         displayName: "Bloom Threshold",
            description: "The luminance threshold above which blooming is applied",
            type: "number",
            options: {
                max: 1,
                min: 0,
                step: 0.05
            },
            defaultValue: 0.25
        }, {
         name: "blurAmount",
         displayName: "Blur Amount",
            description: "The luminance threshold above which blooming is applied",
            type: "number",
            options: {
                max: 10,
                min: 1,
                step: 0.5
            },
            defaultValue: 4
        }, { 
         name: "bloomIntensity",
         displayName: "Bloom Intensity",
         description: "TBD",
            type: "number",
            options: {
                max: 3,
                min: 0,
                step: 0.05
            },
            defaultValue: 1.25
        }, {
         name: "baseIntensity",
         displayName: "Base Intensity",
         description: "TBD",
            type: "number",
            options: {
                max: 3,
                min: 0,
                step: 0.05
            },
            defaultValue: 1
        }, {
         name: "bloomSaturation",
         displayName: "Bloom Saturation",
         description: "TBD",
            type: "number",
            options: {
                max: 3,
                min: 0,
                step: 0.05
            },
            defaultValue: 1
        }, {
         name: "baseSaturation",
         displayName: "Base Saturation",
         description: "TBD",
            type: "number",
            options: {
                max: 3,
                min: 0,
                step: 0.05
            },
            defaultValue: 1
        }];
        this.exposeProperties();

        pc.fw.ComponentSystem.on('update', this.onUpdate, this);
    };
    BloomComponentSystem = pc.inherits(BloomComponentSystem, pc.fw.ComponentSystem);
    
    pc.extend(BloomComponentSystem.prototype, {
        initializeComponentData: function (component, data, properties) {
            BloomComponentSystem._super.initializeComponentData.call(this, component, data, ['bloomThreshold', 'blurAmount', 'bloomIntensity', 'baseIntensity', 'bloomSaturation', 'baseSaturation']);
        },

        onUpdate: function (dt) {
            var components = this.store;
            for (var id in components) {
                if (components.hasOwnProperty(id)) {
                    var entity = components[id].entity;
                    var componentData = components[id].data;

                    this.context.scene.enqueue("post", (function(data, e, c) {
                            return function () {
                                if (e.camera) {
                                    var offscreen = e.camera.offscreen;
                                    var camera = e.camera.camera;
                                    var currentEntity = c.systems.camera.current;
                                    var currentCamera = currentEntity.camera.camera;

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
                            };
                        })(componentData, entity, this.context));
                }
            }
        }
    });
    
    return {
        BloomComponentSystem: BloomComponentSystem
    };
}());