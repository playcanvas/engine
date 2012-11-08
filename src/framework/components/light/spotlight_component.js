pc.extend(pc.fw, function () {
    /**
     * @component
     * @name pc.fw.SpotLightComponent
     * @constructor Create a new SpotLightComponent
     * @class A Light Component is used to dynamically light the scene.
    * @param {pc.fw.SpotlightComponentSystem} system The ComponentSystem that created this Component
    * @param {pc.fw.Entity} entity The Entity that this Component is attached to.
     * @extends pc.fw.Component
     */
    var SpotLightComponent = function (system, entity) {

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
    return {
        SpotLightComponent: SpotLightComponent
    }; 
}());
