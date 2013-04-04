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
            data.buffer = new pc.gfx.FrameBuffer(256, 256, true, true);
            data.cubemap = data.buffer.getTexture();
            data.cubemap.minFilter = pc.gfx.FILTER_LINEAR;
            data.cubemap.magFilter = pc.gfx.FILTER_LINEAR;
            data.cubemap.addressU = pc.gfx.ADDRESS_CLAMP_TO_EDGE;
            data.cubemap.addressV = pc.gfx.ADDRESS_CLAMP_TO_EDGE;

            data.camera = new pc.scene.CameraNode();
            data.camera.setNearClip(0.01);
            data.camera.setFarClip(100);
            data.camera.setAspectRatio(1);
            data.camera.setRenderTarget(new pc.gfx.RenderTarget(data.buffer));
        
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
