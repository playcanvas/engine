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
        var vertexBuffer = new pc.gfx.VertexBuffer(format, 32, pc.gfx.VertexBufferUsage.STATIC);
        // Generate the directional light arrow vertex data
        vertexData = [ 
            // Center arrow
            0, 0, 0, 0, -8, 0,       // Stalk
            -0.5, -8, 0, 0.5, -8, 0, // Arrowhead base
            0.5, -8, 0, 0, -10, 0,   // Arrowhead tip
            0, -10, 0, -0.5, -8, 0,  // Arrowhead tip
            // Lower arrow
            0, 0, -2, 0, -8, -2,         // Stalk
            -0.25, -8, -2, 0.25, -8, -2, // Arrowhead base
            0.25, -8, -2, 0, -10, -2,    // Arrowhead tip
            0, -10, -2, -0.25, -8, -2    // Arrowhead tip
        ];
        var rot = pc.math.mat4.makeRotate(120, [0, 1, 0]);
        for (var i = 0; i < 16; i++) {
            var pos = pc.math.vec3.create(vertexData[(i+8)*3], vertexData[(i+8)*3+1], vertexData[(i+8)*3+2]);
            var posRot = pc.math.mat4.multiplyVec3(pos, 1.0, rot);
            vertexData[(i+16)*3]   = posRot[0];
            vertexData[(i+16)*3+1] = posRot[1];
            vertexData[(i+16)*3+2] = posRot[2];
        }
        // Copy vertex data into the vertex buffer
        var positions = new Float32Array(vertexBuffer.lock());
        for (var i = 0; i < vertexData.length; i++) {
            positions[i] = vertexData[i];
        }
        vertexBuffer.unlock();

        // Set the resources on the component
        return {
            program: program,
            vertexBuffer: vertexBuffer
        };
    };

    /**
     * @name pc.fw.DirectionalLightComponentSystem
     * @constructor Create a new DirectionalLightComponentSystem
     * @class A Light Component is used to dynamically light the scene.
     * @param {Object} context
     * @extends pc.fw.ComponentSystem
     */
    var DirectionalLightComponentSystem = function (context) {
        this.context = context;
        context.systems.add("directionallight", this);

        this.renderable = _createGfxResources();

        // Handle changes to the 'castShadows' value
        this.bind("set_castShadows", this.onSetCastShadows.bind(this));
        // Handle changes to the 'color' value
        this.bind("set_color", this.onSetColor.bind(this));
        // Handle changes to the 'enable' value
        this.bind("set_enable", this.onSetEnable.bind(this));
        // Handle changes to the 'intensity' value
        this.bind("set_intensity", this.onSetIntensity.bind(this));
        // Handle changes to the 'light' value
        this.bind("set_light", this.onSetLight.bind(this));
    };
        
    DirectionalLightComponentSystem = pc.inherits(DirectionalLightComponentSystem, pc.fw.ComponentSystem);

    DirectionalLightComponentSystem.prototype.createComponent = function (entity, data) {
        var componentData = new pc.fw.DirectionalLightComponentData();

        var light = new pc.scene.LightNode();
        light.setType(pc.scene.LightType.DIRECTIONAL);

        data = data || {};
        data.light = light;

        var attribs = ['light', 'enable', 'color', 'intensity', 'castShadows'];
        this.initializeComponent(entity, componentData, data, attribs);

        return componentData;
    };
    
    DirectionalLightComponentSystem.prototype.deleteComponent = function (entity) {
        var componentData = this.getComponentData(entity);
        entity.removeChild(componentData.light);
        componentData.light.setEnabled(false);
        delete componentData.light;

        this.removeComponent(entity);
    };

    DirectionalLightComponentSystem.prototype.toolsRender = function (fn) {
        var id;
        var entity;
        var componentData;
        var components = this.getComponents();
        var transform;
        var device;
        var program = this.renderable.program;
        var vertexBuffer = this.renderable.vertexBuffer;

        for (id in components) {
            if (components.hasOwnProperty(id)) {
                entity = components[id].entity;
                componentData = components[id].component;

                // Render a representation of the light
                device = pc.gfx.Device.getCurrent();
                device.setProgram(program);
                device.setVertexBuffer(vertexBuffer, 0);
                
                transform = entity.getWorldTransform();
                device.scope.resolve("matrix_model").setValue(transform);
                device.scope.resolve("uColor").setValue([1, 1, 0, 1]);
                device.draw({
                    type: pc.gfx.PrimType.LINES,
                    base: 0,
                    count: vertexBuffer.getNumVertices(),
                    indexed: false
                });
            }
        }
    };

    DirectionalLightComponentSystem.prototype.onSetCastShadows = function (entity, name, oldValue, newValue) {
        if (newValue !== undefined) {
            var componentData = this.getComponentData(entity);
            componentData.light.setCastShadows(newValue);
        }
    };
    
    DirectionalLightComponentSystem.prototype.onSetColor = function (entity, name, oldValue, newValue) {
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

    DirectionalLightComponentSystem.prototype.onSetEnable = function (entity, name, oldValue, newValue) {
        if (newValue !== undefined) {
            var componentData = this.getComponentData(entity);
            componentData.light.setEnabled(newValue);
        }
    };

    DirectionalLightComponentSystem.prototype.onSetIntensity = function (entity, name, oldValue, newValue) {
        if (newValue !== undefined) {
            var componentData = this.getComponentData(entity);
            componentData.light.setIntensity(newValue);
        }
    };

    DirectionalLightComponentSystem.prototype.onSetLight = function (entity, name, oldValue, newValue) {
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
        DirectionalLightComponentSystem: DirectionalLightComponentSystem
    }; 
}());
