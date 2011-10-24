/**
 * Constants for light type.
 * @enum {number}
 */
pc.scene.LightType = {
    /** Directional (global) light source. */
    DIRECTIONAL: 1,
    /** Point (local) light source. */
    POINT: 2,
    /** Spot (local) light source. */
    SPOT: 4
};

pc.extend(pc.scene, function () {
    // TODO: This won't work for multiple PlayCanvas canvases.
    var _activeLightsChanged = false;
    var _activeLights = [];
    _activeLights[pc.scene.LightType.DIRECTIONAL] = [];
    _activeLights[pc.scene.LightType.POINT] = [];
    _activeLights[pc.scene.LightType.SPOT] = [];
    var _globalAmbient = [0.0, 0.0, 0.0];

    /**
     * @name pc.scene.LightNode
     * @class A light.
     */
    var LightNode = function LightNode() {
        // LightNode properties (defaults)
        this._type      = pc.scene.LightType.DIRECTIONAL;
        this._color     = [0.8, 0.8, 0.8];
        this._radius    = 1.0;
        this._coneAngle = Math.PI * 0.5;
        this._enabled   = false;
    };

    LightNode = LightNode.extendsFrom(pc.scene.GraphNode);

    /**
     * @function
     * @name pc.scene.LightNode#enable
     * @description Marks the specified light as enabled or disabled.
     * @param {boolean} enable true to enable the light and false to disable it.
     * @author Will Eastcott
     */
    LightNode.prototype.enable = function (enable) {
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
     * @name pc.scene.LightNode#getRadius
     * @description Queries the radius of the point or spot light.
     * @returns {Array} The diffuse color of the light, represented by a 3 dimensional array (RGB components ranging 0..1).
     * @author Will Eastcott
     */
    LightNode.prototype.getRadius = function () {
        return this._radius;
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
     * @name pc.scene.LightNode#setColor
     * @description
     * @param {Array} color
     * @author Will Eastcott
     */
    LightNode.prototype.setColor = function (color) {
        this._color = color;
    };

    /**
     * @function
     * @name pc.scene.LightNode#setRadius
     * @description
     * @param {number} radius
     * @author Will Eastcott
     */
    LightNode.prototype.setRadius = function (radius) {
        this._radius = radius;
    }

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

        for (var i = 0; i < numDirs; i++) {
            var directional = dirs[i];
            var wtm = directional.getWorldTransform();
            var light = "light" + i;

            scope.resolve(light + "_color").setValue(directional._color);
            scope.resolve(light + "_position").setValue([-wtm[4], -wtm[5], -wtm[6]]);
        }

        for (var i = 0; i < numPnts; i++) {
            var point = pnts[i];
            var wtm = point.getWorldTransform();
            var light = "light" + (numDirs + i);

            scope.resolve(light + "_color").setValue(point._color);
            scope.resolve(light + "_position").setValue([wtm[12], wtm[13], wtm[14]]);
        }
    };

    /**
     * @function
     * @name pc.scene.LightNode.getNumEnabled
     * @description
     * @param {pc.scene.LightType} types
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