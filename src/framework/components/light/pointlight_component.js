pc.extend(pc.fw, function () {
    /**
     * @component
     * @name pc.fw.PointLightComponent
     * @constructor Create a new PointLightComponent
     * @class The Point Light Component attaches a Point Light node to the Entity
     * @param {pc.fw.PointLightComponentSystem} system The ComponentSystem that created this Component
     * @param {pc.fw.Entity} entity The Entity that this Component is attached to
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
