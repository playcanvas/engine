pc.extend(pc.fw, function () {
    var _createGfxResources = function () {
        // Create the graphical resources required to render a light
        var device = pc.gfx.Device.getCurrent();
        var library = device.getProgramLibrary();
        var program = library.getProgram("basic", { vertexColors: false, diffuseMap: false });
        var format = new pc.gfx.VertexFormat();
        format.begin();
        format.addElement(new pc.gfx.VertexElement("vertex_position", 3, pc.gfx.VertexElementType.FLOAT32));
        format.end();
        var vertexBuffer = new pc.gfx.VertexBuffer(format, 42, pc.gfx.VertexBufferUsage.DYNAMIC);
        var indexBuffer = new pc.gfx.IndexBuffer(pc.gfx.IndexFormat.UINT8, 88);
        var inds = new Uint8Array(indexBuffer.lock());
        // Spot cone side lines
        inds[0] = 0;
        inds[1] = 1;
        inds[2] = 0;
        inds[3] = 11;
        inds[4] = 0;
        inds[5] = 21;
        inds[6] = 0;
        inds[7] = 31;
        // Spot cone circle - 40 segments
        for (var i = 0; i < 40; i++) {
            inds[8 + i * 2 + 0] = i + 1;
            inds[8 + i * 2 + 1] = i + 2;
        }
        indexBuffer.unlock();

        // Set the resources on the component
        return {
            program: program,
            vertexBuffer: vertexBuffer,
            indexBuffer: indexBuffer
        };
    };

    /**
     * @name pc.fw.SpotLightComponentSystem
     * @constructor Create a new SpotLightComponentSystem
     * @class A Light Component is used to dynamically light the scene.
     * @param {Object} context
     * @extends pc.fw.ComponentSystem
     */
    var SpotLightComponentSystem = function (context) {
        this.context = context;
        context.systems.add("spotlight", this);

        this.renderable = _createGfxResources();

        // Handle changes to the 'attenuationEnd' value
        this.bind("set_attenuationEnd", this.onSetAttenuationEnd.bind(this));
        // Handle changes to the 'castShadows' value
        this.bind("set_castShadows", this.onSetCastShadows.bind(this));
        // Handle changes to the 'color' value
        this.bind("set_color", this.onSetColor.bind(this));
        // Handle changes to the 'enable' value
        this.bind("set_enable", this.onSetEnable.bind(this));
        // Handle changes to the 'innerConeAngle' value
        this.bind("set_innerConeAngle", this.onSetInnerConeAngle.bind(this));
        // Handle changes to the 'intensity' value
        this.bind("set_intensity", this.onSetIntensity.bind(this));
        // Handle changes to the 'light' value
        this.bind("set_light", this.onSetLight.bind(this));
        // Handle changes to the 'outerConeAngle' value
        this.bind("set_outerConeAngle", this.onSetOuterConeAngle.bind(this));
    };

    SpotLightComponentSystem = pc.inherits(SpotLightComponentSystem, pc.fw.ComponentSystem);

    SpotLightComponentSystem.prototype.createComponent = function (entity, data) {
        var componentData = new pc.fw.SpotLightComponentData();

        var light = new pc.scene.LightNode();
        light.setType(pc.scene.LightType.SPOT);

        data = data || {};
        data.light = light;

        var attribs = ['light', 'enable', 'color', 'intensity', 'castShadows', 'attenuationEnd', 'innerConeAngle', 'outerConeAngle'];
        this.initialiseComponent(entity, componentData, data, attribs);

        return componentData;
    };
    
    SpotLightComponentSystem.prototype.deleteComponent = function (entity) {
        var componentData = this.getComponentData(entity);
        entity.removeChild(componentData.light);
        componentData.light.setEnabled(false);
        delete componentData.light;

        this.removeComponent(entity);
    };

    SpotLightComponentSystem.prototype.toolsRender = function (fn) {
        var components = this.getComponents();
        for (var id in components) {
            if (components.hasOwnProperty(id)) {
                var entity = components[id].entity;
                var componentData = components[id].component;
                var program = this.renderable.program;
                var indexBuffer = this.renderable.indexBuffer;
                var vertexBuffer = this.renderable.vertexBuffer;

                var light = componentData.light;
                var oca = Math.PI * light.getOuterConeAngle() / 180;
                var ae = light.getAttenuationEnd();
                var y = -ae * Math.cos(oca);
                var r = ae * Math.sin(oca);

                var positions = new Float32Array(vertexBuffer.lock());
                positions[0] = 0;
                positions[1] = 0;
                positions[2] = 0;
                var numVerts = vertexBuffer.getNumVertices();
                for (var i = 0; i < numVerts-1; i++) {
                    var theta = 2 * Math.PI * (i / (numVerts-2));
                    var x = r * Math.cos(theta);
                    var z = r * Math.sin(theta);
                    positions[(i+1)*3+0] = x;
                    positions[(i+1)*3+1] = y;
                    positions[(i+1)*3+2] = z;
                }
                vertexBuffer.unlock();

                // Render a representation of the light
                var device = pc.gfx.Device.getCurrent();
                device.setProgram(program);
                device.setIndexBuffer(indexBuffer);
                device.setVertexBuffer(vertexBuffer, 0);

                transform = entity.getWorldTransform();
                device.scope.resolve("matrix_model").setValue(transform);
                var c = light.getColor();
                device.scope.resolve("constant_color").setValue([c[0], c[1], c[2], 1]);
                device.draw({
                    type: pc.gfx.PrimType.LINES,
                    base: 0,
                    count: indexBuffer.getNumIndices(),
                    indexed: true
                });
            }
        }
    };

    SpotLightComponentSystem.prototype.onSetAttenuationEnd = function (entity, name, oldValue, newValue) {
        if (newValue) {
            var componentData = this.getComponentData(entity);
            componentData.light.setAttenuationEnd(newValue);
        }
    };

    SpotLightComponentSystem.prototype.onSetCastShadows = function (entity, name, oldValue, newValue) {
        if (newValue !== undefined) {
            var componentData = this.getComponentData(entity);
            componentData.light.setCastShadows(newValue);
        }
    };

    SpotLightComponentSystem.prototype.onSetColor = function (entity, name, oldValue, newValue) {
        if (newValue) {
            var componentData = this.getComponentData(entity);
            var rgb = parseInt(newValue);
            rgb = pc.math.intToBytes24(rgb);
            var color = [
                rgb[0] / 255,
                rgb[1] / 255,
                rgb[2] / 255
            ];
            componentData.light.setColor(color);
        }
    };

    SpotLightComponentSystem.prototype.onSetInnerConeAngle = function (entity, name, oldValue, newValue) {
        if (newValue !== undefined) {
            var componentData = this.getComponentData(entity);
            componentData.light.setInnerConeAngle(newValue);
        }
    };

    SpotLightComponentSystem.prototype.onSetOuterConeAngle = function (entity, name, oldValue, newValue) {
        if (newValue !== undefined) {
            var componentData = this.getComponentData(entity);
            componentData.light.setOuterConeAngle(newValue);
        }
    };

    SpotLightComponentSystem.prototype.onSetEnable = function (entity, name, oldValue, newValue) {
        if (newValue !== undefined) {
            var componentData = this.getComponentData(entity);
            componentData.light.setEnabled(newValue);
        }
    };

    SpotLightComponentSystem.prototype.onSetIntensity = function (entity, name, oldValue, newValue) {
        if (newValue !== undefined) {
            var componentData = this.getComponentData(entity);
            componentData.light.setIntensity(newValue);
        }
    };

    SpotLightComponentSystem.prototype.onSetLight = function (entity, name, oldValue, newValue) {
        if (oldValue) {
            entity.removeChild(oldValue);
            this.context.scene.removeLight(oldValue);
        }
        if (newValue) {
            entity.addChild(newValue);
            this.context.scene.addLight(newValue);
        }
    };
    
    return {
        SpotLightComponentSystem: SpotLightComponentSystem
    }; 
}());
