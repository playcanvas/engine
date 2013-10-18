pc.extend(pc.fw, function () {
    /**
     * @private
     * @component
     * @name pc.fw.LightComponent
     * @class The Light Component enables the Entity to light the scene. The light can be one of the 
     * following types:
     * <ul>
     * <li><strong>directional</strong>: A directional light. The position of the attached entity has no effect. </li>
     * <li><strong>point</strong>: A point light.</li>
     * <li><strong>spot</strong>: A spot light.</li>
     * </ul>
     * @constructor Creates a new LightComponent.
     * @param {pc.fw.DirectionalLightComponentSystem} system The ComponentSystem that created this Component
     * @param {pc.fw.Entity} entity The Entity that this Component is attached to.
     * @extends pc.fw.Component
     */
    var LightComponent = function LightComponent(system, entity) {
        this.on("set_type", this.onSetType, this);
        this.on("set_color", this.onSetColor, this);
        this.on("set_enable", this.onSetEnable, this);
        this.on("set_intensity", this.onSetIntensity, this);
        this.on("set_castShadows", this.onSetCastShadows, this);
        this.on("set_shadowResolution", this.onSetShadowResolution, this);
        this.on("set_attenuationEnd", this.onSetAttenuationEnd, this);
        this.on("set_innerConeAngle", this.onSetInnerConeAngle, this);
        this.on("set_outerConeAngle", this.onSetOuterConeAngle, this);
    };

    LightComponent = pc.inherits(LightComponent, pc.fw.Component);

    pc.extend(LightComponent.prototype, {
        onSetType: function (name, oldValue, newValue) {
            if (oldValue !== newValue) {
                this.system.changeType(this, oldValue, newValue);

                // re-enable the light because it is disabled by default
                var light = this.data.model.lights[0];
                light.setEnabled(this.data.enable);
            }
        },

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
        },

        onSetAttenuationEnd: function (name, oldValue, newValue) {
            if (this.data.type === 'point' || this.data.point === 'spot') {
                var light = this.data.model.lights[0];
                light.setAttenuationEnd(newValue);
            }
        }, 

        onSetInnerConeAngle: function (name, oldValue, newValue) {
            if (this.data.type === 'spot') {
                var light = this.data.model.lights[0];
                light.setInnerConeAngle(newValue);
            }
        },

        onSetOuterConeAngle: function (name, oldValue, newValue) {
            if (this.data.type === 'spot') {
                var light = this.data.model.lights[0];
                light.setOuterConeAngle(newValue);
            }
        }
    });

    return {
        LightComponent: LightComponent
    }; 
}());