pc.extend(pc.fw, function () {
    /**
     * @component
     * @name pc.fw.DirectionalLightComponent
     * @class The Directional Light Component enables the Entity to light the scene. The light is directional 
     * only so the position of the attached entity has no effect.
     * @constructor Creates a new DirectionalLightComponent.
     * @param {pc.fw.DirectionalLightComponentSystem} system The ComponentSystem that created this Component
     * @param {pc.fw.Entity} entity The Entity that this Component is attached to.
     * @extends pc.fw.Component
     * @property {Boolean} enable Enable the light.
     * @property {pc.Color} color The color of the light.
     * @property {Number} intensity The intensity of the light.
     * @property {Boolean} castShadows Enable shadow casting from this light.
     * @property {Number} shadowResolution Resolution of the shadowmap used by this light. Must be a power of 2.
     */
    var DirectionalLightComponent = function DirectionalLightComponent(system, entity) {
        this.on("set_color", this.onSetColor, this);
        this.on("set_enable", this.onSetEnable, this);
        this.on("set_intensity", this.onSetIntensity, this);
        this.on("set_castShadows", this.onSetCastShadows, this);
        this.on("set_shadowResolution", this.onSetShadowResolution, this);
    };

    DirectionalLightComponent = pc.inherits(DirectionalLightComponent, pc.fw.Component);

    pc.extend(DirectionalLightComponent.prototype, {
        onSetCastShadows: function (name, oldValue, newValue) {
            var light = this.data.model.lights[0];
            light.setCastShadows(newValue);
        },

        onSetColor: function (name, oldValue, newValue) {
            var light = this.data.model.lights[0];
            light.setColor(newValue.c);
        },

        onSetEnable: function (name, oldValue, newValue) {
            var light = this.data.model.lights[0];
            light.setEnabled(newValue);
        },

        onSetIntensity: function (name, oldValue, newValue) {
            var light = this.data.model.lights[0];
            light.setIntensity(newValue);
        },

        onSetShadowResolution: function (name, oldValue, newValue) {
            var light = this.data.model.lights[0];
            light.setShadowResolution(newValue, newValue);
        }
    });

    return {
        DirectionalLightComponent: DirectionalLightComponent
    }; 
}());
