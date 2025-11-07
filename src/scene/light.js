import { math } from '../core/math/math.js';
import { Color } from '../core/math/color.js';
import { Mat4 } from '../core/math/mat4.js';
import { Vec2 } from '../core/math/vec2.js';
import { Vec3 } from '../core/math/vec3.js';
import { Vec4 } from '../core/math/vec4.js';
import {
    BLUR_GAUSSIAN,
    LIGHTTYPE_DIRECTIONAL, LIGHTTYPE_OMNI, LIGHTTYPE_SPOT,
    MASK_BAKE, MASK_AFFECT_DYNAMIC,
    SHADOW_PCF1_32F, SHADOW_PCF3_32F, SHADOW_VSM_16F, SHADOW_VSM_32F, SHADOW_PCSS_32F,
    SHADOWUPDATE_NONE, SHADOWUPDATE_REALTIME, SHADOWUPDATE_THISFRAME,
    LIGHTSHAPE_PUNCTUAL, LIGHTFALLOFF_LINEAR,
    shadowTypeInfo,
    SHADOW_PCF1_16F, SHADOW_PCF3_16F,
    MASK_AFFECT_LIGHTMAPPED,
    LIGHT_COLOR_DIVIDER
} from './constants.js';
import { ShadowRenderer } from './renderer/shadow-renderer.js';
import { DepthState } from '../platform/graphics/depth-state.js';
import { FloatPacking } from '../core/math/float-packing.js';

/**
 * @import { GraphicsDevice } from '../platform/graphics/graphics-device.js'
 * @import { EventHandle } from '../core/event-handle.js';
 */

/**
 * @import { BindGroup } from '../platform/graphics/bind-group.js'
 * @import { Layer } from './layer.js'
 */

const tmpVec = new Vec3();
const tmpBiases = {
    bias: 0,
    normalBias: 0
};
const tmpColor = new Color();

const chanId = { r: 0, g: 1, b: 2, a: 3 };

const lightTypes = {
    'directional': LIGHTTYPE_DIRECTIONAL,
    'omni': LIGHTTYPE_OMNI,
    'point': LIGHTTYPE_OMNI,
    'spot': LIGHTTYPE_SPOT
};

// viewport in shadows map for cascades for directional light
const directionalCascades = [
    [new Vec4(0, 0, 1, 1)],
    [new Vec4(0, 0, 0.5, 0.5), new Vec4(0, 0.5, 0.5, 0.5)],
    [new Vec4(0, 0, 0.5, 0.5), new Vec4(0, 0.5, 0.5, 0.5), new Vec4(0.5, 0, 0.5, 0.5)],
    [new Vec4(0, 0, 0.5, 0.5), new Vec4(0, 0.5, 0.5, 0.5), new Vec4(0.5, 0, 0.5, 0.5), new Vec4(0.5, 0.5, 0.5, 0.5)]
];

const channelMap = {
    'rrr': 0b0001,
    'ggg': 0b0010,
    'bbb': 0b0100,
    'aaa': 0b1000,
    'rgb': 0b0111
};

let id = 0;

/**
 * Class storing shadow rendering related private information
 */
class LightRenderData {
    constructor(camera, face, light) {

        // light this data belongs to
        this.light = light;

        // camera this applies to. Only used by directional light, as directional shadow map
        // is culled and rendered for each camera. Local lights' shadow is culled and rendered one time
        // and shared between cameras (even though it's not strictly correct and we can get shadows
        // from a mesh that is not visible by the camera)
        this.camera = camera;

        // camera used to cull / render the shadow map
        this.shadowCamera = ShadowRenderer.createShadowCamera(light._shadowType, light._type, face);

        // shadow view-projection matrix
        this.shadowMatrix = new Mat4();

        // viewport for the shadow rendering to the texture (x, y, width, height)
        this.shadowViewport = new Vec4(0, 0, 1, 1);

        // scissor rectangle for the shadow rendering to the texture (x, y, width, height)
        this.shadowScissor = new Vec4(0, 0, 1, 1);

        // depth range compensation for PCSS with directional lights
        this.projectionCompensation = 0;

        // face index, value is based on light type:
        // - spot: always 0
        // - omni: cubemap face, 0..5
        // - directional: 0 for simple shadows, cascade index for cascaded shadow map
        this.face = face;

        // visible shadow casters
        this.visibleCasters = [];

        // an array of view bind groups, single entry is used for shadows
        /** @type {BindGroup[]} */
        this.viewBindGroups = [];
    }

    // releases GPU resources
    destroy() {
        this.viewBindGroups.forEach((bg) => {
            bg.defaultUniformBuffer.destroy();
            bg.destroy();
        });
        this.viewBindGroups.length = 0;
    }

    // returns shadow buffer currently attached to the shadow camera
    get shadowBuffer() {
        const rt = this.shadowCamera.renderTarget;
        if (rt) {
            return this.light._isPcf ? rt.depthBuffer : rt.colorBuffer;
        }

        return null;
    }
}

/**
 * A light.
 *
 * @ignore
 */
class Light {
    /**
     * The Layers the light is on.
     *
     * @type {Set<Layer>}
     */
    layers = new Set();

    /**
     * True if the clustered lighting is enabled.
     *
     * @type {boolean}
     */
    clusteredLighting;

    /**
     * The depth state used when rendering the shadow map.
     *
     * @type {DepthState}
     */
    shadowDepthState = DepthState.DEFAULT.clone();

    /**
     * The flags used for clustered lighting. Stored as a bitfield, updated as properties change to
     * avoid those being updated each frame.
     *
     * @type {number}
     * @ignore
     */
    clusteredFlags = 0;

    /**
     * Storage data for light properties encoded as a Uint32Array.
     *
     * @type {Uint32Array}
     * @ignore
     */
    clusteredData = new Uint32Array(3);

    /**
     * Alias for clusteredData using 16bit unsigned integers.
     *
     * @type {Uint16Array}
     * @ignore
     */
    clusteredData16 = new Uint16Array(this.clusteredData.buffer);

    /**
     * Event handle for device restored event.
     *
     * @type {EventHandle|null}
     * @private
     */
    _evtDeviceRestored = null;

    /**
     * @param {GraphicsDevice} graphicsDevice - The graphics device.
     * @param {boolean} clusteredLighting - True if the clustered lighting is enabled.
     */
    constructor(graphicsDevice, clusteredLighting) {
        this.device = graphicsDevice;
        this.clusteredLighting = clusteredLighting;
        this.id = id++;

        this._evtDeviceRestored = graphicsDevice.on('devicerestored', this.onDeviceRestored, this);

        // Light properties (defaults)
        this._type = LIGHTTYPE_DIRECTIONAL;
        this._color = new Color(0.8, 0.8, 0.8);     // color in sRGB space
        this._intensity = 1;
        this._affectSpecularity = true;
        this._luminance = 0;
        this._castShadows = false;
        this._enabled = false;
        this._mask = MASK_AFFECT_DYNAMIC;
        this.isStatic = false;
        this.key = 0;
        this.bakeDir = true;
        this.bakeNumSamples = 1;
        this.bakeArea = 0;

        // Omni and spot properties
        this.attenuationStart = 10;
        this.attenuationEnd = 10;
        this._falloffMode = LIGHTFALLOFF_LINEAR;
        this._shadowType = SHADOW_PCF3_32F;
        this._vsmBlurSize = 11;
        this.vsmBlurMode = BLUR_GAUSSIAN;
        this.vsmBias = 0.01 * 0.25;
        this._cookie = null; // light cookie texture (2D for spot, cubemap for omni)
        this.cookieIntensity = 1;
        this._cookieFalloff = true;
        this._cookieChannel = 'rgb';
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
        this._cascadeBlend = 0;
        this.cascadeDistribution = 0.5;

        // Light source shape properties
        this._shape = LIGHTSHAPE_PUNCTUAL;

        // light color and intensity in the linear space
        this._colorLinear = new Float32Array(3);
        this._updateLinearColor();

        this._position = new Vec3(0, 0, 0);
        this._direction = new Vec3(0, 0, 0);
        this._innerConeAngleCos = Math.cos(this._innerConeAngle * Math.PI / 180);
        this._updateOuterAngle(this._outerConeAngle);

        this._usePhysicalUnits = undefined;

        // Shadow mapping resources
        this._shadowMap = null;
        this._shadowRenderParams = [];
        this._shadowCameraParams = [];

        // Shadow mapping properties
        this.shadowDistance = 40;
        this._shadowResolution = 1024;
        this._shadowBias = -0.0005;
        this._shadowIntensity = 1.0;
        this._normalOffsetBias = 0.0;
        this.shadowUpdateMode = SHADOWUPDATE_REALTIME;
        this.shadowUpdateOverrides = null;
        this._isVsm = false;
        this._isPcf = true;

        this._softShadowParams = new Float32Array(4);
        this.shadowSamples = 16;
        this.shadowBlockerSamples = 16;
        this.penumbraSize = 1.0;
        this.penumbraFalloff = 1.0;

        // cookie matrix (used in case the shadow mapping is disabled and so the shadow matrix cannot be used)
        this._cookieMatrix = null;

        // viewport of the cookie texture / shadow in the atlas
        this._atlasViewport = null;
        this.atlasViewportAllocated = false;    // if true, atlas slot is allocated for the current frame
        this.atlasVersion = 0;      // version of the atlas for the allocated slot, allows invalidation when atlas recreates slots
        this.atlasSlotIndex = 0;    // allocated slot index, used for more persistent slot allocation
        this.atlasSlotUpdated = false;  // true if the atlas slot was reassigned this frame (and content needs to be updated)

        this._node = null;

        // private rendering data
        this._renderData = [];

        // true if the light is visible by any camera within a frame
        this.visibleThisFrame = false;

        // maximum size of the light bounding sphere on the screen by any camera within a frame
        // (used to estimate shadow resolution), range [0..1]
        this.maxScreenSize = 0;

        this._updateShadowBias();
    }

    destroy() {
        this._evtDeviceRestored?.off();
        this._evtDeviceRestored = null;

        this._destroyShadowMap();

        this.releaseRenderData();
        this._renderData = null;
    }

    onDeviceRestored() {
        // when context is restored, re-render shadow map
        if (this.shadowUpdateMode === SHADOWUPDATE_NONE) {
            this.shadowUpdateMode = SHADOWUPDATE_THISFRAME;
        }
    }

    releaseRenderData() {

        if (this._renderData) {
            for (let i = 0; i < this._renderData.length; i++) {
                this._renderData[i].destroy();
            }

            this._renderData.length = 0;
        }
    }

    addLayer(layer) {
        this.layers.add(layer);
    }

    removeLayer(layer) {
        this.layers.delete(layer);
    }

    set shadowSamples(value) {
        this._softShadowParams[0] = value;
    }

    get shadowSamples() {
        return this._softShadowParams[0];
    }

    set shadowBlockerSamples(value) {
        this._softShadowParams[1] = value;
    }

    get shadowBlockerSamples() {
        return this._softShadowParams[1];
    }

    set shadowBias(value) {
        if (this._shadowBias !== value) {
            this._shadowBias = value;
            this._updateShadowBias();
        }
    }

    get shadowBias() {
        return this._shadowBias;
    }

    set numCascades(value) {
        if (!this.cascades || this.numCascades !== value) {
            this.cascades = directionalCascades[value - 1];
            this._shadowMatrixPalette = new Float32Array(4 * 16);   // always 4
            this._shadowCascadeDistances = new Float32Array(4);     // always 4
            this._destroyShadowMap();
            this.updateKey();
        }
    }

    get numCascades() {
        return this.cascades.length;
    }

    set cascadeBlend(value) {
        if (this._cascadeBlend !== value) {
            this._cascadeBlend = value;
            this.updateKey();
        }
    }

    get cascadeBlend() {
        return this._cascadeBlend;
    }

    set shadowMap(shadowMap) {
        if (this._shadowMap !== shadowMap) {
            this._destroyShadowMap();
            this._shadowMap = shadowMap;
        }
    }

    get shadowMap() {
        return this._shadowMap;
    }

    set mask(value) {
        if (this._mask !== value) {
            this._mask = value;
            this.updateKey();
            this.updateClusteredFlags();
        }
    }

    get mask() {
        return this._mask;
    }

    // returns number of render targets to render the shadow map
    get numShadowFaces() {
        const type = this._type;
        if (type === LIGHTTYPE_DIRECTIONAL) {
            return this.numCascades;
        } else if (type === LIGHTTYPE_OMNI) {
            return 6;
        }

        return 1;
    }

    set type(value) {
        if (this._type === value) {
            return;
        }

        this._type = value;
        this._destroyShadowMap();
        this._updateShadowBias();
        this.updateKey();
        this.updateClusteredFlags();

        const stype = this._shadowType;
        this._shadowType = null;
        this.shadowUpdateOverrides = null;
        this.shadowType = stype; // refresh shadow type; switching from direct/spot to omni and back may change it
    }

    get type() {
        return this._type;
    }

    set shape(value) {
        if (this._shape === value) {
            return;
        }

        this._shape = value;
        this._destroyShadowMap();
        this.updateKey();
        this.updateClusteredFlags();

        const stype = this._shadowType;
        this._shadowType = null;
        this.shadowType = stype; // refresh shadow type; switching shape and back may change it
    }

    get shape() {
        return this._shape;
    }

    set usePhysicalUnits(value) {
        if (this._usePhysicalUnits !== value) {
            this._usePhysicalUnits = value;
            this._updateLinearColor();
        }
    }

    get usePhysicalUnits() {
        return this._usePhysicalUnits;
    }

    set shadowType(value) {
        if (this._shadowType === value) {
            return;
        }

        // unsupported shadow type
        let shadowInfo = shadowTypeInfo.get(value);
        if (!shadowInfo) {
            value = SHADOW_PCF3_32F;
        }

        const device = this.device;

        // PCSS requires filterable F32 render targets
        if (value === SHADOW_PCSS_32F && (!device.textureFloatRenderable || !device.textureFloatFilterable)) {
            value = SHADOW_PCF3_32F;
        }

        // omni light supports PCF1, PCF3 and PCSS only
        if (this._type === LIGHTTYPE_OMNI && value !== SHADOW_PCF1_32F && value !== SHADOW_PCF3_32F &&
            value !== SHADOW_PCF1_16F && value !== SHADOW_PCF3_16F && value !== SHADOW_PCSS_32F) {
            value = SHADOW_PCF3_32F;
        }

        // fallback from vsm32 to vsm16
        if (value === SHADOW_VSM_32F && (!device.textureFloatRenderable || !device.textureFloatFilterable)) {
            value = SHADOW_VSM_16F;
        }

        // fallback from vsm16 to pcf3
        if (value === SHADOW_VSM_16F && !device.textureHalfFloatRenderable) {
            value = SHADOW_PCF3_32F;
        }

        shadowInfo = shadowTypeInfo.get(value);
        this._isVsm = shadowInfo?.vsm ?? false;
        this._isPcf = shadowInfo?.pcf ?? false;

        this._shadowType = value;
        this._destroyShadowMap();
        this.updateKey();
    }

    get shadowType() {
        return this._shadowType;
    }

    set enabled(value) {
        if (this._enabled !== value) {
            this._enabled = value;
            this.layersDirty();
        }
    }

    get enabled() {
        return this._enabled;
    }

    set castShadows(value) {
        if (this._castShadows !== value) {
            this._castShadows = value;
            this._destroyShadowMap();
            this.layersDirty();
            this.updateKey();
        }
    }

    get castShadows() {
        return this._castShadows && this._mask !== MASK_BAKE && this._mask !== 0;
    }

    set shadowIntensity(value) {
        if (this._shadowIntensity !== value) {
            this._shadowIntensity = value;
            this.updateKey();
        }
    }

    get shadowIntensity() {
        return this._shadowIntensity;
    }

    get bakeShadows() {
        return this._castShadows && this._mask === MASK_BAKE;
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

    get shadowResolution() {
        return this._shadowResolution;
    }

    set vsmBlurSize(value) {
        if (this._vsmBlurSize === value) {
            return;
        }

        if (value % 2 === 0) value++; // don't allow even size
        this._vsmBlurSize = value;
    }

    get vsmBlurSize() {
        return this._vsmBlurSize;
    }

    set normalOffsetBias(value) {
        if (this._normalOffsetBias !== value) {
            const dirty = (!this._normalOffsetBias && value) || (this._normalOffsetBias && !value);
            this._normalOffsetBias = value;

            if (dirty) {
                this.updateKey();
            }
        }
    }

    get normalOffsetBias() {
        return this._normalOffsetBias;
    }

    set falloffMode(value) {
        if (this._falloffMode === value) {
            return;
        }

        this._falloffMode = value;
        this.updateKey();
        this.updateClusteredFlags();
    }

    get falloffMode() {
        return this._falloffMode;
    }

    set innerConeAngle(value) {
        if (this._innerConeAngle === value) {
            return;
        }

        this._innerConeAngle = value;
        this._innerConeAngleCos = Math.cos(value * Math.PI / 180);
        this.updateClusterData(false, true);

        if (this._usePhysicalUnits) {
            this._updateLinearColor();
        }
    }

    get innerConeAngle() {
        return this._innerConeAngle;
    }

    set outerConeAngle(value) {
        if (this._outerConeAngle === value) {
            return;
        }

        this._outerConeAngle = value;
        this._updateOuterAngle(value);

        if (this._usePhysicalUnits) {
            this._updateLinearColor();
        }
    }

    get outerConeAngle() {
        return this._outerConeAngle;
    }

    set penumbraSize(value) {
        this._penumbraSize = value;
        this._softShadowParams[2] = value;
    }

    get penumbraSize() {
        return this._penumbraSize;
    }

    set penumbraFalloff(value) {
        this._softShadowParams[3] = value;
    }

    get penumbraFalloff() {
        return this._softShadowParams[3];
    }

    _updateOuterAngle(angle) {
        const radAngle = angle * Math.PI / 180;
        this._outerConeAngleCos = Math.cos(radAngle);
        this._outerConeAngleSin = Math.sin(radAngle);
        this.updateClusterData(false, true);
    }

    set intensity(value) {
        if (this._intensity !== value) {
            this._intensity = value;
            this._updateLinearColor();
        }
    }

    get intensity() {
        return this._intensity;
    }

    set affectSpecularity(value) {
        if (this._type === LIGHTTYPE_DIRECTIONAL) {
            this._affectSpecularity = value;
            this.updateKey();
        }
    }

    get affectSpecularity() {
        return this._affectSpecularity;
    }

    set luminance(value) {
        if (this._luminance !== value) {
            this._luminance = value;
            this._updateLinearColor();
        }
    }

    get luminance() {
        return this._luminance;
    }

    get cookieMatrix() {
        if (!this._cookieMatrix) {
            this._cookieMatrix = new Mat4();
        }
        return this._cookieMatrix;
    }

    get atlasViewport() {
        if (!this._atlasViewport) {
            this._atlasViewport = new Vec4(0, 0, 1, 1);
        }
        return this._atlasViewport;
    }

    set cookie(value) {
        if (this._cookie === value) {
            return;
        }

        this._cookie = value;
        this.updateKey();
    }

    get cookie() {
        return this._cookie;
    }

    set cookieFalloff(value) {
        if (this._cookieFalloff === value) {
            return;
        }

        this._cookieFalloff = value;
        this.updateKey();
    }

    get cookieFalloff() {
        return this._cookieFalloff;
    }

    set cookieChannel(value) {
        if (this._cookieChannel === value) {
            return;
        }

        if (value.length < 3) {
            const chr = value.charAt(value.length - 1);
            const addLen = 3 - value.length;
            for (let i = 0; i < addLen; i++) {
                value += chr;
            }
        }
        this._cookieChannel = value;
        this.updateKey();
        this.updateClusteredFlags();
    }

    get cookieChannel() {
        return this._cookieChannel;
    }

    set cookieTransform(value) {
        if (this._cookieTransform === value) {
            return;
        }

        this._cookieTransform = value;
        this._cookieTransformSet = !!value;
        if (value && !this._cookieOffset) {
            this.cookieOffset = new Vec2(); // using transform forces using offset code
            this._cookieOffsetSet = false;
        }
        this.updateKey();
    }

    get cookieTransform() {
        return this._cookieTransform;
    }

    set cookieOffset(value) {
        if (this._cookieOffset === value) {
            return;
        }

        const xformNew = !!(this._cookieTransformSet || value);
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

    get cookieOffset() {
        return this._cookieOffset;
    }

    // prepares light for the frame rendering
    beginFrame() {
        this.visibleThisFrame = this._type === LIGHTTYPE_DIRECTIONAL && this._enabled;
        this.maxScreenSize = 0;
        this.atlasViewportAllocated = false;
        this.atlasSlotUpdated = false;
    }

    // destroys shadow map related resources, called when shadow properties change and resources
    // need to be recreated
    _destroyShadowMap() {

        this.releaseRenderData();

        if (this._shadowMap) {
            if (!this._shadowMap.cached) {
                this._shadowMap.destroy();
            }
            this._shadowMap = null;
        }

        if (this.shadowUpdateMode === SHADOWUPDATE_NONE) {
            this.shadowUpdateMode = SHADOWUPDATE_THISFRAME;
        }

        if (this.shadowUpdateOverrides) {
            for (let i = 0; i < this.shadowUpdateOverrides.length; i++) {
                if (this.shadowUpdateOverrides[i] === SHADOWUPDATE_NONE) {
                    this.shadowUpdateOverrides[i] = SHADOWUPDATE_THISFRAME;
                }
            }
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
        const rd = new LightRenderData(camera, face, this);
        this._renderData.push(rd);
        return rd;
    }

    /**
     * Duplicates a light node but does not 'deep copy' the hierarchy.
     *
     * @returns {Light} A cloned Light.
     */
    clone() {
        const clone = new Light(this.device, this.clusteredLighting);

        // Clone Light properties
        clone.type = this._type;
        clone.setColor(this._color);
        clone.intensity = this._intensity;
        clone.affectSpecularity = this._affectSpecularity;
        clone.luminance = this._luminance;
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

        if (this.shadowUpdateOverrides) {
            clone.shadowUpdateOverrides = this.shadowUpdateOverrides.slice();
        }

        // Spot properties
        clone.innerConeAngle = this._innerConeAngle;
        clone.outerConeAngle = this._outerConeAngle;

        // Directional properties
        clone.numCascades = this.numCascades;
        clone.cascadeDistribution = this.cascadeDistribution;
        clone.cascadeBlend = this._cascadeBlend;

        // shape properties
        clone.shape = this._shape;

        // Shadow properties
        clone.shadowDepthState.copy(this.shadowDepthState);
        clone.shadowBias = this.shadowBias;
        clone.normalOffsetBias = this._normalOffsetBias;
        clone.shadowResolution = this._shadowResolution;
        clone.shadowDistance = this.shadowDistance;
        clone.shadowIntensity = this.shadowIntensity;

        clone.shadowSamples = this.shadowSamples;
        clone.shadowBlockerSamples = this.shadowBlockerSamples;
        clone.penumbraSize = this.penumbraSize;
        clone.penumbraFalloff = this.penumbraFalloff;

        // Cookies properties
        // clone.cookie = this._cookie;
        // clone.cookieIntensity = this.cookieIntensity;
        // clone.cookieFalloff = this._cookieFalloff;
        // clone.cookieChannel = this._cookieChannel;
        // clone.cookieTransform = this._cookieTransform;
        // clone.cookieOffset = this._cookieOffset;

        return clone;
    }

    /**
     * Get conversion factor for luminance -> light specific light unit.
     *
     * @param {number} type - The type of light.
     * @param {number} [outerAngle] - The outer angle of a spot light.
     * @param {number} [innerAngle] - The inner angle of a spot light.
     * @returns {number} The scaling factor to multiply with the luminance value.
     */
    static getLightUnitConversion(type, outerAngle = Math.PI / 4, innerAngle = 0) {
        switch (type) {
            case LIGHTTYPE_SPOT: {
                const falloffEnd = Math.cos(outerAngle);
                const falloffStart = Math.cos(innerAngle);

                // https://github.com/mmp/pbrt-v4/blob/faac34d1a0ebd24928828fe9fa65b65f7efc5937/src/pbrt/lights.cpp#L1463
                return (2 * Math.PI * ((1 - falloffStart) + (falloffStart - falloffEnd) / 2.0));
            }
            case LIGHTTYPE_OMNI:
                // https://google.github.io/filament/Filament.md.html#lighting/directlighting/punctuallights/pointlights
                return (4 * Math.PI);
            case LIGHTTYPE_DIRECTIONAL:
                // https://google.github.io/filament/Filament.md.html#lighting/directlighting/directionallights
                return 1;
        }
    }

    // returns the bias (.x) and normalBias (.y) value for lights as passed to shaders by uniforms
    // Note: this needs to be revisited and simplified
    // Note: vsmBias is not used at all for omni light, even though it is editable in the Editor
    _getUniformBiasValues(lightRenderData) {

        const farClip = lightRenderData.shadowCamera._farClip;

        switch (this._type) {
            case LIGHTTYPE_OMNI:
                tmpBiases.bias = this.shadowBias;
                tmpBiases.normalBias = this._normalOffsetBias;
                break;
            case LIGHTTYPE_SPOT:
                if (this._isVsm) {
                    tmpBiases.bias = -0.00001 * 20;
                } else {
                    tmpBiases.bias = this.shadowBias * 20; // approx remap from old bias values
                }
                tmpBiases.normalBias = this._isVsm ? this.vsmBias / (this.attenuationEnd / 7.0) : this._normalOffsetBias;
                break;
            case LIGHTTYPE_DIRECTIONAL:
                // make bias dependent on far plane because it's not constant for direct light
                // clip distance used is based on the nearest shadow cascade
                if (this._isVsm) {
                    tmpBiases.bias = -0.00001 * 20;
                } else {
                    tmpBiases.bias = (this.shadowBias / farClip) * 100;
                }
                tmpBiases.normalBias = this._isVsm ? this.vsmBias / (farClip / 7.0) : this._normalOffsetBias;
                break;
        }

        return tmpBiases;
    }

    getColor() {
        return this._color;
    }

    getBoundingSphere(sphere) {
        if (this._type === LIGHTTYPE_SPOT) {

            // based on https://bartwronski.com/2017/04/13/cull-that-cone/
            const size = this.attenuationEnd;
            const angle = this._outerConeAngle;
            const cosAngle = this._outerConeAngleCos;
            const node = this._node;
            tmpVec.copy(node.up);

            if (angle > 45) {
                sphere.radius = size * this._outerConeAngleSin;
                tmpVec.mulScalar(-size * cosAngle);
            } else {
                sphere.radius = size / (2 * cosAngle);
                tmpVec.mulScalar(-sphere.radius);
            }

            sphere.center.add2(node.getPosition(), tmpVec);

        } else if (this._type === LIGHTTYPE_OMNI) {
            sphere.center = this._node.getPosition();
            sphere.radius = this.attenuationEnd;
        }
    }

    getBoundingBox(box) {
        if (this._type === LIGHTTYPE_SPOT) {
            const range = this.attenuationEnd;
            const angle = this._outerConeAngle;
            const node = this._node;

            const scl = Math.abs(Math.sin(angle * math.DEG_TO_RAD) * range);

            box.center.set(0, -range * 0.5, 0);
            box.halfExtents.set(scl, range * 0.5, scl);

            box.setFromTransformedAabb(box, node.getWorldTransform(), true);

        } else if (this._type === LIGHTTYPE_OMNI) {
            box.center.copy(this._node.getPosition());
            box.halfExtents.set(this.attenuationEnd, this.attenuationEnd, this.attenuationEnd);
        }
    }

    _updateShadowBias() {
        if (this._type === LIGHTTYPE_OMNI && !this.clusteredLighting) {
            this.shadowDepthState.depthBias = 0;
            this.shadowDepthState.depthBiasSlope = 0;
        } else {
            const bias = this.shadowBias * -1000.0;
            this.shadowDepthState.depthBias = bias;
            this.shadowDepthState.depthBiasSlope = bias;
        }
    }

    _updateLinearColor() {

        let intensity = this._intensity;

        // To calculate the lux, which is lm/m^2, we need to convert from luminous power
        if (this._usePhysicalUnits) {
            intensity = this._luminance / Light.getLightUnitConversion(this._type, this._outerConeAngle * math.DEG_TO_RAD, this._innerConeAngle * math.DEG_TO_RAD);
        }

        // Note: This is slightly unconventional, ideally we'd convert color to linear space and then
        // multiply by intensity, but keeping this for backwards compatibility
        const color = this._color;
        const colorLinear = this._colorLinear;
        if (intensity >= 1) {
            tmpColor.linear(color).mulScalar(intensity);
        } else {
            tmpColor.copy(color).mulScalar(intensity).linear();
        }

        colorLinear[0] = tmpColor.r;
        colorLinear[1] = tmpColor.g;
        colorLinear[2] = tmpColor.b;

        this.updateClusterData(true);
    }

    setColor() {
        if (arguments.length === 1) {
            this._color.set(arguments[0].r, arguments[0].g, arguments[0].b);
        } else if (arguments.length === 3) {
            this._color.set(arguments[0], arguments[1], arguments[2]);
        }

        this._updateLinearColor();
    }

    layersDirty() {
        this.layers.forEach((layer) => {
            if (layer.hasLight(this)) {
                layer.markLightsDirty();
            }
        });
    }

    /**
     * Updates a integer key for the light. The key is used to identify all shader related features
     * of the light, and so needs to have all properties that modify the generated shader encoded.
     * Properties without an effect on the shader (color, shadow intensity) should not be encoded.
     */
    updateKey() {
        // Key definition:
        // Bit
        // 31      : sign bit (leave)
        // 29 - 30 : type
        // 25 - 28 : shadow type
        // 23 - 24 : falloff mode
        // 22      : normal offset bias
        // 21      : cookie
        // 20      : cookie falloff
        // 18 - 19 : cookie channel R
        // 16 - 17 : cookie channel G
        // 14 - 15 : cookie channel B
        // 12      : cookie transform
        // 10 - 11 : light source shape
        //  9      : use cascades
        //  8      : cascade blend
        //  7      : disable specular
        //  6 -  4 : mask
        //  3      : cast shadows
        let key =
               (this._type                                << 29) |
               (this._shadowType                          << 25) |
               (this._falloffMode                         << 23) |
               ((this._normalOffsetBias !== 0.0 ? 1 : 0)  << 22) |
               ((this._cookie ? 1 : 0)                    << 21) |
               ((this._cookieFalloff ? 1 : 0)             << 20) |
               (chanId[this._cookieChannel.charAt(0)]     << 18) |
               ((this._cookieTransform ? 1 : 0)           << 12) |
               ((this._shape)                             << 10) |
               ((this.numCascades > 0 ? 1 : 0)            <<  9) |
               ((this._cascadeBlend > 0 ? 1 : 0)          <<  8) |
               ((this.affectSpecularity ? 1 : 0)          <<  7) |
               ((this.mask)                               <<  6) |
               ((this._castShadows ? 1 : 0)               <<  3);

        if (this._cookieChannel.length === 3) {
            key |= (chanId[this._cookieChannel.charAt(1)] << 16);
            key |= (chanId[this._cookieChannel.charAt(2)] << 14);
        }

        if (key !== this.key) {
            // The layer maintains lights split and sorted by the key, notify it when the key changes
            this.layersDirty();
        }

        this.key = key;
    }

    /**
     * Updates 32bit flags used by the clustered lighting. This only stores constant data.
     * Note: this needs to match shader code in clusteredLight.js
     */
    updateClusteredFlags() {

        const isDynamic = !!(this.mask & MASK_AFFECT_DYNAMIC);
        const isLightmapped = !!(this.mask & MASK_AFFECT_LIGHTMAPPED);

        this.clusteredFlags =
            ((this.type === LIGHTTYPE_SPOT ? 1 : 0)         << 30) |        // bits 30
            ((this._shape & 0x3)                            << 28) |        // bits 29 - 28
            ((this._falloffMode & 0x1)                      << 27) |        // bits 27
            ((channelMap[this._cookieChannel] ?? 0)         << 23) |        // bits 26 - 23
            ((isDynamic ? 1 : 0)                            << 22) |        // bits 22
            ((isLightmapped ? 1 : 0)                        << 21);         // bits 21
    }

    /**
     * Adds per-frame dynamic data to the 32bit flags used by the clustered lighting.
     */
    getClusteredFlags(castShadows, useCookie) {
        return this.clusteredFlags |
            ((castShadows ? Math.floor(this.shadowIntensity * 255) : 0) & 0xFF) << 0 |   // bits 7 - 0
            ((useCookie ? Math.floor(this.cookieIntensity * 255) : 0) & 0xFF) << 8;      // bits 15 - 8
    }

    updateClusterData(updateColor, updateAngles) {
        const { clusteredData16 } = this;
        const float2Half = FloatPacking.float2Half;

        if (updateColor) {
            // bring HDR color to half-float range, as those values can be over 65K
            clusteredData16[0] = float2Half(math.clamp(this._colorLinear[0] / LIGHT_COLOR_DIVIDER, 0, 65504));
            clusteredData16[1] = float2Half(math.clamp(this._colorLinear[1] / LIGHT_COLOR_DIVIDER, 0, 65504));
            clusteredData16[2] = float2Half(math.clamp(this._colorLinear[2] / LIGHT_COLOR_DIVIDER, 0, 65504));
            // unused 16bits here
        }

        if (updateAngles) {
            // To store cone angles with full precision in half-floats, we use a hybrid encoding.
            // For small angles, cos(angle) is close to 1.0, where half-float precision is low.
            // For these, we store 1.0 - cos(angle) (versine), which is close to 0.0 and has high precision.
            // For larger angles, we store cos(angle) directly. Two flag bits indicate the format.
            const cosThreshold = 0.5;
            let flags = 0;

            // Shrink angles slightly (~1%) to prevent light leaking outside shadow boundaries
            const angleShrinkFactor = 0.99;
            let innerCos = Math.cos(this._innerConeAngle * angleShrinkFactor * Math.PI / 180);
            if (innerCos > cosThreshold) {
                innerCos = 1.0 - innerCos;
                flags |= 1; // Use bit 0 for inner angle: 1 = versine, 0 = cosine
            }

            let outerCos = Math.cos(this._outerConeAngle * angleShrinkFactor * Math.PI / 180);
            if (outerCos > cosThreshold) {
                outerCos = 1.0 - outerCos;
                flags |= 2; // Use bit 1 for outer angle: 1 = versine, 0 = cosine
            }

            // Store flags as integer bits
            clusteredData16[3] = flags;

            // Store encoded inner and outer values
            clusteredData16[4] = float2Half(innerCos);
            clusteredData16[5] = float2Half(outerCos);
        }
    }
}

export { Light, lightTypes };
