pc.extend(pc.fw, function () {
    var CubeMapComponentSystem = function (context) {
        this.id = 'cubemap';
        context.systems.add(this.id, this);

        this.ComponentType = pc.fw.CubeMapComponent;
        this.DataType = pc.fw.CubeMapComponentData;

        this.schema = [{
            name: 'cubemap',
            exposed: false
        }, {
            name: 'camera',
            exposed: false
        }, {
            name: 'targets',
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
                height: 256,
                cubemap: true
            });
            cubemap.minFilter = pc.gfx.FILTER_LINEAR_MIPMAP_LINEAR;
            cubemap.magFilter = pc.gfx.FILTER_LINEAR;
            cubemap.addressU = pc.gfx.ADDRESS_CLAMP_TO_EDGE;
            cubemap.addressV = pc.gfx.ADDRESS_CLAMP_TO_EDGE;

            var targets = [];
            for (var i = 0; i < 6; i++) {
                var target = new pc.gfx.RenderTarget(this.context.graphicsDevice, cubemap, {
                    face: i,
                    depth: true
                });
                targets.push(target);
            }

            var camera = new pc.scene.CameraNode();
            camera.setNearClip(0.01);
            camera.setFarClip(10000);
            camera.setAspectRatio(1);

            data.cubemap = cubemap;
            data.targets = targets;
            data.camera = camera;

            CubeMapComponentSystem._super.initializeComponentData.call(this, component, data, ['targets', 'cubemap', 'camera']);
        },

        onUpdate: function (dt) {
            var id;
            var entity;
            var componentData;
            var components = this.store;
            var transform;

            for (id in components) {
                if (components.hasOwnProperty(id)) {
                    entity = components[id].entity;
                    componentData = components[id].data;

                    var model;
                    // Get the model from either the model or primitive component
                    if (entity.model) {
                        model = entity.model.model;
                    } else if (entity.primitive) {
                        model = entity.primitive.model;
                    }

                    if (model) {
                        var scene = this.context.scene;
                        scene.removeModel(model);

                        var lookAts = [
                          { target: [ 1, 0, 0], up: [0,-1, 0]},
                          { target: [-1, 0, 0], up: [0,-1, 0]},
                          { target: [ 0, 1, 0], up: [0, 0, 1]},
                          { target: [ 0,-1, 0], up: [0, 0,-1]},
                          { target: [ 0, 0, 1], up: [0,-1, 0]},
                          { target: [ 0, 0,-1], up: [0,-1, 0]}
                        ];
                        var pos = entity.getPosition();

                        for (var face = 0; face < 6; face++) {
                            var camera = componentData.camera;

                            // Set the face of the cubemap
                            camera.setRenderTarget(componentData.targets[face]);

                            // Point the camera in the right direction
                            camera.setPosition(pos);
                            camera.lookAt(lookAts[face].target, lookAts[face].up);
                            camera.syncHierarchy();

                            // Render the scene
                            scene.render(camera, this.context.graphicsDevice);
                        }

                        scene.addModel(model);
                    }
                }
            }
        }
    });

    return {
        CubeMapComponentSystem: CubeMapComponentSystem
    }; 
}());
