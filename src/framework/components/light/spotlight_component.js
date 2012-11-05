pc.extend(pc.fw, function () {
    /**
     * @name pc.fw.SpotLightComponent
     * @constructor Create a new SpotLightComponent
     * @class A Light Component is used to dynamically light the scene.
     * @param {Object} context
     * @extends pc.fw.Component
     */
    var SpotLightComponent = function (context) {
        var schema = [{
            name: "enable",
            displayName: "Enable",
            description: "Enable or disable the light",
            type: "boolean",
            defaultValue: true
        }, {
            name: "color",
            displayName: "Color",
            description: "Light color",
            type: "rgb",
            defaultValue: "0xffffff"
        }, {
            name: "intensity",
            displayName: "Intensity",
            description: "Factors the light color",
            type: "number",
            defaultValue: 1,
            options: {
                min: 0,
                max: 10,
                step: 0.05
            }
        }, {
            name: "castShadows",
            displayName: "Cast shadows",
            description: "Cast shadows from this light",
            type: "boolean",
            defaultValue: false
        }, {
            name: "attenuationEnd",
            displayName: "Attenuation End",
            description: "The distance from the light where its contribution falls to zero",
            type: "number",
            defaultValue: 10,
            options: {
                min: 0
            }
        }, {
            name: "innerConeAngle",
            displayName: "Inner Cone Angle",
            description: "Spotlight inner cone angle",
            type: "number",
            defaultValue: 40,
            options: {
                min: 0,
                max: 90
            }
        }, {
            name: "outerConeAngle",
            displayName: "Outer Cone Angle",
            description: "Spotlight outer cone angle",
            type: "number",
            defaultValue: 45,
            options: {
                min: 0,
                max: 90
            }
        }, {
            name: "light",
            expose: false
        }];

        this.assignSchema(schema);

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
    SpotLightComponent = pc.inherits(SpotLightComponent, pc.fw.Component);

    pc.extend(SpotLightComponent.prototype, {
        onSetAttenuationEnd: function (name, oldValue, newValue) {
            this.data.light.setAttenuationEnd(newValue);
        },

        onSetCastShadows: function (name, oldValue, newValue) {
            this.data.light.setCastShadows(newValue);
        },

        onSetColor: function (name, oldValue, newValue) {
            var rgb = parseInt(newValue);
            rgb = pc.math.intToBytes24(rgb);
            var color = [
                rgb[0] / 255,
                rgb[1] / 255,
                rgb[2] / 255
            ];
            this.data.light.setColor(color);
        },

        onSetInnerConeAngle: function (name, oldValue, newValue) {
            this.data.light.setInnerConeAngle(newValue);
        },

        onSetOuterConeAngle: function (name, oldValue, newValue) {
            this.data.light.setOuterConeAngle(newValue);
        },

        onSetEnable: function (name, oldValue, newValue) {
            this.data.light.setEnabled(newValue);
        },

        onSetIntensity: function (name, oldValue, newValue) {
            this.data.light.setIntensity(newValue);
        },

        onSetLight: function (name, oldValue, newValue) {
            if (oldValue) {
                this.entity.removeChild(oldValue);
                this.system.context.scene.removeLight(oldValue);
            }
            if (newValue) {
                this.entity.addChild(newValue);
                this.system.context.scene.addLight(newValue);
            }
        }
    });

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
    
    return {
        SpotLightComponent: SpotLightComponent
    }; 
}());
