/**
 * Constants for light type.
 * @enum {number}
 */
pc.scene.LightType = {
    /** Directional (global) light source. */
    DIRECTIONAL: 0,
    /** Point (local) light source. */
    POINT: 1,
    /** Spot (local) light source. */
    SPOT: 2
};

pc.extend(pc.scene, function () {

    /**
     * @name pc.scene.LightNode
     * @class A light.
     */
    var LightNode = function LightNode() {
        // LightNode properties (defaults)
        this._type = pc.scene.LightType.DIRECTIONAL;
        this._color = pc.math.vec3.create(0.8, 0.8, 0.8);
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
        this._finalColor = pc.math.vec3.create(0.8, 0.8, 0.8);
        this._position = [];
        this._direction = [];
        this._innerConeAngleCos = Math.cos(this._innerConeAngle * Math.PI / 180);
        this._outerConeAngleCos = Math.cos(this._outerConeAngle * Math.PI / 180);

        // Shadow mapping resources
        this._shadowCamera = null;
        this._shadowMatrix = pc.math.mat4.create();
        this._shadowWidth = 1024;
        this._shadowHeight = 1024;
        this._shadowBias = -0.0005;
    };
    LightNode = pc.inherits(LightNode, pc.scene.GraphNode);

    /**
     * @private
     * @function
     * @name pc.scene.LightNode#_cloneInternal
     * @description Internal function for cloning the contents of a light node. Also clones
     * the properties of the superclass GraphNode.
     * @param {pc.scene.LightNode} clone The clone that will receive the copied properties.
     */
    LightNode.prototype._cloneInternal = function (clone) {
        // Clone GraphNode properties
        LightNode._super._cloneInternal.call(this, clone);

        // Clone LightNode properties
        clone.setType(this.getType());
        clone.setColor(pc.math.vec3.clone(this.getColor()));
        clone.setIntensity(this.getIntensity());
        clone.setCastShadows(this.getCastShadows());
        clone.setEnabled(this.getEnabled());

        // Point and spot properties
        clone.setAttenuationStart(this.getAttenuationStart());
        clone.setAttenuationEnd(this.getAttenuationEnd());

        // Spot properties
        clone.setInnerConeAngle(this.getInnerConeAngle());
        clone.setOuterConeAngle(this.getOuterConeAngle());
    };

    /**
     * @function
     * @name pc.scene.LightNode#clone
     * @description Duplicates a light node but does not 'deep copy' the hierarchy.
     * @returns {pc.scene.LightNode} A cloned LightNode.
     * @author Will Eastcott
     */
    LightNode.prototype.clone = function () {
        var clone = new pc.scene.LightNode();
        this._cloneInternal(clone);
        return clone;
    };

    /**
     * @function
     * @name pc.scene.LightNode#getAttenuationEnd
     * @description Queries the radius of the point or spot light. In other words, this is
     * the distance at which the light's contribution falls to zero.
     * @returns {Number} The radius of the point or spot light.
     * @author Will Eastcott
     */
    LightNode.prototype.getAttenuationEnd = function () {
        return this._attenuationEnd;
    };

    /**
     * @function
     * @name pc.scene.LightNode#getAttenuationStart
     * @description Queries the distance from the point or spot light that attenuation begins.
     * @returns {Number} The radius from the light position where attenuation starts.
     * @author Will Eastcott
     */
    LightNode.prototype.getAttenuationStart = function () {
        return this._attenuationStart;
    };

    /**
     * @function
     * @name pc.scene.LightNode#getCastShadows
     * @description Queries whether the light casts shadows. Dynamic lights do not
     * cast shadows by default.
     * @returns {Boolean} true if the specified light casts shadows and false otherwise.
     * @author Will Eastcott
     */
    LightNode.prototype.getCastShadows = function () {
        return this._castShadows;
    };

    /**
     * @function
     * @name pc.scene.LightNode#getColor
     * @description Queries the diffuse color of the light. The PlayCanvas 'phong' shader uses this
     * value by multiplying it by the diffuse color of a mesh's material and adding it to
     * the total light contribution.
     * @returns {Array} The diffuse color of the light, represented by a 3 dimensional array (RGB components ranging 0..1).
     * @author Will Eastcott
     */
    LightNode.prototype.getColor = function () {
        return this._color;
    };

    /**
     * @function
     * @name pc.scene.LightNode#getEnabled
     * @description Queries whether the specified light is currently enabled.
     * @returns {Boolean} true if the light is enabled and false otherwise.
     * @author Will Eastcott
     */
    LightNode.prototype.getEnabled = function () {
        return this._enabled;
    };

    /**
     * @function
     * @name pc.scene.LightNode#getInnerConeAngle
     * @description Queries the inner cone angle of the specified spot light. Note
     * that this function is only valid for spotlights.
     * @returns {Number} The inner cone angle of the specified light in degrees.
     * @author Will Eastcott
     */
    LightNode.prototype.getInnerConeAngle = function () {
        return this._innerConeAngle;
    };

    /**
     * @function
     * @name pc.scene.LightNode#getIntensity
     * @description Queries the intensity of the specified light.
     * @returns {Number} The intensity of the specified light.
     * @author Will Eastcott
     */
    LightNode.prototype.getIntensity = function () {
        return this._intensity;
    };

    /**
     * @function
     * @name pc.scene.LightNode#getOuterConeAngle
     * @description Queries the outer cone angle of the specified spot light. Note
     * that this function is only valid for spotlights.
     * @returns {Number} The outer cone angle of the specified light in degrees.
     * @author Will Eastcott
     */
    LightNode.prototype.getOuterConeAngle = function () {
        return this._outerConeAngle;
    };

    /**
     * @function
     * @name pc.scene.LightNode#getType
     * @description Queries the type of the light. The light can be a directional light,
     * a point light or a spotlight.
     * @returns {pc.scene.LightType} The type of the specified light.
     * @author Will Eastcott
     */
    LightNode.prototype.getType = function () {
        return this._type;
    };

    /**
     * @function
     * @name pc.scene.LightNode#setAttenuationEnd
     * @description Specifies the radius from the light position where the light's
     * contribution falls to zero.
     * @param {number} radius The radius of influence of the light.
     * @author Will Eastcott
     */
    LightNode.prototype.setAttenuationEnd = function (radius) {
        this._attenuationEnd = radius;
    };

    /**
     * @function
     * @name pc.scene.LightNode#setAttenuationStart
     * @description Specifies the radius from the light position where the light
     * contribution begins to attenuate.
     * @param {number} radius The radius at which the light begins to attenuate.
     * @author Will Eastcott
     */
    LightNode.prototype.setAttenuationStart = function (radius) {
        this._attenuationStart = radius;
    };

    LightNode.prototype._createShadowMap = function () {
        var shadowBuffer = new pc.gfx.FrameBuffer(this._shadowWidth, this._shadowHeight, true);

        var shadowTexture = shadowBuffer.getTexture();
        shadowTexture.minFilter = pc.gfx.FILTER_NEAREST;
        shadowTexture.magFilter = pc.gfx.FILTER_NEAREST;
        shadowTexture.addressU = pc.gfx.ADDRESS_CLAMP_TO_EDGE;
        shadowTexture.addressV = pc.gfx.ADDRESS_CLAMP_TO_EDGE;

        return shadowBuffer;
    };

    LightNode.prototype._createShadowCamera = function () {
        if (this._shadowCamera)
            return;

        var shadowBuffer = this._createShadowMap();

        // We don't need to clear the color buffer if we're rendering a depth map
        var device = pc.gfx.Device.getCurrent();
        var flags = (device.extDepthTexture) ? pc.gfx.CLEARFLAG_DEPTH : pc.gfx.CLEARFLAG_COLOR | pc.gfx.CLEARFLAG_DEPTH;

        var shadowCam = new pc.scene.CameraNode();
        shadowCam.setRenderTarget(new pc.gfx.RenderTarget(shadowBuffer));
        shadowCam.setClearOptions({
            color: [1.0, 1.0, 1.0, 1.0],
            depth: 1.0,
            flags: flags
        });

        return shadowCam;
    };

    LightNode.prototype.setShadowBias = function (bias) {
        this._shadowBias = bias;
    };

    LightNode.prototype.setShadowResolution = function (width, height) {
        if ((width !== this._shadowWidth) && (height !== this._shadowHeight)) {
            this._shadowWidth = width;
            this._shadowHeight = height;
            if (this._shadowCamera) {
                var shadowBuffer = this._createShadowMap();
                this._shadowCamera.setRenderTarget(new pc.gfx.RenderTarget(shadowBuffer));
            }
        }
    };

    /**
     * @function
     * @name pc.scene.LightNode#setCastShadows
     * @description Toggles the casting of shadows from this light.
     * @param {Boolean} castShadows True to enabled shadow casting, false otherwise.
     * @author Will Eastcott
     */
    LightNode.prototype.setCastShadows = function (castShadows) {
        this._castShadows = castShadows;

        // No support for point lights yet
        if (this._castShadows && this._type !== pc.scene.LightType.POINT) {
            this._shadowCamera = this._createShadowCamera();
        } else {
            this._shadowCamera = null;
        }
    };

    /**
     * @function
     * @name pc.scene.LightNode#setColor
     * @description Sets the RGB color of the light. RGB components should be
     * specified in the range 0 to 1.
     * @param {Array} color The RGB color of the light.
     * @author Will Eastcott
     */
    /**
     * @function
     * @name pc.scene.LightNode#setColor^2
     * @description Sets the RGB color of the light. RGB components should be
     * specified in the range 0 to 1.
     * @param {Number} red The red component of the light color.
     * @param {Number} green The green component of the light color.
     * @param {Number} blue The blue component of the light color.
     * @author Will Eastcott
     */
    LightNode.prototype.setColor = function () {
        if (arguments.length === 1) {
            pc.math.vec3.set(this._color, arguments[0][0], arguments[0][1], arguments[0][2]); 
        } else if (arguments.length === 3) {
            pc.math.vec3.set(this._color, arguments[0], arguments[1], arguments[2]); 
        }
        pc.math.vec3.scale(this._color, this._intensity, this._finalColor);
    };

    /**
     * @function
     * @name pc.scene.LightNode#setEnabled
     * @description Marks the specified light as enabled or disabled.
     * @param {boolean} enable true to enable the light and false to disable it.
     * @author Will Eastcott
     */
    LightNode.prototype.setEnabled = function (enable) {
        this._enabled = enable;
    };

    /**
     * @function
     * @name pc.scene.LightNode#setInnerConeAngle
     * @description Sets the inner cone angle of the light. Note that this
     * function only affects spotlights. The contribution of the spotlight is
     * zero outside the cone defined by this angle.
     * @param {Number} angle The inner cone angle of the spotlight in degrees.
     * @author Will Eastcott
     */
    LightNode.prototype.setInnerConeAngle = function (angle) {
        this._innerConeAngle = angle;
        this._innerConeAngleCos = Math.cos(angle * Math.PI / 180);
    };

    /**
     * @function
     * @name pc.scene.LightNode#setIntensity
     * @description Sets the intensity of the light. The intensity is used to
     * scale the color of the light. Note that this makes it possible to take
     * the light color's RGB components outside the range 0 to 1.
     * @param {Number} intensity The intensity of the light.
     * @author Will Eastcott
     */
    LightNode.prototype.setIntensity = function (intensity) {
        this._intensity = intensity;
        pc.math.vec3.scale(this._color, intensity, this._finalColor);
    };

    /**
     * @function
     * @name pc.scene.LightNode#setOuterConeAngle
     * @description Sets the outer cone angle of the light. Note that this
     * function only affects spotlights. The contribution of the spotlight is
     * zero outside the cone defined by this angle.
     * @param {Number} angle The outer cone angle of the spotlight in degrees.
     * @author Will Eastcott
     */
    LightNode.prototype.setOuterConeAngle = function (angle) {
        this._outerConeAngle = angle;
        this._outerConeAngleCos = Math.cos(angle * Math.PI / 180);
    };

    /**
     * @function
     * @name pc.scene.LightNode#setType
     * @description
     * @param {pc.scene.LightType} type
     * @author Will Eastcott
     */
    LightNode.prototype.setType = function (type) {
        if (this._type !== type) {
            this._type = type;

            if (this._castShadows && type !== pc.scene.LightType.POINT) {
                this._shadowCamera = this._createShadowCamera();
            }
        }
    };

    return {
        LightNode: LightNode
    }; 
}());