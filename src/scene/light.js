pc.extend(pc, function () {

    var spotCenter = new pc.Vec3();
    var spotEndPoint = new pc.Vec3();
    var tmpVec = new pc.Vec3();

    var chanId = {r:0, g:1, b:2, a:3};

    /**
     * @private
     * @name pc.Light
     * @class A light.
     */
    var Light = function Light() {
        // Light properties (defaults)
        this._type = pc.LIGHTTYPE_DIRECTIONAL;
        this._color = new pc.Color(0.8, 0.8, 0.8);
        this._intensity = 1;
        this._castShadows = false;
        this._enabled = false;
        this.mask = 1;
        this.isStatic = false;
        this.key = 0;
        this.bakeDir = true;

        // Point and spot properties
        this._attenuationStart = 10;
        this._attenuationEnd = 10;
        this._falloffMode = 0;
        this._shadowType = pc.SHADOW_DEPTH;
        this._vsmBlurSize = 11;
        this._vsmBlurMode = pc.BLUR_GAUSSIAN;
        this._vsmBias = 0.01 * 0.25;
        this._cookie = null; // light cookie texture (2D for spot, cubemap for point)
        this._cookieIntensity = 1;
        this._cookieFalloff = true;
        this._cookieChannel = "rgb";
        this._cookieTransform = null; // 2d rotation/scale matrix (spot only)
        this._cookieOffset = null; // 2d position offset (spot only)
        this._cookieTransformSet = false;
        this._cookieOffsetSet = false;

        // Spot properties
        this._innerConeAngle = 40;
        this._outerConeAngle = 45;

        // Cache of light property data in a format more friendly for shader uniforms
        this._finalColor = new pc.Vec3(0.8, 0.8, 0.8);
        this._linearFinalColor = new pc.Vec3();
        this._position = new pc.Vec3(0, 0, 0);
        this._direction = new pc.Vec3(0, 0, 0);
        this._innerConeAngleCos = Math.cos(this._innerConeAngle * Math.PI / 180);
        this._outerConeAngleCos = Math.cos(this._outerConeAngle * Math.PI / 180);

        // Shadow mapping resources
        this._shadowCamera = null;
        this._shadowMatrix = new pc.Mat4();
        this._shadowDistance = 40;
        this._shadowResolution = 1024;
        this._shadowBias = -0.0005;
        this._normalOffsetBias = 0.0;
        this.shadowUpdateMode = pc.SHADOWUPDATE_REALTIME;

        this._scene = null;
        this._node = null;
        this._rendererParams = [];
    };

    Light.prototype = {
        /**
         * @private
         * @function
         * @name pc.Light#clone
         * @description Duplicates a light node but does not 'deep copy' the hierarchy.
         * @returns {pc.Light} A cloned Light.
         */
        clone: function () {
            var clone = new pc.Light();

            // Clone Light properties
            clone.setType(this.getType());
            clone.setColor(this.getColor());
            clone.setIntensity(this.getIntensity());
            clone.setCastShadows(this.getCastShadows());
            clone.setEnabled(this.getEnabled());

            // Point and spot properties
            clone.setAttenuationStart(this.getAttenuationStart());
            clone.setAttenuationEnd(this.getAttenuationEnd());
            clone.setFalloffMode(this.getFalloffMode());
            clone.setShadowType(this.getShadowType());
            clone.setVsmBlurSize(this.getVsmBlurSize());
            clone.setVsmBlurMode(this.getVsmBlurMode());
            clone.setVsmBias(this.getVsmBias());
            clone.shadowUpdateMode = this.shadowUpdateMode;
            clone.mask = this.mask;

            // Spot properties
            clone.setInnerConeAngle(this.getInnerConeAngle());
            clone.setOuterConeAngle(this.getOuterConeAngle());

            // Shadow properties
            clone.setShadowBias(this.getShadowBias());
            clone.setNormalOffsetBias(this.getNormalOffsetBias());
            clone.setShadowResolution(this.getShadowResolution());
            clone.setShadowDistance(this.getShadowDistance());

            return clone;
        },

        /**
         * @private
         * @function
         * @name pc.Light#getAttenuationEnd
         * @description Queries the radius of the point or spot light. In other words, this is
         * the distance at which the light's contribution falls to zero.
         * @returns {Number} The radius of the point or spot light.
         */
        getAttenuationEnd: function () {
            return this._attenuationEnd;
        },

        /**
         * @private
         * @function
         * @name pc.Light#getAttenuationStart
         * @description Queries the distance from the point or spot light that attenuation begins.
         * @returns {Number} The radius from the light position where attenuation starts.
         */
        getAttenuationStart: function () {
            return this._attenuationStart;
        },

        getFalloffMode: function () {
            return this._falloffMode;
        },

        getShadowType: function () {
            return this._shadowType;
        },

        getVsmBlurSize: function () {
            return this._vsmBlurSize;
        },

        getVsmBlurMode: function () {
            return this._vsmBlurMode;
        },

        getVsmBias: function () {
            return this._vsmBias;
        },

        getCookie: function () {
            return this._cookie;
        },

        getCookieIntensity: function () {
            return this._cookieIntensity;
        },

        getCookieFalloff: function () {
            return this._cookieFalloff;
        },

        getCookieChannel: function () {
            return this._cookieChannel;
        },

        getCookieTransform: function () {
            return this._cookieTransform;
        },

        getCookieOffset: function () {
            return this._cookieOffset;
        },

        /**
         * @private
         * @function
         * @name pc.Light#getCastShadows
         * @description Queries whether the light casts shadows. Dynamic lights do not
         * cast shadows by default.
         * @returns {Boolean} true if the specified light casts shadows and false otherwise.
         */
        getCastShadows: function () {
            return this._castShadows && this.mask!==pc.MASK_LIGHTMAP && this.mask!==0;
        },

        /**
         * @private
         * @function
         * @name pc.Light#getColor
         * @description Queries the diffuse color of the light. The PlayCanvas 'standard' shader uses this
         * value by multiplying it by the diffuse color of a mesh's material and adding it to
         * the total light contribution.
         * @returns {pc.Color} The diffuse color of the light (RGB components ranging 0..1).
         */
        getColor: function () {
            return this._color;
        },

        /**
         * @private
         * @function
         * @name pc.Light#getEnabled
         * @description Queries whether the specified light is currently enabled.
         * @returns {Boolean} true if the light is enabled and false otherwise.
         */
        getEnabled: function () {
            return this._enabled;
        },

        /**
         * @private
         * @function
         * @name pc.Light#getInnerConeAngle
         * @description Queries the inner cone angle of the specified spot light. Note
         * that this function is only valid for spotlights.
         * @returns {Number} The inner cone angle of the specified light in degrees.
         */
        getInnerConeAngle: function () {
            return this._innerConeAngle;
        },

        /**
         * @private
         * @function
         * @name pc.Light#getIntensity
         * @description Queries the intensity of the specified light.
         * @returns {Number} The intensity of the specified light.
         */
        getIntensity: function () {
            return this._intensity;
        },

        /**
         * @private
         * @function
         * @name pc.Light#getOuterConeAngle
         * @description Queries the outer cone angle of the specified spot light. Note
         * that this function is only valid for spotlights.
         * @returns {Number} The outer cone angle of the specified light in degrees.
         */
        getOuterConeAngle: function () {
            return this._outerConeAngle;
        },

        /**
         * @private
         * @function
         * @name pc.Light#getShadowBias
         * @description Queries the shadow mapping depth bias for this light. Note
         * that this function is only valid for directional lights and spotlights.
         * @returns {Number} The shadow mapping depth bias.
         */
        getShadowBias: function () {
            return this._shadowBias;
        },

        getNormalOffsetBias: function () {
            return this._normalOffsetBias;
        },

        /**
         * @private
         * @function
         * @name pc.Light#getShadowDistance
         * @description Queries the distance in camera Z at which shadows will no
         * longer be rendered. Note that this function is only valid for directional
         * lights.
         * @returns {Number} The shadow distance in world units.
         */
        getShadowDistance: function () {
            return this._shadowDistance;
        },

        /**
         * @private
         * @function
         * @name pc.Light#getShadowResolution
         * @description Queries the shadow map pixel resolution for this light.
         * @returns {Number} The shadow map resolution.
         */
        getShadowResolution: function () {
            return this._shadowResolution;
        },

        /**
         * @private
         * @function
         * @name pc.Light#getType
         * @description Queries the type of the light. The light can be a directional light,
         * a point light or a spotlight.
         * @returns {pc.LightType} The type of the specified light.
         */
        getType: function () {
            return this._type;
        },

        /**
         * @private
         * @function
         * @name pc.Light#setAttenuationEnd
         * @description Specifies the radius from the light position where the light's
         * contribution falls to zero.
         * @param {Number} radius The radius of influence of the light.
         */
        setAttenuationEnd: function (radius) {
            this._attenuationEnd = radius;
        },

        /**
         * @private
         * @function
         * @name pc.Light#setAttenuationStart
         * @description Specifies the radius from the light position where the light
         * contribution begins to attenuate.
         * @param {Number} radius The radius at which the light begins to attenuate.
         */
        setAttenuationStart: function (radius) {
            this._attenuationStart = radius;
        },

        setFalloffMode: function (mode) {
            this._falloffMode = mode;
            if (this._scene !== null) {
                this._scene.updateShaders = true;
            }
            this.updateKey();
        },

        setShadowType: function (mode) {
            var device = pc.Application.getApplication().graphicsDevice;

            if (this._type===pc.LIGHTTYPE_POINT) {
                mode = pc.SHADOW_DEPTH; // VSM for point lights is not supported yet
            }

            if (mode===pc.SHADOW_VSM32 && !device.extTextureFloatRenderable) {
                mode = pc.SHADOW_VSM16;
            }
            if (mode===pc.SHADOW_VSM16 && !device.extTextureHalfFloatRenderable) {
                mode = pc.SHADOW_VSM8;
            }

            this._shadowType = mode;
            this._destroyShadowMap();
            if (this._scene !== null) {
                this._scene.updateShaders = true;
            }
            this.updateKey();
        },

        setVsmBlurSize: function (size) {
            if (size % 2 === 0) size++; // don't allow even sizes
            this._vsmBlurSize = size;
        },

        setVsmBlurMode: function (mode) {
            this._vsmBlurMode = mode;
        },

        setVsmBias: function (mode) {
            this._vsmBias = mode;
        },

        setCookie: function (tex) {
            this._cookie = tex;
            if (this._scene !== null) {
                this._scene.updateShaders = true;
            }
            this.updateKey();
        },

        setCookieIntensity: function (value) {
            this._cookieIntensity = value;
        },

        setCookieFalloff: function (value) {
            this._cookieFalloff = value;
            if (this._scene !== null) {
                this._scene.updateShaders = true;
            }
            this.updateKey();
        },

        setCookieChannel: function (value) {
            if (value.length < 3) {
                var chr = value.charAt(value.length - 1);
                var addLen = 3 - value.length;
                for (var i = 0; i < addLen; i++) value += chr;
            }
            this._cookieChannel = value;
            if (this._scene !== null) {
                this._scene.updateShaders = true;
            }
            this.updateKey();
        },

        setCookieTransform: function (value) {
            var xformOld = !!(this._cookieTransformSet || this._cookieOffsetSet);
            var xformNew = !!(value || this._cookieOffsetSet);
            if (xformOld!==xformNew) {
                if (this._scene !== null) {
                    this._scene.updateShaders = true;
                }
            }
            this._cookieTransform = value;
            this._cookieTransformSet = !!value;
            if (value && !this._cookieOffset) {
                this.setCookieOffset(new pc.Vec2()); // using transform forces using offset code
                this._cookieOffsetSet = false;
            }
            this.updateKey();
        },

        setCookieOffset: function (value) {
            var xformOld = !!(this._cookieTransformSet || this._cookieOffsetSet);
            var xformNew = !!(this._cookieTransformSet || value);
            if (xformOld!==xformNew) {
                if (this._scene !== null) {
                    this._scene.updateShaders = true;
                }
            }
            if (xformNew && !value && this._cookieOffset) {
                this._cookieOffset.set(0,0);
            } else {
                this._cookieOffset = value;
            }
            this._cookieOffsetSet = !!value;
            if (value && !this._cookieTransform) {
                this.setCookieTransform(new pc.Vec4(1,1,0,0)); // using offset forces using matrix code
                this._cookieTransformSet = false;
            }
            this.updateKey();
        },

        setMask: function (_mask) {
            this.mask = _mask;
            if (this._scene !== null) {
                this._scene.updateShaders = true;
            }
        },

        getBoundingSphere: function (sphere) {
            if (this._type===pc.LIGHTTYPE_SPOT) {
                var range = this._attenuationEnd;
                var angle = this._outerConeAngle;
                var f = Math.cos(angle * pc.math.DEG_TO_RAD);
                var node = this._node;

                spotCenter.copy(node.up);
                spotCenter.scale(-range*0.5*f);
                spotCenter.add(node.getPosition());
                sphere.center = spotCenter;

                spotEndPoint.copy(node.up);
                spotEndPoint.scale(-range);

                tmpVec.copy(node.right);
                tmpVec.scale(Math.sin(angle * pc.math.DEG_TO_RAD) * range);
                spotEndPoint.add(tmpVec);

                sphere.radius = spotEndPoint.length() * 0.5;

            } else if (this._type===pc.LIGHTTYPE_POINT) {
                sphere.center = this._node.getPosition();
                sphere.radius = this._attenuationEnd;
            }
        },

        getBoundingBox: function (box) {
            if (this._type===pc.LIGHTTYPE_SPOT) {
                var range = this._attenuationEnd;
                var angle = this._outerConeAngle;
                var node = this._node;

                var scl = Math.abs( Math.sin(angle * pc.math.DEG_TO_RAD) * range );

                box.center.set(0, -range*0.5, 0);
                box.halfExtents.set(scl, range*0.5, scl);

                box.setFromTransformedAabb(box, node.getWorldTransform());

            } else if (this._type===pc.LIGHTTYPE_POINT) {
                box.center.copy(this._node.getPosition());
                box.halfExtents.set(this._attenuationEnd, this._attenuationEnd, this._attenuationEnd);
            }
        },

        /**
         * @private
         * @function
         * @name pc.Light#setCastShadows
         * @description Toggles the casting of shadows from this light.
         * @param {Boolean} castShadows True to enabled shadow casting, false otherwise.
         */
        setCastShadows: function (castShadows) {
            this._castShadows = castShadows;
            if (this._scene !== null) {
                this._scene.updateShaders = true;
            }
            this.updateKey();
        },

        /**
         * @private
         * @function
         * @name pc.Light#setColor
         * @description Sets the RGB color of the light. RGB components should be
         * specified in the range 0 to 1.
         * @param {pc.Color} color The RGB color of the light.
         */
        /**
         * @private
         * @function
         * @name pc.Light#setColor^2
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
            for(var c=0; c<3; c++) {
                if (i >= 1) {
                    this._linearFinalColor.data[c] = Math.pow(this._finalColor.data[c] / i, 2.2) * i;
                } else {
                    this._linearFinalColor.data[c] = Math.pow(this._finalColor.data[c], 2.2);
                }
            }
        },

        /**
         * @private
         * @function
         * @name pc.Light#setEnabled
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
         * @private
         * @function
         * @name pc.Light#setInnerConeAngle
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
         * @private
         * @function
         * @name pc.Light#setIntensity
         * @description Sets the intensity of the light. The intensity is used to
         * scale the color of the light. Note that this makes it possible to take
         * the light color's RGB components outside the range 0 to 1.
         * @param {Number} intensity The intensity of the light.
         */
        setIntensity: function (intensity) {
            this._intensity = intensity;

            // Update final color
            var c = this._color.data;
            var r = c[0];
            var g = c[1];
            var b = c[2];
            var i = this._intensity;
            this._finalColor.set(r * i, g * i, b * i);
            for(var j = 0; j < 3; j++) {
                if (i >= 1) {
                    this._linearFinalColor.data[j] = Math.pow(this._finalColor.data[j] / i, 2.2) * i;
                } else {
                    this._linearFinalColor.data[j] = Math.pow(this._finalColor.data[j], 2.2);
                }
            }
        },

        /**
         * @private
         * @function
         * @name pc.Light#setOuterConeAngle
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
         * @private
         * @function
         * @name pc.Light#setShadowBias
         * @description Sets the depth bias for tuning the appearance of the shadow
         * mapping generated by this light.
         * @param {Number} bias The shadow mapping depth bias (defaults to -0.0005)
         */
        setShadowBias: function (bias) {
            this._shadowBias = bias;
        },

        setNormalOffsetBias: function (bias) {
            if ((!this._normalOffsetBias && bias) || (this._normalOffsetBias && !bias)) {
                if (this._scene !== null) {
                    this._scene.updateShaders = true;
                }
                this.updateKey();
            }
            this._normalOffsetBias = bias;
        },

        /**
         * @private
         * @function
         * @name pc.Light#setShadowDistance
         * @description Sets the distance in camera Z at which the shadows cast by this
         * light are no longer rendered. Note that this function only applies to directional
         * lights.
         * @param {Number} distance The shadow distance in world units
         */
        setShadowDistance: function (distance) {
            this._shadowDistance = distance;
        },

        /**
         * @private
         * @function
         * @name pc.Light#setShadowResolution
         * @description Sets the pixel width and height of the shadow map associated with this
         * light.
         * @param {Number} resolution The pixel width and height of the shadow map
         */
        setShadowResolution: function (resolution) {
            var device = pc.Application.getApplication().graphicsDevice;
            if (this._type===pc.LIGHTTYPE_POINT) {
                resolution = Math.min(resolution, device.maxCubeMapSize);
            } else {
                resolution = Math.min(resolution, device.maxTextureSize);
            }
            this._shadowResolution = resolution;
        },

        /**
         * @private
         * @function
         * @name pc.Light#setType
         * @description Sets the type of the light. Avialable lights types are directional,
         * point and spot.
         * @param {Number} type The light type (see pc.LIGHTTYPE).
         */
        setType: function (type) {
            this._type = type;
            this._destroyShadowMap();
            if (this._scene !== null) {
                this._scene.updateShaders = true;
            }
            this.updateKey();
        },

        _destroyShadowMap: function () {
            if (this._shadowCamera) {
                var rt = this._shadowCamera._renderTarget;
                var i;
                if (rt) {
                    if (rt.length) {
                        for(i=0; i<rt.length; i++) {
                            if (rt[i].colorBuffer) rt[i].colorBuffer.destroy();
                            rt[i].destroy();
                        }
                    } else {
                        if (rt.colorBuffer) rt.colorBuffer.destroy();
                        rt.destroy();
                    }
                }
                this._shadowCamera._renderTarget = null;
                this._shadowCamera = null;
                this._shadowCubeMap = null;
                if (this.shadowUpdateMode===pc.SHADOWUPDATE_NONE) {
                    this.shadowUpdateMode = pc.SHADOWUPDATE_THISFRAME;
                }
            }
        },

        updateShadow: function() {
            if (this.shadowUpdateMode!==pc.SHADOWUPDATE_REALTIME) {
                this.shadowUpdateMode = pc.SHADOWUPDATE_THISFRAME;
            }
        },

        updateKey: function() {
            // Key definition:
            // Bit
            // 31      : sign bit (leave)
            // 29 - 30 : type
            // 28      : cast shadows
            // 25 - 27 : shadow type
            // 23 - 24 : falloff mode
            // 22      : normal offset bias
            // 21      : cookie
            // 20      : cookie falloff
            // 18 - 19 : cookie channel R
            // 16 - 17 : cookie channel G
            // 14 - 15 : cookie channel B
            // 12      : cookie transform
            var key = (this._type << 29) |
                   ((this._castShadows? 1 : 0)                  << 28) |
                   (this._shadowType                            << 25) |
                   (this._falloffMode                           << 23) |
                   ((this._normalOffsetBias!==0.0? 1 : 0)       << 22) |
                   ((this._cookie? 1 : 0)                       << 21) |
                   ((this._cookieFalloff? 1 : 0)                << 20) |
                   (chanId[this._cookieChannel.charAt(0)]       << 18) |
                   ((this._cookieTransform? 1 : 0)              << 12);

            if (this._cookieChannel.length===3) {
                key |= (chanId[this._cookieChannel.charAt(1)]   << 16);
                key |= (chanId[this._cookieChannel.charAt(2)]   << 14);
            }

            this.key = key;
        }
    };

    return {
        Light: Light
    };
}());
