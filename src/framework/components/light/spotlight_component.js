pc.extend(pc.fw, function () {
    /**
     * @component
     * @name pc.fw.SpotLightComponent
     * @constructor Create a new SpotLightComponent
     * @class A Light Component is used to dynamically light the scene.
     * @param {pc.fw.SpotlightComponentSystem} system The ComponentSystem that created this Component
     * @param {pc.fw.Entity} entity The Entity that this Component is attached to.
     * @property {Boolean} enable Enable the light.
     * @property {pc.Color} color The color of the light.
     * @property {Number} intensity The intensity of the light.
     * @property {Number} attenuationEnd The radius of the light at which its contribution falls to zero.
     * @property {Number} innerConeAngle The angle between the directional axis of the spotlight and the side
     * of a cone beyond which light begins to fall off from the specified intensity.
     * @property {Number} outerConeAngle The angle between the directional axis of the spotlight and the side
     * of a cone where the light's contribution falls off to zero.
     * @property {Boolean} castShadows Enable shadow casting from this light.
     * @property {Number} shadowResolution Resolution of the shadowmap used by this light. Must be a power of 2.
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
            var light = this.data.model.lights[0];
            light.setColor(newValue.c);
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
