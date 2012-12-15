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
    };

    PointLightComponent = pc.inherits(PointLightComponent, pc.fw.Component);

    pc.extend(PointLightComponent.prototype, {
        onSetAttenuationEnd: function (name, oldValue, newValue) {
            var light = this.data.model.lights[0];
            light.setAttenuationEnd(newValue);
        },

        onSetCastShadows: function (name, oldValue, newValue) {
            var light = this.data.model.lights[0];
            light.setCastShadows(newValue);
        },

        onSetColor: function (name, oldValue, newValue) {
            var rgb = parseInt(newValue);
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
