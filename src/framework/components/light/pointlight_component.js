pc.extend(pc.fw, function () {
    /**
     * @component
     * @name pc.fw.PointLightComponent
     * @class The Point Light Component attaches a Point Light node to the Entity.
     * @constructor Creates a new PointLightComponent.
     * @param {pc.fw.PointLightComponentSystem} system The ComponentSystem that created this Component.
     * @param {pc.fw.Entity} entity The Entity that this Component is attached to.
     * @property {Boolean} enable Enable the light.
     * @property {pc.Color} color The color of the light.
     * @property {Number} intensity The intensity of the light.
     * @property {Number} attenuationEnd The radius of the light at which its contribution falls to zero.
     * @extends pc.fw.Component
     */
    var PointLightComponent = function (system, entity) {
        this.on("set_attenuationEnd", this.onSetAttenuationEnd, this);
        this.on("set_color", this.onSetColor, this);
        this.on("set_enable", this.onSetEnable, this);
        this.on("set_intensity", this.onSetIntensity, this);
    };

    PointLightComponent = pc.inherits(PointLightComponent, pc.fw.Component);

    pc.extend(PointLightComponent.prototype, {
        onSetAttenuationEnd: function (name, oldValue, newValue) {
            var light = this.data.model.lights[0];
            light.setAttenuationEnd(newValue);
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
        }
    });

    return {
        PointLightComponent: PointLightComponent
    }; 
}());
