pc.extend(pc.scene, function () {

    /**
     * @name pc.scene.LightNode
     * @class A light.
     */
    var LightNode = function LightNode() {
        // LightNode properties (defaults)
        this._type = pc.scene.LIGHTTYPE_DIRECTIONAL;
        this._color = new pc.Color(0.8, 0.8, 0.8);
        this._intensity = 1;
        this._castShadows = false;
        this._enabled = false;

        // Point and spot properties
        this._attenuationStart = 10;
        this._attenuationEnd = 10;

        // Spot properties
        this._innerConeAngle = 40;
        this._outerConeAngle = 45;

        // Cache of light property data in a format more friendly for shader uniforms
        this._finalColor = new pc.Vec3(0.8, 0.8, 0.8);
        this._position = new pc.Vec3(0, 0, 0);
        this._direction = new pc.Vec3(0, 0, 0);
        this._innerConeAngleCos = Math.cos(this._innerConeAngle * Math.PI / 180);
        this._outerConeAngleCos = Math.cos(this._outerConeAngle * Math.PI / 180);

        // Shadow mapping resources
        this._shadowCamera = null;
        this._shadowMatrix = new pc.Mat4();
        this._shadowResolution = 1024;
        this._shadowBias = -0.0005;

        this._scene = null;
    };

    // A LightNode is a specialization of a GraphNode.  So inherit...
    LightNode = pc.inherits(LightNode, pc.scene.GraphNode);

    pc.extend(LightNode.prototype, {
        /**
         * @private
         * @function
         * @name pc.scene.LightNode#_cloneInternal
         * @description Internal function for cloning the contents of a light node. Also clones
         * the properties of the superclass GraphNode.
         * @param {pc.scene.LightNode} clone The clone that will receive the copied properties.
         */
        _cloneInternal: function (clone) {
            // Clone GraphNode properties
            LightNode._super._cloneInternal.call(this, clone);

            // Clone LightNode properties
            clone.setType(this.getType());
            clone.setColor(this.getColor());
            clone.setIntensity(this.getIntensity());
            clone.setCastShadows(this.getCastShadows());
            clone.setEnabled(this.getEnabled());

            // Point and spot properties
            clone.setAttenuationStart(this.getAttenuationStart());
            clone.setAttenuationEnd(this.getAttenuationEnd());

            // Spot properties
            clone.setInnerConeAngle(this.getInnerConeAngle());
            clone.setOuterConeAngle(this.getOuterConeAngle());

            // Shadow properties
            clone.setShadowBias(this.getShadowBias());
            clone.setShadowResolution(this.getShadowResolution());
        },

        /**
         * @function
         * @name pc.scene.LightNode#clone
         * @description Duplicates a light node but does not 'deep copy' the hierarchy.
         * @returns {pc.scene.LightNode} A cloned LightNode.
         */
        clone: function () {
            var clone = new pc.scene.LightNode();
            this._cloneInternal(clone);
            return clone;
        },

        /**
         * @function
         * @name pc.scene.LightNode#getAttenuationEnd
         * @description Queries the radius of the point or spot light. In other words, this is
         * the distance at which the light's contribution falls to zero.
         * @returns {Number} The radius of the point or spot light.
         */
        getAttenuationEnd: function () {
            return this._attenuationEnd;
        },

        /**
         * @function
         * @name pc.scene.LightNode#getAttenuationStart
         * @description Queries the distance from the point or spot light that attenuation begins.
         * @returns {Number} The radius from the light position where attenuation starts.
         */
        getAttenuationStart: function () {
            return this._attenuationStart;
        },

        /**
         * @function
         * @name pc.scene.LightNode#getCastShadows
         * @description Queries whether the light casts shadows. Dynamic lights do not
         * cast shadows by default.
         * @returns {Boolean} true if the specified light casts shadows and false otherwise.
         */
        getCastShadows: function () {
            return this._castShadows;
        },

        /**
         * @function
         * @name pc.scene.LightNode#getColor
         * @description Queries the diffuse color of the light. The PlayCanvas 'phong' shader uses this
         * value by multiplying it by the diffuse color of a mesh's material and adding it to
         * the total light contribution.
         * @returns {pc.Color} The diffuse color of the light (RGB components ranging 0..1).
         */
        getColor: function () {
            return this._color;
        },

        /**
         * @function
         * @name pc.scene.LightNode#getEnabled
         * @description Queries whether the specified light is currently enabled.
         * @returns {Boolean} true if the light is enabled and false otherwise.
         */
        getEnabled: function () {
            return this._enabled;
        },

        /**
         * @function
         * @name pc.scene.LightNode#getInnerConeAngle
         * @description Queries the inner cone angle of the specified spot light. Note
         * that this function is only valid for spotlights.
         * @returns {Number} The inner cone angle of the specified light in degrees.
         */
        getInnerConeAngle: function () {
            return this._innerConeAngle;
        },

        /**
         * @function
         * @name pc.scene.LightNode#getIntensity
         * @description Queries the intensity of the specified light.
         * @returns {Number} The intensity of the specified light.
         */
        getIntensity: function () {
            return this._intensity;
        },

        /**
         * @function
         * @name pc.scene.LightNode#getOuterConeAngle
         * @description Queries the outer cone angle of the specified spot light. Note
         * that this function is only valid for spotlights.
         * @returns {Number} The outer cone angle of the specified light in degrees.
         */
        getOuterConeAngle: function () {
            return this._outerConeAngle;
        },

        /**
         * @function
         * @name pc.scene.LightNode#getShadowBias
         * @description Queries the shadow mapping depth bias for this light. Note
         * that this function is only valid for directional lights and spotlights.
         * @returns {Number} The shadow mapping depth bias.
         */
        getShadowBias: function () {
            return this._shadowBias;
        },

        /**
         * @function
         * @name pc.scene.LightNode#getShadowResolution
         * @description Queries the shadow map pixel resolution for this light. Note
         * that this function is only valid for directional lights and spotlights.
         * @returns {Number} The shadow map resolution.
         */
        getShadowResolution: function () {
            return this._shadowResolution;
        },

        /**
         * @function
         * @name pc.scene.LightNode#getType
         * @description Queries the type of the light. The light can be a directional light,
         * a point light or a spotlight.
         * @returns {pc.scene.LightType} The type of the specified light.
         */
        getType: function () {
            return this._type;
        },

        /**
         * @function
         * @name pc.scene.LightNode#setAttenuationEnd
         * @description Specifies the radius from the light position where the light's
         * contribution falls to zero.
         * @param {number} radius The radius of influence of the light.
         */
        setAttenuationEnd: function (radius) {
            this._attenuationEnd = radius;
        },

        /**
         * @function
         * @name pc.scene.LightNode#setAttenuationStart
         * @description Specifies the radius from the light position where the light
         * contribution begins to attenuate.
         * @param {number} radius The radius at which the light begins to attenuate.
         */
        setAttenuationStart: function (radius) {
            this._attenuationStart = radius;
        },

        /**
         * @function
         * @name pc.scene.LightNode#setCastShadows
         * @description Toggles the casting of shadows from this light.
         * @param {Boolean} castShadows True to enabled shadow casting, false otherwise.
         */
        setCastShadows: function (castShadows) {
            this._castShadows = castShadows;
        },

        /**
         * @function
         * @name pc.scene.LightNode#setColor
         * @description Sets the RGB color of the light. RGB components should be
         * specified in the range 0 to 1.
         * @param {pc.Color} color The RGB color of the light.
         */
        /**
         * @function
         * @name pc.scene.LightNode#setColor^2
         * @description Sets the RGB color of the light. RGB components should be
         * specified in the range 0 to 1.
         * @param {Number} red The red component of the light color.
         * @param {Number} green The green component of the light color.
         * @param {Number} blue The blue component of the light color.
         */
        setColor: function () {
            var r, g, b;
            if (arguments.length === 1) {
                r = arguments[0].r;
                g = arguments[0].g;
                b = arguments[0].b;
            } else if (arguments.length === 3) {
                r = arguments[0];
                g = arguments[1];
                b = arguments[2];
            }

            this._color.set(r, g, b);

            // Update final color
            var i = this._intensity;
            this._finalColor.set(r * i, g * i, b * i);
        },

        /**
         * @function
         * @name pc.scene.LightNode#setEnabled
         * @description Marks the specified light as enabled or disabled.
         * @param {boolean} enable true to enable the light and false to disable it.
         */
        setEnabled: function (enable) {
            if (this._enabled !== enable) {
                this._enabled = enable;
                if (this._scene !== null) {
                    this._scene.updateShaders = true;
                }
            }
        },

        /**
         * @function
         * @name pc.scene.LightNode#setInnerConeAngle
         * @description Sets the inner cone angle of the light. Note that this
         * function only affects spotlights. The contribution of the spotlight is
         * zero outside the cone defined by this angle.
         * @param {Number} angle The inner cone angle of the spotlight in degrees.
         */
        setInnerConeAngle: function (angle) {
            this._innerConeAngle = angle;
            this._innerConeAngleCos = Math.cos(angle * Math.PI / 180);
        },

        /**
         * @function
         * @name pc.scene.LightNode#setIntensity
         * @description Sets the intensity of the light. The intensity is used to
         * scale the color of the light. Note that this makes it possible to take
         * the light color's RGB components outside the range 0 to 1.
         * @param {Number} intensity The intensity of the light.
         */
        setIntensity: function (intensity) {
            this._intensity = intensity;

            // Update final color
            var c = this._color;
            var r = c.r;
            var g = c.g;
            var b = c.b;
            var i = this._intensity;
            this._finalColor.set(r * i, g * i, b * i);
        },

        /**
         * @function
         * @name pc.scene.LightNode#setOuterConeAngle
         * @description Sets the outer cone angle of the light. Note that this
         * function only affects spotlights. The contribution of the spotlight is
         * zero outside the cone defined by this angle.
         * @param {Number} angle The outer cone angle of the spotlight in degrees.
         */
        setOuterConeAngle: function (angle) {
            this._outerConeAngle = angle;
            this._outerConeAngleCos = Math.cos(angle * Math.PI / 180);
        },

        /**
         * @function
         * @name pc.scene.LightNode#setShadowBias
         * @description Sets the depth bias for tuning the appearance of the shadow
         * mapping generated by this light.
         * @param {Number} bias The shadow mapping depth bias (defaults to -0.0005)
         */
        setShadowBias: function (bias) {
            this._shadowBias = bias;
        },

        /**
         * @function
         * @name pc.scene.LightNode#setShadowResolution
         * @description Sets the pixel width and height of the shadow map associated with this
         * light.
         * @param {Number} resolution The pixel width and height of the shadow map
         */
        setShadowResolution: function (resolution) {
            this._shadowResolution = resolution;
        },

        /**
         * @function
         * @name pc.scene.LightNode#setType
         * @description Sets the type of the light. Avialable lights types are directional,
         * point and spot.
         * @param {Number} type The light type (see pc.scene.LIGHTTYPE).
         */
        setType: function (type) {
            this._type = type;
        }
    });

    return {
        /**
         * @enum pc.gfx.LIGHTTYPE
         * @name pc.gfx.LIGHTTYPE_DIRECTIONAL
         * @description Directional (global) light source.
         */
        LIGHTTYPE_DIRECTIONAL: 0,
        /**
         * @enum pc.gfx.LIGHTTYPE
         * @name pc.gfx.LIGHTTYPE_POINT
         * @description Point (local) light source.
         */
        LIGHTTYPE_POINT: 1,
        /**
         * @enum pc.gfx.LIGHTTYPE
         * @name pc.gfx.LIGHTTYPE_SPOT
         * @description Spot (local) light source.
         */
        LIGHTTYPE_SPOT: 2,

        LightNode: LightNode
    }; 
}());