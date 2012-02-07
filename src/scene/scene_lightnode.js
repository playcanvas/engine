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
    // TODO: This won't work for multiple PlayCanvas canvases.
    var _globalAmbient = [0.0, 0.0, 0.0];

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
        this._attenuationStart = 1.0;
        this._attenuationEnd = 1.0;

        // Spot properties
        this._innerConeAngle = 40;
        this._outerConeAngle = 45;

        // Cache of light property data in a format more friendly for shader uniforms
        this._finalColor = pc.math.vec3.create(0.8, 0.8, 0.8);
        this._position = [];
        this._direction = [];
        this._innerConeAngleCos = Math.cos(this._innerConeAngle * Math.PI / 180);
        this._outerConeAngleCos = Math.cos(this._outerConeAngle * Math.PI / 180);
    };

    LightNode = LightNode.extendsFrom(pc.scene.GraphNode);

    LightNode.prototype.clone = function () {
        var clone = new pc.scene.LightNode();

        // GraphNode
        clone.setName(this.getName());
        clone.setLocalTransform(pc.math.mat4.clone(this.getLocalTransform()));
        clone._graphId = this._graphId;

        // LightNode
        clone.setType(this.getType());
        clone.setColor(this.getColor().splice(0));
        clone.setRadius(this.getRadius());
//        clone.setConeAngle(this.getConeAngle());

        return clone;
    };

    /**
     * @function
     * @name pc.scene.LightNode#getAttenuationEnd
     * @description Queries the radius of the point or spot light.
     * @returns {Array} The diffuse color of the light, represented by a 3 dimensional array (RGB components ranging 0..1).
     * @author Will Eastcott
     */
    LightNode.prototype.getAttenuationEnd = function () {
        return this._attenuationEnd;
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
    }

    /**
     * @function
     * @name pc.scene.LightNode#setCastShadows
     * @description Toggles the casting of shadows from this light.
     * @param {Boolean} castShadows True to enabled shadow casting, false otherwise.
     * @author Will Eastcott
     */
    LightNode.prototype.setCastShadows = function (castShadows) {
        this._castShadows = castShadows;
    };

    /**
     * @function
     * @name pc.scene.LightNode#setColor
     * @description Sets the RGB color of the light. RGB components should be
     * specified in the range 0 to 1.
     * @param {Array} color The RGB color of the light.
     * @author Will Eastcott
     */
    LightNode.prototype.setColor = function (color) {
        this._color = color;
        pc.math.vec3.scale(color, this._intensity, this._finalColor);
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
     * @param {Number} color The intensity of the light.
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
        this._type = type;
    };

    /**
     * @function
     * @name pc.scene.LightNode.getGlobalAmbient
     * @description Queries the current global ambient color. This color is uploaded to a
     * vector uniform called 'light_globalAmbient'. The PlayCanvas 'phong' shader uses this
     * value by multiplying it by the material color of a mesh's material and adding it to
     * the total light contribution.
     * @returns {Array} The global ambient color represented by a 3 dimensional array (RGB components ranging 0..1).
     * @author Will Eastcott
     */
    LightNode.getGlobalAmbient = function () {
        return _globalAmbient;
    };

    /**
     * @function
     * @name pc.scene.LightNode.setGlobalAmbient
     * @description Sets the current global ambient color. This color is uploaded to a
     * vector uniform called 'light_globalAmbient'. The PlayCanvas 'phong' shader uses this
     * value by multiplying it by the material color of a mesh's material and adding it to
     * the total light contribution.
     * @returns {Array} The global ambient color represented by a 3 dimensional array (RGB components ranging 0..1).
     * @author Will Eastcott
     */
    LightNode.setGlobalAmbient = function (color) {
        _globalAmbient = color;

        var device = pc.gfx.Device.getCurrent();
        var scope = device.scope;
        scope.resolve("light_globalAmbient").setValue(_globalAmbient);
    };

    return {
        LightNode: LightNode
    }; 
}());