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
    var _activeLights = [[], [], []];
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
        this._finalColor = pc.math.vec3.create(0.8, 0.8, 0.8);
        this._castShadows = false;
        this._enabled = false;

        // Point and spot properties
        this._attenuationStart = 1.0;
        this._attenuationEnd = 1.0;

        // Spot properties
        this._innerConeAngle = 40;
        this._innerConeAngleCos = Math.cos(this._innerConeAngle);
        this._outerConeAngle = 45;
        this._outerConeAngleCos = Math.cos(this._outerConeAngle);

        // Preallocated arrays for uploading vector uniforms
        this._position = [];
        this._direction = [];
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
        return this._outerConeAngle * 180 / Math.PI;
    };

    /**
     * @function
     * @name pc.scene.LightNode#getType
     * @description
     * @returns {pc.scene.LightType}
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
        if (enable && !this._enabled) {
            switch (this._type) {
                case pc.scene.LightType.DIRECTIONAL:
                case pc.scene.LightType.POINT:
                case pc.scene.LightType.SPOT:
                    _activeLights[this._type].push(this);
                    _activeLights.dirty = true;
                    break;
            }
            this._enabled = true;
        } else if (!enable && this._enabled) {
            switch (this._type) {
                case pc.scene.LightType.DIRECTIONAL:
                case pc.scene.LightType.POINT:
                case pc.scene.LightType.SPOT:
                    var index = _activeLights[this._type].indexOf(this);
                    if (index !== -1) {
                        _activeLights[this._type].splice(index, 1);
                        _activeLights.dirty = true;
                    }
                    break;
            }
            this._enabled = false;
        }
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
    };

    /**
     * @function
     * @name pc.scene.LightNode.dispatch
     * @description
     * @author Will Eastcott
     */
    LightNode.dispatch = function () {
        var dirs = _activeLights[pc.scene.LightType.DIRECTIONAL];
        var pnts = _activeLights[pc.scene.LightType.POINT];
        var spts = _activeLights[pc.scene.LightType.SPOT];
        
        var numDirs = dirs.length;
        var numPnts = pnts.length;
        var numSpts = spts.length;
        
        var device = pc.gfx.Device.getCurrent();
        var scope = device.scope;

        scope.resolve("light_globalAmbient").setValue(_globalAmbient);

        var i, wtm, light;
        var directional, point, spot;

        for (i = 0; i < numDirs; i++) {
            directional = dirs[i];
            wtm = directional.getWorldTransform();
            light = "light" + i;

            scope.resolve(light + "_color").setValue(directional._finalColor);
            // Directionals shine down the negative Y axis
            directional._direction[0] = -wtm[4];
            directional._direction[1] = -wtm[5];
            directional._direction[2] = -wtm[6];
            scope.resolve(light + "_direction").setValue(directional._direction);
        }

        for (i = 0; i < numPnts; i++) {
            point = pnts[i];
            wtm = point.getWorldTransform();
            light = "light" + (numDirs + i);

            scope.resolve(light + "_radius").setValue(point._attenuationEnd);
            scope.resolve(light + "_color").setValue(point._finalColor);
            point._position[0] = wtm[12];
            point._position[1] = wtm[13];
            point._position[2] = wtm[14];
            scope.resolve(light + "_position").setValue(point._position);
        }

        for (i = 0; i < numSpts; i++) {
            spot = spts[i];
            wtm = spot.getWorldTransform();
            light = "light" + (numDirs + numPnts + i);

            scope.resolve(light + "_innerConeAngle").setValue(spot._innerConeAngleCos);
            scope.resolve(light + "_outerConeAngle").setValue(spot._outerConeAngleCos);
            scope.resolve(light + "_radius").setValue(spot._attenuationEnd);
            scope.resolve(light + "_color").setValue(spot._finalColor);
            spot._position[0] = wtm[12];
            spot._position[1] = wtm[13];
            spot._position[2] = wtm[14];
            scope.resolve(light + "_position").setValue(spot._position);
            // Spots shine down the negative Y axis
            spot._direction[0] = -wtm[4];
            spot._direction[1] = -wtm[5];
            spot._direction[2] = -wtm[6];
            scope.resolve(light + "_spotDirection").setValue(spot._direction);
        }
    };

    /**
     * @function
     * @name pc.scene.LightNode.getNumEnabled
     * @description Queries the number of enabled lights. A optional bitfield
     * can be passed which specifies which particular light types are being 
     * queried. If no types are specified, the function return the total number
     * of lights that are enabled.
     * @param {pc.scene.LightType} type The light type(s) to query.
     * @author Will Eastcott
     */
    LightNode.getNumEnabled = function (type) {
        if (type === undefined) {
            return _activeLights[pc.scene.LightType.DIRECTIONAL].length + 
                   _activeLights[pc.scene.LightType.POINT].length + 
                   _activeLights[pc.scene.LightType.SPOT].length;
        } else {
            return _activeLights[type].length;
        }
    }

    return {
        LightNode: LightNode
    }; 
}());