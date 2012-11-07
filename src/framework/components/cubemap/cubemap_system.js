pc.extend(pc.fw, function () {
    var CubeMapComponentSystem = function (context) {
        this.id = "cubemap"
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

        pc.fw.ComponentSystem.bind('update', this.onUpdate.bind(this));
    };
    CubeMapComponentSystem = pc.inherits(CubeMapComponentSystem, pc.fw.ComponentSystem);
    
    pc.extend(CubeMapComponentSystem.prototype, {
        initializeComponentData: function (component, data, properties) {
            data.buffer = new pc.gfx.FrameBuffer(256, 256, true, true);
            data.cubemap = data.buffer.getTexture();
            data.cubemap.setFilterMode(pc.gfx.TextureFilter.LINEAR, pc.gfx.TextureFilter.LINEAR);
            data.cubemap.setAddressMode(pc.gfx.TextureAddress.CLAMP_TO_EDGE, pc.gfx.TextureAddress.CLAMP_TO_EDGE);
            data.camera = new pc.scene.CameraNode();
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
                    transform = entity.getWorldTransform();
                    componentData = components[id].data;

                    this.context.systems.camera.frameEnd();

                    var model;
                    // Get the model from either the model or primitive component
                    if (entity.model) {
                        model = entity.model.model
                    } else if (entity.primitive) {
                        model = entity.primitive.model;
                    }

                    // TODO: This needs to be changed to use scene.enqueue
                    if (model) {
                        this.context.scene.removeModel(model);

                        var lookAts = [
                          { target: [ 1, 0, 0], up: [0,-1, 0]},
                          { target: [-1, 0, 0], up: [0,-1, 0]},
                          { target: [ 0, 1, 0], up: [0, 0, 1]},
                          { target: [ 0,-1, 0], up: [0, 0,-1]},
                          { target: [ 0, 0, 1], up: [0,-1, 0]},
                          { target: [ 0, 0,-1], up: [0,-1, 0]}
                        ];
                        var pos = pc.math.mat4.getTranslation(transform);

                        // for (var face = 0; face < 6; face++) {
                        //     componentData.buffer.setActiveBuffer(face);
                        //     var look = pc.math.mat4.makeLookAt([0, 0, 0], lookAts[face].target, lookAts[face].up);
                        //     look[12] = pos[0];
                        //     look[13] = pos[1] + 0.5;
                        //     look[14] = pos[2];
                        //     componentData.camera.setLocalTransform(look);
                        //     componentData.camera.syncHierarchy();
                        //     componentData.camera.frameBegin();
                        //     pc.fw.ComponentSystem.render(this.context, false);
                        //     this.context.scene.dispatch(componentData.camera);
                        //     this.context.scene.flush();
                        //     componentData.camera.frameEnd();
                        // }

                        this.context.scene.addModel(model);
                    }

                    this.context.systems.camera.frameBegin(false);
                }
            }

            this.renderingCubeMap = false;
        }
    });
    
    // CubeMapComponentSystem.prototype.update = function (dt) {};

    // CubeMapComponentSystem.prototype.render = function () {
    //     var id;
    //     var entity;
    //     var componentData;
    //     var components = this.getComponents();
    //     var transform;

    //     if (this.renderingCubeMap) return;
    //     this.renderingCubeMap = true;

    //     for (id in components) {
    //         if (components.hasOwnProperty(id)) {
    //             entity = components[id].entity;
    //             transform = entity.getWorldTransform();
    //             componentData = components[id].component;

    //             this.context.systems.camera.frameEnd();

    //             var model = this.context.systems.model.get(entity, "model");
    //             if (model) {
    //                 this.context.scene.removeModel(model);
    //             }

    //             var lookAts = [
    //               { target: [ 1, 0, 0], up: [0,-1, 0]},
    //               { target: [-1, 0, 0], up: [0,-1, 0]},
    //               { target: [ 0, 1, 0], up: [0, 0, 1]},
    //               { target: [ 0,-1, 0], up: [0, 0,-1]},
    //               { target: [ 0, 0, 1], up: [0,-1, 0]},
    //               { target: [ 0, 0,-1], up: [0,-1, 0]}
    //             ];
    //             var pos = pc.math.mat4.getTranslation(transform);

    //             for (var face = 0; face < 6; face++) {
    //                 componentData.buffer.setActiveBuffer(face);
    //                 var look = pc.math.mat4.makeLookAt([0, 0, 0], lookAts[face].target, lookAts[face].up);
    //                 look[12] = pos[0];
    //                 look[13] = pos[1] + 0.5;
    //                 look[14] = pos[2];
    //                 componentData.camera.setLocalTransform(look);
    //                 componentData.camera.syncHierarchy();
    //                 componentData.camera.frameBegin();
    //                 pc.fw.ComponentSystem.render(this.context, false);
    //                 this.context.scene.dispatch(componentData.camera);
    //                 this.context.scene.flush();
    //                 componentData.camera.frameEnd();
    //             }

    //             if (model) {
    //                 this.context.scene.addModel(model);
    //             }

    //             this.context.systems.camera.frameBegin(false);
    //         }
    //     }

    //     this.renderingCubeMap = false;
    // };
    
    return {
        CubeMapComponentSystem: CubeMapComponentSystem
    }; 
}());
