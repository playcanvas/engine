pc.extend(pc.fw, function () {
    var CubeMapComponentSystem = function (context) {
        this.id = 'cubemap';
        context.systems.add(this.id, this);

        this.ComponentType = pc.fw.CubeMapComponent;
        this.DataType = pc.fw.CubeMapComponentData;

        this.schema = [{
            name: 'buffer',
            exposed: false
        }, {
            name: 'cubemap',
            exposed: false
        }, {
            name: 'camera',
            exposed: false
        }];

        this.exposeProperties();

        pc.fw.ComponentSystem.on('update', this.onUpdate, this);
    };
    CubeMapComponentSystem = pc.inherits(CubeMapComponentSystem, pc.fw.ComponentSystem);
    
    pc.extend(CubeMapComponentSystem.prototype, {
        initializeComponentData: function (component, data, properties) {
            var cubemap = new pc.gfx.Texture(this.context.graphicsDevice, {
                format: pc.gfx.PIXELFORMAT_R8_G8_B8,
                width: 256,
                height: 256
            });
            cubemap.minFilter = pc.gfx.FILTER_LINEAR;
            cubemap.magFilter = pc.gfx.FILTER_LINEAR;
            cubemap.addressU = pc.gfx.ADDRESS_CLAMP_TO_EDGE;
            cubemap.addressV = pc.gfx.ADDRESS_CLAMP_TO_EDGE;

            data.cubemap = cubemap;
            data.targets = [];

            for (var i = 0; i < 6; i++) {
                var target = new pc.gfx.RenderTarget(this.context, cubemap, {
                    face: i,
                    depth: true
                });
                data.targets.push(target);
            }

            data.camera = new pc.scene.CameraNode();
            data.camera.setNearClip(0.01);
            data.camera.setFarClip(100);
            data.camera.setAspectRatio(1);

            CubeMapComponentSystem._super.initializeComponentData.call(this, component, data, ['buffer', 'cubemap', 'camera']);
        },

        onUpdate: function (dt) {
            var id;
            var entity;
            var componentData;
            var components = this.store;
            var transform;

            if (this.renderingCubeMap) return;
            this.renderingCubeMap = true;

            for (id in components) {
                if (components.hasOwnProperty(id)) {
                    entity = components[id].entity;
                    componentData = components[id].data;

                    this.context.scene.enqueue("first", (function(data, ent, ctx) {
                            return function () {
                                ctx.systems.camera.frameEnd();

                                var model;
                                // Get the model from either the model or primitive component
                                if (ent.model) {
                                    model = ent.model.model;
                                } else if (ent.primitive) {
                                    model = ent.primitive.model;
                                }

                                // TODO: This needs to be changed to use scene.enqueue
                                if (model) {
                                    ctx.scene.removeModel(model);

                                    var lookAts = [
                                      { target: [ 1, 0, 0], up: [0,-1, 0]},
                                      { target: [-1, 0, 0], up: [0,-1, 0]},
                                      { target: [ 0, 1, 0], up: [0, 0, 1]},
                                      { target: [ 0,-1, 0], up: [0, 0,-1]},
                                      { target: [ 0, 0, 1], up: [0,-1, 0]},
                                      { target: [ 0, 0,-1], up: [0,-1, 0]}
                                    ];
                                    var pos = ent.getPosition();

                                    for (var face = 0; face < 6; face++) {
                                        // Set the face of the cubemap
                                        data.buffer.setActiveBuffer(face);

                                        // Point the camera in the right direction
                                        data.camera.setPosition(pos);
                                        data.camera.lookAt(lookAts[face].target, lookAts[face].up);
                                        data.camera.syncHierarchy();

                                        // Render the scene
                                        data.camera.frameBegin();
                                        var models = ctx.scene.getModels();
                                        for (var i = 0; i < models.length; i++) {
                                            models[i].dispatch();
                                        }
                                        data.camera.frameEnd();
                                    }

                                    ctx.scene.addModel(model);
                                }

                                ctx.systems.camera.frameBegin(false);
                            };
                        })(componentData, entity, this.context));
                }
            }

            this.renderingCubeMap = false;
        }
    });

    return {
        CubeMapComponentSystem: CubeMapComponentSystem
    }; 
}());
