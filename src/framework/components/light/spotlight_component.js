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
        this.on("set_attenuationEnd", this.onSetAttenuationEnd, this);
        this.on("set_castShadows", this.onSetCastShadows, this);
        this.on("set_color", this.onSetColor, this);
        this.on("set_enable", this.onSetEnable, this);
        this.on("set_innerConeAngle", this.onSetInnerConeAngle, this);
        this.on("set_intensity", this.onSetIntensity, this);
        this.on("set_outerConeAngle", this.onSetOuterConeAngle, this);
        this.on("set_shadowResolution", this.onSetShadowResolution, this);
    };
    SpotLightComponent = pc.inherits(SpotLightComponent, pc.fw.Component);

    pc.extend(SpotLightComponent.prototype, {
        onSetAttenuationEnd: function (name, oldValue, newValue) {
            var light = this.data.model.lights[0];
            light.setAttenuationEnd(newValue);
        },

        onSetColor: function (name, oldValue, newValue) {
            var rgb = parseInt(newValue, 16);
            rgb = pc.math.intToBytes24(rgb);
            var color = [
                rgb[0] / 255,
                rgb[1] / 255,
                rgb[2] / 255
            ];
            var light = this.data.model.lights[0];
            light.setColor(color);
        },

        onSetInnerConeAngle: function (name, oldValue, newValue) {
            var light = this.data.model.lights[0];
            light.setInnerConeAngle(newValue);
        },

        onSetOuterConeAngle: function (name, oldValue, newValue) {
            var light = this.data.model.lights[0];
            light.setOuterConeAngle(newValue);
        },

        onSetEnable: function (name, oldValue, newValue) {
            var light = this.data.model.lights[0];
            light.setEnabled(newValue);
        },

        onSetIntensity: function (name, oldValue, newValue) {
            var light = this.data.model.lights[0];
            light.setIntensity(newValue);
        },

        onSetCastShadows: function (name, oldValue, newValue) {
            var light = this.data.model.lights[0];
            light.setCastShadows(newValue);
        },

        onSetShadowResolution: function (name, oldValue, newValue) {
            var light = this.data.model.lights[0];
            light.setShadowResolution(newValue, newValue);
        }
    });
    return {
        SpotLightComponent: SpotLightComponent
    }; 
}());
