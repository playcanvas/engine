import { math } from '../math/math.js';
import { Color } from '../math/color.js';
import { Mat4 } from '../math/mat4.js';
import { Vec2 } from '../math/vec2.js';
import { Vec3 } from '../math/vec3.js';
import { Vec4 } from '../math/vec4.js';

import {
    BLUR_GAUSSIAN,
    LIGHTTYPE_DIRECTIONAL, LIGHTTYPE_OMNI, LIGHTTYPE_SPOT,
    MASK_LIGHTMAP, MASK_DYNAMIC,
    SHADOW_PCF3, SHADOW_PCF5, SHADOW_VSM8, SHADOW_VSM16, SHADOW_VSM32,
    SHADOWUPDATE_NONE, SHADOWUPDATE_REALTIME, SHADOWUPDATE_THISFRAME,
    LIGHTSHAPE_PUNCTUAL
} from './constants.js';
import { ShadowRenderer } from './renderer/shadow-renderer.js';

var spotCenter = new Vec3();
var spotEndPoint = new Vec3();
var tmpVec = new Vec3();

var chanId = { r: 0, g: 1, b: 2, a: 3 };

// viewport in shadows map for cascades for directional light
const directionalCascades = [
    [new Vec4(0, 0, 1, 1)],
    [new Vec4(0, 0, 0.5, 0.5), new Vec4(0, 0.5, 0.5, 0.5)],
    [new Vec4(0, 0, 0.5, 0.5), new Vec4(0, 0.5, 0.5, 0.5), new Vec4(0.5, 0, 0.5, 0.5)],
    [new Vec4(0, 0, 0.5, 0.5), new Vec4(0, 0.5, 0.5, 0.5), new Vec4(0.5, 0, 0.5, 0.5), new Vec4(0.5, 0.5, 0.5, 0.5)]
];

// Class storing shadow rendering related private information
class LightRenderData {
    constructor(device, camera, face, light) {

        // light this data belongs to
        this.light = light;

        // camera this applies to. Only used by directional light, as directional shadow map
        // is culled and rendered for each camera. Local lights' shadow is culled and rendered one time
        // and shared between cameras (even though it's not strictly correct and we can get shadows
        // from a mesh that is not visible by the camera)
        this.camera = camera;

        // camera used to cull / render the shadow map
        this.shadowCamera = ShadowRenderer.createShadowCamera(device, light._shadowType, light._type, face);

        this.shadowMatrix = new Mat4();

        // face index, value is based on light type:
        // - spot: always 0
        // - omni: cubemap face, 0..5
        // - directional: 0 for simple shadows, cascade index for cascaded shadow map
        this.face = face;

        // visible shadow casters
        this.visibleCasters = [];
    }

    // returns shadow buffer currently attached to the shadow camera
    get shadowBuffer() {
        const rt = this.shadowCamera.renderTarget;
        if (rt) {
            const light = this.light;
            if (light._type === LIGHTTYPE_OMNI) {
                return rt.colorBuffer;
            }

            return light._isPcf && light.device.webgl2 ? rt.depthBuffer : rt.colorBuffer;
        }

        return null;
    }
}

/**
 * @private
 * @class
 * @name Light
 * @classdesc A light.
 */
class Light {
    constructor(graphicsDevice) {
        this.device = graphicsDevice;

        // Light properties (defaults)
        this._type = LIGHTTYPE_DIRECTIONAL;
        this._color = new Color(0.8, 0.8, 0.8);
        this._intensity = 1;
        this._castShadows = false;
        this._enabled = false;
        this.mask = MASK_DYNAMIC;
        this.isStatic = false;
        this.key = 0;
        this.bakeDir = true;

        // Omni and spot properties
        this.attenuationStart = 10;
        this.attenuationEnd = 10;
        this._falloffMode = 0;
        this._shadowType = SHADOW_PCF3;
        this._vsmBlurSize = 11;
        this.vsmBlurMode = BLUR_GAUSSIAN;
        this.vsmBias = 0.01 * 0.25;
        this._cookie = null; // light cookie texture (2D for spot, cubemap for omni)
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

        // Directional properties
        this.cascades = null;               // an array of Vec4 viewports per cascade
        this._shadowMatrixPalette = null;   // a float array, 16 floats per cascade
        this._shadowCascadeDistances = null;
        this.numCascades = 1;
        this.cascadeDistribution = 0.5;

        // Light source shape properties
        this._shape = LIGHTSHAPE_PUNCTUAL;

        // Cache of light property data in a format more friendly for shader uniforms
        this._finalColor = new Float32Array([0.8, 0.8, 0.8]);
        var c = Math.pow(this._finalColor[0], 2.2);
        this._linearFinalColor = new Float32Array([c, c, c]);

        this._position = new Vec3(0, 0, 0);
        this._direction = new Vec3(0, 0, 0);
        this._innerConeAngleCos = Math.cos(this._innerConeAngle * Math.PI / 180);
        this._outerConeAngleCos = Math.cos(this._outerConeAngle * Math.PI / 180);

        // Shadow mapping resources
        this._shadowMap = null;
        this._shadowRenderParams = [];

        // Shadow mapping properties
        this.shadowDistance = 40;
        this._shadowResolution = 1024;
        this.shadowBias = -0.0005;
        this._normalOffsetBias = 0.0;
        this.shadowUpdateMode = SHADOWUPDATE_REALTIME;
        this._isVsm = false;
        this._isPcf = true;

        // cookie matrix (used in case the shadow mapping is disabled and so the shadow matrix cannot be used)
        this._cookieMatrix = null;

        this._scene = null;
        this._node = null;

        // private rendering data
        this._renderData = [];

        // true if the light is visible by any camera within a frame
        this.visibleThisFrame = false;
    }

    destroy() {
        this._destroyShadowMap();
        this._renderData = null;
    }

    // destroys shadow map related resources, called when shadow properties change and resources
    // need to be recreated
    _destroyShadowMap() {

        if (this._renderData) {
            this._renderData.length = 0;
        }

        if (this._shadowMap) {
            if (!this._shadowMap.cached) {
                this._shadowMap.destroy();
            }
            this._shadowMap = null;
        }

        if (this.shadowUpdateMode === SHADOWUPDATE_NONE) {
            this.shadowUpdateMode = SHADOWUPDATE_THISFRAME;
        }
    }

    // returns LightRenderData with matching camera and face
    getRenderData(camera, face) {

        // returns existing
        for (let i = 0; i < this._renderData.length; i++) {
            const current = this._renderData[i];
            if (current.camera === camera && current.face === face) {
                return current;
            }
        }

        // create new one
        const rd = new LightRenderData(this.device, camera, face, this);
        this._renderData.push(rd);
        return rd;
    }

    /**
     * @private
     * @function
     * @name Light#clone
     * @description Duplicates a light node but does not 'deep copy' the hierarchy.
     * @returns {Light} A cloned Light.
     */
    clone() {
        var clone = new Light(this.device);

        // Clone Light properties
        clone.type = this._type;
        clone.setColor(this._color);
        clone.intensity = this._intensity;
        clone.castShadows = this.castShadows;
        clone._enabled = this._enabled;

        // Omni and spot properties
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

        // Directional properties
        clone.numCascades = this.numCascades;
        clone.cascadeDistribution = this.cascadeDistribution;

        // shape properties
        clone.shape = this._shape;

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
    }

    get numCascades() {
        return this.cascades.length;
    }

    set numCascades(value) {
        if (!this.cascades || this.numCascades != value) {
            this.cascades = directionalCascades[value - 1];
            this._shadowMatrixPalette = new Float32Array(4 * 16);   // always 4
            this._shadowCascadeDistances = new Float32Array(4);     // always 4
            this._destroyShadowMap();
            this.updateKey();
        }
    }

    get shadowMap() {
        return this._shadowMap;
    }

    set shadowMap(shadowMap) {
        if (this._shadowMap !== shadowMap) {
            this._destroyShadowMap();
            this._shadowMap = shadowMap;
        }
    }

    getColor() {
        return this._color;
    }

    getBoundingSphere(sphere) {
        if (this._type === LIGHTTYPE_SPOT) {
            var range = this.attenuationEnd;
            var angle = this._outerConeAngle;
            var f = Math.cos(angle * math.DEG_TO_RAD);
            var node = this._node;

            spotCenter.copy(node.up);
            spotCenter.mulScalar(-range * 0.5 * f);
            spotCenter.add(node.getPosition());
            sphere.center = spotCenter;

            spotEndPoint.copy(node.up);
            spotEndPoint.mulScalar(-range);

            tmpVec.copy(node.right);
            tmpVec.mulScalar(Math.sin(angle * math.DEG_TO_RAD) * range);
            spotEndPoint.add(tmpVec);

            sphere.radius = spotEndPoint.length() * 0.5;

        } else if (this._type === LIGHTTYPE_OMNI) {
            sphere.center = this._node.getPosition();
            sphere.radius = this.attenuationEnd;
        }
    }

    getBoundingBox(box) {
        if (this._type === LIGHTTYPE_SPOT) {
            var range = this.attenuationEnd;
            var angle = this._outerConeAngle;
            var node = this._node;

            var scl = Math.abs(Math.sin(angle * math.DEG_TO_RAD) * range);

            box.center.set(0, -range * 0.5, 0);
            box.halfExtents.set(scl, range * 0.5, scl);

            box.setFromTransformedAabb(box, node.getWorldTransform());

        } else if (this._type === LIGHTTYPE_OMNI) {
            box.center.copy(this._node.getPosition());
            box.halfExtents.set(this.attenuationEnd, this.attenuationEnd, this.attenuationEnd);
        }
    }

    _updateFinalColor() {
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
    }

    setColor() {
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
    }

    updateShadow() {
        if (this.shadowUpdateMode !== SHADOWUPDATE_REALTIME) {
            this.shadowUpdateMode = SHADOWUPDATE_THISFRAME;
        }
    }

    layersDirty() {
        if (this._scene?.layers) {
            this._scene.layers._dirtyLights = true;
        }
    }

    updateKey() {
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
        // 10 - 11 : light source shape
        //  8 -  9 : light num cascades
        var key =
               (this._type                                << 29) |
               ((this._castShadows ? 1 : 0)               << 28) |
               (this._shadowType                          << 25) |
               (this._falloffMode                         << 23) |
               ((this._normalOffsetBias !== 0.0 ? 1 : 0)  << 22) |
               ((this._cookie ? 1 : 0)                    << 21) |
               ((this._cookieFalloff ? 1 : 0)             << 20) |
               (chanId[this._cookieChannel.charAt(0)]     << 18) |
               ((this._cookieTransform ? 1 : 0)           << 12) |
               ((this._shape)                             << 10) |
               ((this.numCascades - 1)                    <<  8);

        if (this._cookieChannel.length === 3) {
            key |= (chanId[this._cookieChannel.charAt(1)] << 16);
            key |= (chanId[this._cookieChannel.charAt(2)] << 14);
        }

        if (key !== this.key && this._scene !== null) {
            // TODO: most of the changes to the key should not invalidate the composition,
            // probably only _type and _castShadows
            this.layersDirty();
        }

        this.key = key;
    }

    get type() {
        return this._type;
    }

    set type(value) {
        if (this._type === value)
            return;

        this._type = value;
        this._destroyShadowMap();
        this.updateKey();

        var stype = this._shadowType;
        this._shadowType = null;
        this.shadowType = stype; // refresh shadow type; switching from direct/spot to omni and back may change it
    }

    get shape() {
        return this._shape;
    }

    set shape(value) {
        if (this._shape === value)
            return;

        this._shape = value;
        this._destroyShadowMap();
        this.updateKey();

        var stype = this._shadowType;
        this._shadowType = null;
        this.shadowType = stype; // refresh shadow type; switching shape and back may change it
    }

    get shadowType() {
        return this._shadowType;
    }

    set shadowType(value) {
        if (this._shadowType === value)
            return;

        var device = this.device;

        if (this._type === LIGHTTYPE_OMNI)
            value = SHADOW_PCF3; // VSM or HW PCF for omni lights is not supported yet

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

    get enabled() {
        return this._enabled;
    }

    set enabled(value) {
        if (this._enabled !== value) {
            this._enabled = value;
            this.layersDirty();
        }
    }

    get castShadows() {
        return this._castShadows && this.mask !== MASK_LIGHTMAP && this.mask !== 0;
    }

    set castShadows(value) {
        if (this._castShadows !== value) {
            this._castShadows = value;
            this._destroyShadowMap();
            this.layersDirty();
            this.updateKey();
        }
    }

    get shadowResolution() {
        return this._shadowResolution;
    }

    set shadowResolution(value) {
        if (this._shadowResolution !== value) {
            if (this._type === LIGHTTYPE_OMNI) {
                value = Math.min(value, this.device.maxCubeMapSize);
            } else {
                value = Math.min(value, this.device.maxTextureSize);
            }
            this._shadowResolution = value;
            this._destroyShadowMap();
        }
    }

    get vsmBlurSize() {
        return this._vsmBlurSize;
    }

    set vsmBlurSize(value) {
        if (this._vsmBlurSize === value)
            return;

        if (value % 2 === 0) value++; // don't allow even size
        this._vsmBlurSize = value;
    }

    get normalOffsetBias() {
        return this._normalOffsetBias;
    }

    set normalOffsetBias(value) {
        if (this._normalOffsetBias === value)
            return;

        if ((!this._normalOffsetBias && value) || (this._normalOffsetBias && !value)) {
            this.updateKey();
        }
        this._normalOffsetBias = value;
    }

    get falloffMode() {
        return this._falloffMode;
    }

    set falloffMode(value) {
        if (this._falloffMode === value)
            return;

        this._falloffMode = value;
        this.updateKey();
    }

    get innerConeAngle() {
        return this._innerConeAngle;
    }

    set innerConeAngle(value) {
        if (this._innerConeAngle === value)
            return;

        this._innerConeAngle = value;
        this._innerConeAngleCos = Math.cos(value * Math.PI / 180);
    }

    get outerConeAngle() {
        return this._outerConeAngle;
    }

    set outerConeAngle(value) {
        if (this._outerConeAngle === value)
            return;

        this._outerConeAngle = value;
        this._outerConeAngleCos = Math.cos(value * Math.PI / 180);
    }

    get intensity() {
        return this._intensity;
    }

    set intensity(value) {
        if (this._intensity !== value) {
            this._intensity = value;
            this._updateFinalColor();
        }
    }

    get cookieMatrix() {
        if (!this._cookieMatrix) {
            this._cookieMatrix = new Mat4();
        }
        return this._cookieMatrix;
    }

    get cookie() {
        return this._cookie;
    }

    set cookie(value) {
        if (this._cookie === value)
            return;

        this._cookie = value;
        this.updateKey();
    }

    get cookieFalloff() {
        return this._cookieFalloff;
    }

    set cookieFalloff(value) {
        if (this._cookieFalloff === value)
            return;

        this._cookieFalloff = value;
        this.updateKey();
    }

    get cookieChannel() {
        return this._cookieChannel;
    }

    set cookieChannel(value) {
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

    get cookieTransform() {
        return this._cookieTransform;
    }

    set cookieTransform(value) {
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

    get cookieOffset() {
        return this._cookieOffset;
    }

    set cookieOffset(value) {
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
}

export { Light };
