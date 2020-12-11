import { Color } from '../core/color.js';
import { math } from '../math/math.js';
import { Mat4 } from '../math/mat4.js';
import { Vec2 } from '../math/vec2.js';
import { Vec3 } from '../math/vec3.js';
import { Vec4 } from '../math/vec4.js';

import {
    BLUR_GAUSSIAN,
    LIGHTTYPE_DIRECTIONAL, LIGHTTYPE_POINT, LIGHTTYPE_SPOT,
    MASK_LIGHTMAP,
    SHADOW_PCF3, SHADOW_PCF5, SHADOW_VSM8, SHADOW_VSM16, SHADOW_VSM32,
    SHADOWUPDATE_NONE, SHADOWUPDATE_REALTIME, SHADOWUPDATE_THISFRAME, LIGHTSHAPE_PUNCTUAL
} from './constants.js';

import { Application } from '../framework/application.js';

var spotCenter = new Vec3();
var spotEndPoint = new Vec3();
var tmpVec = new Vec3();

var chanId = { r: 0, g: 1, b: 2, a: 3 };

/**
 * @private
 * @class
 * @name pc.Light
 * @classdesc A light.
 */
var Light = function Light() {
    // Light properties (defaults)
    this._type = LIGHTTYPE_DIRECTIONAL;
    this._color = new Color(0.8, 0.8, 0.8);
    this._intensity = 1;
    this._castShadows = false;
    this.enabled = false;
    this.mask = 1;
    this.isStatic = false;
    this.key = 0;
    this.bakeDir = true;

    // Point and spot properties
    this.attenuationStart = 10;
    this.attenuationEnd = 10;
    this._falloffMode = 0;
    this._shadowType = SHADOW_PCF3;
    this._vsmBlurSize = 11;
    this.vsmBlurMode = BLUR_GAUSSIAN;
    this.vsmBias = 0.01 * 0.25;
    this._cookie = null; // light cookie texture (2D for spot, cubemap for point)
    this.cookieIntensity = 1;
    this._cookieFalloff = true;
    this._cookieChannel = "rgb";
    this._cookieTransform = null; // 2d rotation/scale matrix (spot only)
    this._cookieTransformUniform = new Float32Array(4);
    this._cookieOffset = null; // 2d position offset (spot only)
    this._cookieOffsetUniform = new Float32Array(2);
    this._cookieTransformSet = false;
    this._cookieOffsetSet = false;

    // Spot properties
    this._innerConeAngle = 40;
    this._outerConeAngle = 45;

    // Light source shape properties
    this.shape = LIGHTSHAPE_PUNCTUAL;
    this._size = new Vec2(1, 1);

    // Cache of light property data in a format more friendly for shader uniforms
    this._finalColor = new Float32Array([0.8, 0.8, 0.8]);
    var c = Math.pow(this._finalColor[0], 2.2);
    this._linearFinalColor = new Float32Array([c, c, c]);

    this._position = new Vec3(0, 0, 0);
    this._direction = new Vec3(0, 0, 0);
    this._innerConeAngleCos = Math.cos(this._innerConeAngle * Math.PI / 180);
    this._outerConeAngleCos = Math.cos(this._outerConeAngle * Math.PI / 180);

    // Shadow mapping resources
    this._shadowCamera = null;
    this._shadowMatrix = new Mat4();
    this.shadowDistance = 40;
    this._shadowResolution = 1024;
    this.shadowBias = -0.0005;
    this._normalOffsetBias = 0.0;
    this.shadowUpdateMode = SHADOWUPDATE_REALTIME;

    this._scene = null;
    this._node = null;
    this._rendererParams = [];

    this._isVsm = false;
    this._isPcf = true;
    this._cacheShadowMap = false;
    this._isCachedShadowMap = false;

    this._visibleLength = [0]; // lengths of passes in culledList
    this._visibleList = [[]]; // culled mesh instances per pass (1 for spot, 6 for point, cameraCount for directional)
    this._visibleCameraSettings = []; // camera settings used in each directional light pass
};

Object.assign(Light.prototype, {
    destroy: function () {
        this._destroyShadowMap();
    },

    /**
     * @private
     * @function
     * @name pc.Light#clone
     * @description Duplicates a light node but does not 'deep copy' the hierarchy.
     * @returns {pc.Light} A cloned Light.
     */
    clone: function () {
        var clone = new Light();

        // Clone Light properties
        clone.type = this._type;
        clone.setColor(this._color);
        clone.intensity = this._intensity;
        clone.castShadows = this.castShadows;
        clone.enabled = this.enabled;

        // Point and spot properties
        clone.attenuationStart = this.attenuationStart;
        clone.attenuationEnd = this.attenuationEnd;
        clone.falloffMode = this._falloffMode;
        clone.shadowType = this._shadowType;
        clone.vsmBlurSize = this._vsmBlurSize;
        clone.vsmBlurMode = this.vsmBlurMode;
        clone.vsmBias = this.vsmBias;
        clone.shadowUpdateMode = this.shadowUpdateMode;
        clone.mask = this.mask;

        // Spot properties
        clone.innerConeAngle = this._innerConeAngle;
        clone.outerConeAngle = this._outerConeAngle;

        // shape properties
        clone.shape = this.shape;
        clone._size = this._size.clone();

        // Shadow properties
        clone.shadowBias = this.shadowBias;
        clone.normalOffsetBias = this._normalOffsetBias;
        clone.shadowResolution = this._shadowResolution;
        clone.shadowDistance = this.shadowDistance;

        // Cookies properties
        // clone.cookie = this._cookie;
        // clone.cookieIntensity = this.cookieIntensity;
        // clone.cookieFalloff = this._cookieFalloff;
        // clone.cookieChannel = this._cookieChannel;
        // clone.cookieTransform = this._cookieTransform;
        // clone.cookieOffset = this._cookieOffset;

        return clone;
    },

    getColor: function () {
        return this._color;
    },

    getBoundingSphere: function (sphere) {
        if (this._type === LIGHTTYPE_SPOT) {
            var range = this.attenuationEnd;
            var angle = this._outerConeAngle;
            var f = Math.cos(angle * math.DEG_TO_RAD);
            var node = this._node;

            spotCenter.copy(node.up);
            spotCenter.scale(-range * 0.5 * f);
            spotCenter.add(node.getPosition());
            sphere.center = spotCenter;

            spotEndPoint.copy(node.up);
            spotEndPoint.scale(-range);

            tmpVec.copy(node.right);
            tmpVec.scale(Math.sin(angle * math.DEG_TO_RAD) * range);
            spotEndPoint.add(tmpVec);

            sphere.radius = spotEndPoint.length() * 0.5;

        } else if (this._type === LIGHTTYPE_POINT) {
            sphere.center = this._node.getPosition();
            sphere.radius = this.attenuationEnd;
        }
    },

    getBoundingBox: function (box) {
        if (this._type === LIGHTTYPE_SPOT) {
            var range = this.attenuationEnd;
            var angle = this._outerConeAngle;
            var node = this._node;

            var scl = Math.abs( Math.sin(angle * math.DEG_TO_RAD) * range );

            box.center.set(0, -range * 0.5, 0);
            box.halfExtents.set(scl, range * 0.5, scl);

            box.setFromTransformedAabb(box, node.getWorldTransform());

        } else if (this._type === LIGHTTYPE_POINT) {
            box.center.copy(this._node.getPosition());
            box.halfExtents.set(this.attenuationEnd, this.attenuationEnd, this.attenuationEnd);
        }
    },

    _updateFinalColor: function () {
        var color = this._color;
        var r = color.r;
        var g = color.g;
        var b = color.b;

        var i = this._intensity;

        var finalColor = this._finalColor;
        var linearFinalColor = this._linearFinalColor;

        finalColor[0] = r * i;
        finalColor[1] = g * i;
        finalColor[2] = b * i;
        if (i >= 1) {
            linearFinalColor[0] = Math.pow(r, 2.2) * i;
            linearFinalColor[1] = Math.pow(g, 2.2) * i;
            linearFinalColor[2] = Math.pow(b, 2.2) * i;
        } else {
            linearFinalColor[0] = Math.pow(finalColor[0], 2.2);
            linearFinalColor[1] = Math.pow(finalColor[1], 2.2);
            linearFinalColor[2] = Math.pow(finalColor[2], 2.2);
        }
    },

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

        this._updateFinalColor();
    },

    _destroyShadowMap: function () {
        if (this._shadowCamera) {
            if (!this._isCachedShadowMap) {
                var rt = this._shadowCamera.renderTarget;
                var i;
                if (rt) {
                    if (rt.length) {
                        for (i = 0; i < rt.length; i++) {
                            if (rt[i].colorBuffer) rt[i].colorBuffer.destroy();
                            rt[i].destroy();
                        }
                    } else {
                        if (rt.colorBuffer) rt.colorBuffer.destroy();
                        if (rt.depthBuffer) rt.depthBuffer.destroy();
                        rt.destroy();
                    }
                }
            }
            this._shadowCamera.renderTarget = null;
            this._shadowCamera = null;
            this._shadowCubeMap = null;
            if (this.shadowUpdateMode === SHADOWUPDATE_NONE) {
                this.shadowUpdateMode = SHADOWUPDATE_THISFRAME;
            }
        }
    },

    updateShadow: function () {
        if (this.shadowUpdateMode !== SHADOWUPDATE_REALTIME) {
            this.shadowUpdateMode = SHADOWUPDATE_THISFRAME;
        }
    },

    updateKey: function () {
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
        var key =
               (this._type                                << 29) |
               ((this._castShadows ? 1 : 0)               << 28) |
               (this._shadowType                          << 25) |
               (this._falloffMode                         << 23) |
               ((this._normalOffsetBias !== 0.0 ? 1 : 0)  << 22) |
               ((this._cookie ? 1 : 0)                    << 21) |
               ((this._cookieFalloff ? 1 : 0)             << 20) |
               (chanId[this._cookieChannel.charAt(0)]     << 18) |
               ((this._cookieTransform ? 1 : 0)           << 12);

        if (this._cookieChannel.length === 3) {
            key |= (chanId[this._cookieChannel.charAt(1)] << 16);
            key |= (chanId[this._cookieChannel.charAt(2)] << 14);
        }

        if (key !== this.key && this._scene !== null) {
            this._scene.layers._dirtyLights = true;
        }

        this.key = key;
    }
});

Object.defineProperty(Light.prototype, 'type', {
    get: function () {
        return this._type;
    },
    set: function (value) {
        if (this._type === value)
            return;

        this._type = value;
        this._destroyShadowMap();
        this.updateKey();

        var stype = this._shadowType;
        this._shadowType = null;
        this.shadowType = stype; // refresh shadow type; switching from direct/spot to point and back may change it
    }
});

Object.defineProperty(Light.prototype, 'shadowType', {
    get: function () {
        return this._shadowType;
    },
    set: function (value) {
        if (this._shadowType === value)
            return;

        var device = Application.getApplication().graphicsDevice;

        if (this._type === LIGHTTYPE_POINT)
            value = SHADOW_PCF3; // VSM or HW PCF for point lights is not supported yet

        if (value === SHADOW_PCF5 && !device.webgl2) {
            value = SHADOW_PCF3; // fallback from HW PCF to old PCF
        }

        if (value === SHADOW_VSM32 && !device.textureFloatRenderable) // fallback from vsm32 to vsm16
            value = SHADOW_VSM16;

        if (value === SHADOW_VSM16 && !device.textureHalfFloatRenderable) // fallback from vsm16 to vsm8
            value = SHADOW_VSM8;

        this._isVsm = value >= SHADOW_VSM8 && value <= SHADOW_VSM32;
        this._isPcf = value === SHADOW_PCF5 || value === SHADOW_PCF3;

        this._shadowType = value;
        this._destroyShadowMap();
        this.updateKey();
    }
});

Object.defineProperty(Light.prototype, 'castShadows', {
    get: function () {
        return this._castShadows && this.mask !== MASK_LIGHTMAP && this.mask !== 0;
    },
    set: function (value) {
        if (this._castShadows === value)
            return;

        this._castShadows = value;
        this.updateKey();
    }
});

Object.defineProperty(Light.prototype, 'shadowResolution', {
    get: function () {
        return this._shadowResolution;
    },
    set: function (value) {
        if (this._shadowResolution === value)
            return;

        var device = Application.getApplication().graphicsDevice;
        if (this._type === LIGHTTYPE_POINT) {
            value = Math.min(value, device.maxCubeMapSize);
        } else {
            value = Math.min(value, device.maxTextureSize);
        }
        this._shadowResolution = value;
    }
});

Object.defineProperty(Light.prototype, 'vsmBlurSize', {
    get: function () {
        return this._vsmBlurSize;
    },
    set: function (value) {
        if (this._vsmBlurSize === value)
            return;

        if (value % 2 === 0) value++; // don't allow even size
        this._vsmBlurSize = value;
    }
});

Object.defineProperty(Light.prototype, 'normalOffsetBias', {
    get: function () {
        return this._normalOffsetBias;
    },
    set: function (value) {
        if (this._normalOffsetBias === value)
            return;

        if ((!this._normalOffsetBias && value) || (this._normalOffsetBias && !value)) {
            this.updateKey();
        }
        this._normalOffsetBias = value;
    }
});

Object.defineProperty(Light.prototype, 'falloffMode', {
    get: function () {
        return this._falloffMode;
    },
    set: function (value) {
        if (this._falloffMode === value)
            return;

        this._falloffMode = value;
        this.updateKey();
    }
});

Object.defineProperty(Light.prototype, 'innerConeAngle', {
    get: function () {
        return this._innerConeAngle;
    },
    set: function (value) {
        if (this._innerConeAngle === value)
            return;

        this._innerConeAngle = value;
        this._innerConeAngleCos = Math.cos(value * Math.PI / 180);
    }
});

Object.defineProperty(Light.prototype, 'outerConeAngle', {
    get: function () {
        return this._outerConeAngle;
    },
    set: function (value) {
        if (this._outerConeAngle === value)
            return;

        this._outerConeAngle = value;
        this._outerConeAngleCos = Math.cos(value * Math.PI / 180);
    }
});

Object.defineProperty(Light.prototype, 'intensity', {
    get: function () {
        return this._intensity;
    },
    set: function (value) {
        if (this._intensity !== value) {
            this._intensity = value;
            this._updateFinalColor();
        }
    }
});

Object.defineProperty(Light.prototype, 'width', {
    get: function () {
        return this._size.x;
    },
    set: function (value) {
        this._size.x = value;
    }
});

Object.defineProperty(Light.prototype, 'height', {
    get: function () {
        return this._size.y;
    },
    set: function (value) {
        this._size.y = value;
    }
});

Object.defineProperty(Light.prototype, 'cookie', {
    get: function () {
        return this._cookie;
    },
    set: function (value) {
        if (this._cookie === value)
            return;

        this._cookie = value;
        this.updateKey();
    }
});

Object.defineProperty(Light.prototype, 'cookieFalloff', {
    get: function () {
        return this._cookieFalloff;
    },
    set: function (value) {
        if (this._cookieFalloff === value)
            return;

        this._cookieFalloff = value;
        this.updateKey();
    }
});

Object.defineProperty(Light.prototype, 'cookieChannel', {
    get: function () {
        return this._cookieChannel;
    },
    set: function (value) {
        if (this._cookieChannel === value)
            return;

        if (value.length < 3) {
            var chr = value.charAt(value.length - 1);
            var addLen = 3 - value.length;
            for (var i = 0; i < addLen; i++)
                value += chr;
        }
        this._cookieChannel = value;
        this.updateKey();
    }
});

Object.defineProperty(Light.prototype, 'cookieTransform', {
    get: function () {
        return this._cookieTransform;
    },
    set: function (value) {
        if (this._cookieTransform === value)
            return;

        this._cookieTransform = value;
        this._cookieTransformSet = !!value;
        if (value && !this._cookieOffset) {
            this.cookieOffset = new Vec2(); // using transform forces using offset code
            this._cookieOffsetSet = false;
        }
        this.updateKey();
    }
});

Object.defineProperty(Light.prototype, 'cookieOffset', {
    get: function () {
        return this._cookieOffset;
    },
    set: function (value) {
        if (this._cookieOffset === value)
            return;

        var xformNew = !!(this._cookieTransformSet || value);
        if (xformNew && !value && this._cookieOffset) {
            this._cookieOffset.set(0, 0);
        } else {
            this._cookieOffset = value;
        }
        this._cookieOffsetSet = !!value;
        if (value && !this._cookieTransform) {
            this.cookieTransform = new Vec4(1, 1, 0, 0); // using offset forces using matrix code
            this._cookieTransformSet = false;
        }
        this.updateKey();
    }
});

export { Light };
