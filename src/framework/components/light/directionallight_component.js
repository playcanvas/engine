pc.extend(pc.fw, function () {
    var DirectionalLightComponent = function DirectionalLightComponent(entity) {
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

    DirectionalLightComponent = pc.inherits(DirectionalLightComponent, pc.fw.Component);

    pc.extend(DirectionalLightComponent.prototype, {
        onSetCastShadows: function (name, oldValue, newValue) {
            if (newValue !== undefined) {
                this.data.light.setCastShadows(newValue);
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
                this.data.light.setColor(color);
            }
        },

        onSetEnable: function (name, oldValue, newValue) {
            if (newValue !== undefined) {
                this.data.light.setEnabled(newValue);
            }
        },

        onSetIntensity: function (name, oldValue, newValue) {
            if (newValue !== undefined) {
                this.data.light.setIntensity(newValue);
            }
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
        DirectionalLightComponent: DirectionalLightComponent,
    }; 
}());
