pc.extend(pc.fw, function () {
    /**
     * @name pc.fw.PointLightComponentSystem
     * @constructor Create a new PointLightComponentSystem
     * @class A Light Component is used to dynamically light the scene.
     * @param {Object} context
     * @extends pc.fw.ComponentSystem
     */
    var PointLightComponent = function (system, entity) {
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
            name: 'light', 
            exposed: false
        }];

        this.assignSchema(schema);

        // Handle changes to the 'attenuationEnd' value
        this.bind("set_attenuationEnd", this.onSetAttenuationEnd.bind(this));
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
        
    PointLightComponent = pc.inherits(PointLightComponent, pc.fw.Component);

    pc.extend(PointLightComponent.prototype, {
        onSetAttenuationEnd: function (name, oldValue, newValue) {
            this.light.setAttenuationEnd(newValue);
        },

        onSetCastShadows: function (name, oldValue, newValue) {
            this.light.setCastShadows(newValue);
        },
        
        onSetColor: function (name, oldValue, newValue) {
            var rgb = parseInt(newValue);
            rgb = pc.math.intToBytes24(rgb);
            var color = [
                rgb[0] / 255,
                rgb[1] / 255,
                rgb[2] / 255
            ];
            this.light.setColor(color);
        },

        onSetEnable: function (name, oldValue, newValue) {
            this.light.setEnabled(newValue);
        },

        onSetIntensity: function (name, oldValue, newValue) {
            this.light.setIntensity(newValue);
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

    return {
        PointLightComponent: PointLightComponent
    }; 
}());
