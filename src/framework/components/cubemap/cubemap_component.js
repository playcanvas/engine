pc.extend(pc.fw, function () {
    var CubeMapComponentSystem = function (context) {
            context.systems.add("cubemap", this);
        };

    CubeMapComponentSystem = pc.inherits(CubeMapComponentSystem, pc.fw.ComponentSystem);
    
    CubeMapComponentSystem.prototype.createComponent = function (entity, data) {
        var componentData = new pc.fw.CubeMapComponentData();

        componentData.buffer = new pc.gfx.FrameBuffer(256, 256, true, true);
        componentData.cubemap = componentData.buffer.getTexture();
        componentData.cubemap.setFilterMode(pc.gfx.TextureFilter.LINEAR, pc.gfx.TextureFilter.LINEAR);
        componentData.cubemap.setAddressMode(pc.gfx.TextureAddress.CLAMP_TO_EDGE, pc.gfx.TextureAddress.CLAMP_TO_EDGE);
        componentData.camera = new pc.scene.CameraNode();
        componentData.camera.setRenderTarget(new pc.gfx.RenderTarget(componentData.buffer));

        this.initializeComponent(entity, componentData, data, []);

        return componentData;
    };

    CubeMapComponentSystem.prototype.deleteComponent = function (entity) {
        var data = this.getComponentData(entity);

        this.removeComponent(entity);
    };
    
    CubeMapComponentSystem.prototype.update = function (dt) {};

    CubeMapComponentSystem.prototype.render = function () {
        var id;
        var entity;
        var componentData;
        var components = this.getComponents();
        var transform;

        if (this.renderingCubeMap) return;
        this.renderingCubeMap = true;

        for (id in components) {
            if (components.hasOwnProperty(id)) {
                entity = components[id].entity;
                transform = entity.getWorldTransform();
                componentData = components[id].component;

                this.context.systems.camera.frameEnd();

                var model = this.context.systems.model.get(entity, "model");
                if (model) {
                    this.context.scene.removeModel(model);
                }

                var lookAts = [
                  { target: [ 1, 0, 0], up: [0,-1, 0]},
                  { target: [-1, 0, 0], up: [0,-1, 0]},
                  { target: [ 0, 1, 0], up: [0, 0, 1]},
                  { target: [ 0,-1, 0], up: [0, 0,-1]},
                  { target: [ 0, 0, 1], up: [0,-1, 0]},
                  { target: [ 0, 0,-1], up: [0,-1, 0]}
                ];
                var pos = pc.math.mat4.getTranslation(transform);

                for (var face = 0; face < 6; face++) {
                    componentData.buffer.setActiveBuffer(face);
                    var look = pc.math.mat4.makeLookAt([0, 0, 0], lookAts[face].target, lookAts[face].up);
                    look[12] = pos[0];
                    look[13] = pos[1] + 0.5;
                    look[14] = pos[2];
                    componentData.camera.setLocalTransform(look);
                    componentData.camera.syncHierarchy();
                    componentData.camera.frameBegin();
                    pc.fw.ComponentSystem.render(this.context, false);
                    this.context.scene.dispatch(componentData.camera);
                    this.context.scene.flush();
                    componentData.camera.frameEnd();
                }

                if (model) {
                    this.context.scene.addModel(model);
                }

                this.context.systems.camera.frameBegin(false);
            }
        }

        this.renderingCubeMap = false;
    };
    
    return {
        CubeMapComponentSystem: CubeMapComponentSystem
    }; 
}());
