pc.extend(pc.fw, function () {
    /**
     * @component
     * @name pc.fw.LightComponent
     * @class The Light Component enables the Entity to light the scene. The light can be one of the 
     * following types:
     * <ul>
     * <li><strong>directional</strong>: A directional light. The position of the attached entity has no effect. </li>
     * <li><strong>point</strong>: A point light.</li>
     * <li><strong>spot</strong>: A spot light.</li>
     * </ul>
     * @constructor Creates a new LightComponent. The constructor is for internal use only. To create a new Component use {@link pc.fw.LightComponentSystem#addComponent}.
     * @param {pc.fw.LightComponentSystem} system The ComponentSystem that created this Component
     * @param {pc.fw.Entity} entity The Entity that this Component is attached to.
     * @property {String} type The type of light.
     * <ul>
     * <li><strong>directional</strong>: A light that is infinitely far away and lights the entire scene from one direction.</li>
     * <li><strong>point</strong>: A light that illuminates in all directions from a point.</li>
     * <li><strong>spot</strong>: A light that illuminates a cone.</li>
     * </ul>
     * @property {pc.fw.Color} color The Color of the light
     * @property {Boolean} enable Enable or disable the light
     * @property {Number} intensity The brightness of the light.
     * @property {Boolean} castShadows If enabled the light will cast shadows. (Not availablle for point lights)
     * @property {Number} shadowResolution The size of the texture used for the shadow map, 256, 512, 1024, 2048. (Not available for point lights)
     * @property {Number} range The range of the light. (Not available for directional lights)
     * @property {Number} innerConeAngle The angle at which the spotlight cone starts to fade off. (Only avaiable for spotlights)
     * @property {Number} outerConeAngle The angle at which the spotlight cone has faded to nothing. (Only avaiable for spotlights)
     * @extends pc.fw.Component
     */
    var LightComponent = function LightComponent(system, entity) {
        this.on("set_type", this.onSetType, this);
        this.on("set_color", this.onSetColor, this);
        this.on("set_enable", this.onSetEnable, this);
        this.on("set_intensity", this.onSetIntensity, this);
        this.on("set_castShadows", this.onSetCastShadows, this);
        this.on("set_shadowResolution", this.onSetShadowResolution, this);
        this.on("set_range", this.onSetRange, this);
        this.on("set_innerConeAngle", this.onSetInnerConeAngle, this);
        this.on("set_outerConeAngle", this.onSetOuterConeAngle, this);
    };

    LightComponent = pc.inherits(LightComponent, pc.fw.Component);

    pc.extend(LightComponent.prototype, {
        onSetType: function (name, oldValue, newValue) {
            if (oldValue !== newValue) {
                this.system.changeType(this, oldValue, newValue);

                // refresh light properties because changing the type does not reset the 
                // light properties
                this.refreshProperties();
            }
        },

        refreshProperties: function() {
            this.onSetCastShadows("castShadows", this.castShadows, this.castShadows);
            this.onSetColor("color", this.color, this.color);
            this.onSetEnable("enable", this.enable, this.enable);
            this.onSetIntensity("intensity", this.intensity, this.intensity);
            this.onSetShadowResolution("shadowResolution", this.shadowResolution, this.shadowResolution);
            this.onSetRange("range", this.range, this.range);
            this.onSetInnerConeAngle("innerConeAngle", this.innerConeAngle, this.innerConeAngle);
            this.onSetOuterConeAngle("outerConeAngle", this.outerConeAngle, this.outerConeAngle);
        },

        onSetCastShadows: function (name, oldValue, newValue) {
            if (this.data.type === 'directional' || this.data.type === 'spot') {
                var light = this.data.model.lights[0];
                light.setCastShadows(newValue);
            }
        },

        onSetColor: function (name, oldValue, newValue) {
            var light = this.data.model.lights[0];
            light.setColor(newValue);
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
            if (this.data.type === 'directional' || this.data.type === 'spot') {
                var light = this.data.model.lights[0];
                light.setShadowResolution(newValue);
            }
        },

        onSetRange: function (name, oldValue, newValue) {
            if (this.data.type === 'point' || this.data.type === 'spot') {
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