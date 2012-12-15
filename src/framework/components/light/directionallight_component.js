pc.extend(pc.fw, function () {
    /**
    * @component
    * @name pc.fw.DirectionalLightComponent
    * @class The Directional Light Component enables the Entity to light the scene. The light is directional only so the position of the Entity has no effect.
    * @param {pc.fw.DirectionalLightComponentSystem} system The ComponentSystem that created this Component
    * @param {pc.fw.Entity} entity The Entity that this Component is attached to.
    * @extends pc.fw.Component
    * @property {Boolean} enable Enable the light.
    * @property {String} color The color of the light
    * @property {Number} intensity The intensity of the light
    * @property {Boolean} castShadows Enable shadow casting from this light
    */
    var DirectionalLightComponent = function DirectionalLightComponent(system, entity) {
        // Handle changes to the 'castShadows' value
        this.bind("set_castShadows", this.onSetCastShadows.bind(this));
        // Handle changes to the 'color' value
        this.bind("set_color", this.onSetColor.bind(this));
        // Handle changes to the 'enable' value
        this.bind("set_enable", this.onSetEnable.bind(this));
        // Handle changes to the 'intensity' value
        this.bind("set_intensity", this.onSetIntensity.bind(this));
    };

    DirectionalLightComponent = pc.inherits(DirectionalLightComponent, pc.fw.Component);

    pc.extend(DirectionalLightComponent.prototype, {
        onSetCastShadows: function (name, oldValue, newValue) {
            if (newValue !== undefined) {
                var light = this.data.model.lights[0];
                light.setCastShadows(newValue);
            }
        },
        
        onSetColor: function (name, oldValue, newValue) {
            if (newValue) {
                var rgb = parseInt(newValue);
                rgb = pc.math.intToBytes24(rgb);
                var color = [
                    rgb[0] / 255,
                    rgb[1] / 255,
                    rgb[2] / 255
                ];
                var light = this.data.model.lights[0];
                light.setColor(color);
            }
        },

        onSetEnable: function (name, oldValue, newValue) {
            if (newValue !== undefined) {
                var light = this.data.model.lights[0];
                light.setEnabled(newValue);
            }
        },

        onSetIntensity: function (name, oldValue, newValue) {
            if (newValue !== undefined) {
                var light = this.data.model.lights[0];
                light.setIntensity(newValue);
            }
        }
    });

    return {
        DirectionalLightComponent: DirectionalLightComponent,
    }; 
}());
