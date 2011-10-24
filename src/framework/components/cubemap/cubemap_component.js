pc.extend(pc.fw, function () {
    var CubeMapComponentSystem = function (context) {
            context.systems.add("cubemap", this);
        };

    CubeMapComponentSystem = CubeMapComponentSystem.extendsFrom(pc.fw.ComponentSystem);
    
    CubeMapComponentSystem.prototype.createComponent = function (entity, data) {
        var componentData = new pc.fw.CubeMapComponentData();
        var properties = ["nearClip", "farClip"];
        data = data || {};

        componentData.buffer = new pc.gfx.FrameBuffer(256, 256, true, true);
        componentData.cubemap = componentData.buffer.getTexture();
        componentData.cubemap.setFilterMode(pc.gfx.TextureFilter.LINEAR, pc.gfx.TextureFilter.LINEAR);
        componentData.cubemap.setAddressMode(pc.gfx.TextureAddress.CLAMP_TO_EDGE, pc.gfx.TextureAddress.CLAMP_TO_EDGE);
        componentData.camera = this.context.manager.create(pc.scene.CameraNode);
        componentData.camera.setRenderTarget(new pc.gfx.RenderTarget(componentData.buffer));

        this.addComponent(entity, componentData);        
        
        properties.forEach(function(value, index, arr) {
            if(pc.isDefined(data[value])) {
                this.set(entity, value, data[value]);
            }
        }, this);
        
        return componentData;
    };

    CubeMapComponentSystem.prototype.deleteComponent = function (entity) {
        var data = this._getComponentData(entity);

        this.removeComponent(entity);
    };
    
    CubeMapComponentSystem.prototype.update = function (dt) {};

    CubeMapComponentSystem.prototype.render = function () {
        var id;
        var entity;
        var componentData;
        var components = this._getComponents();
        var transform;

        if (this.renderingCubeMap) return;
        this.renderingCubeMap = true;

        for (id in components) {
            if (components.hasOwnProperty(id)) {
                entity = components[id].entity;
                transform = entity.getWorldTransform();
                componentData = components[id].component;

                this.context.components.camera.frameEnd();

                var model = this.context.components.model.get(entity, "model");
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

                this.context.components.camera.frameBegin(false);
            }
        }

        this.renderingCubeMap = false;
    };
    
    return {
        CubeMapComponentSystem: CubeMapComponentSystem
    }; 
}());
