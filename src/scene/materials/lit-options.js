import { Debug } from '../../core/debug.js';
import {
    BLEND_NONE, FOG_NONE, GAMMA_NONE
} from '../constants.js';

/**
 * The lit options determines how the lit-shader gets generated. It specifies a set of
 * parameters which triggers different fragment and vertex shader generation in the backend.
 */
class LitOptions {
    hasTangents = false;

    /**
     * Object containing custom shader chunks that will replace default ones.
     *
     * @type {Object<string, string>}
     */
    chunks = {};

    _pass = 0;

    /**
     * Enable alpha testing. See {@link Material#alphaTest}.
     *
     * @type {boolean}
     */
    alphaTest = false;

    /**
     * Override fragment shader numeric precision. Can be "lowp", "mediump", "highp" or null to use
     * default.
     *
     * @type {string}
     */
    forceFragmentPrecision = null;

    /**
     * The value of {@link Material#blendType}.
     *
     * @type {number}
     */
    blendType = BLEND_NONE;

    separateAmbient = false;

    screenSpace = false;

    skin = false;

    /**
     * If hardware instancing compatible shader should be generated. Transform is read from
     * per-instance {@link VertexBuffer} instead of shader's uniforms.
     *
     * @type {boolean}
     */
    useInstancing = false;

    /**
     * If morphing code should be generated to morph positions.
     *
     * @type {boolean}
     */
    useMorphPosition = false;

    /**
     * If morphing code should be generated to morph normals.
     *
     * @type {boolean}
     */
    useMorphNormal = false;

    useMorphTextureBased = false;

    nineSlicedMode = 0;

    clusteredLightingEnabled = true;

    clusteredLightingCookiesEnabled = false;

    clusteredLightingShadowsEnabled = false;

    clusteredLightingShadowType = 0;

    clusteredLightingAreaLightsEnabled = false;

    vertexColors = false;

    lightMapEnabled = false;

    useLightMapVertexColors = false;

    dirLightMapEnabled = false;

    heightMapEnabled = false;

    normalMapEnabled = false;

    clearCoatNormalMapEnabled = false;

    aoMapEnabled = false;

    useAoVertexColors = false;

    diffuseMapEnabled = false;

    useAmbientTint = false;

    /**
     * Replaced the whole fragment shader with this string.
     *
     * @type {string}
     */
    customFragmentShader = null;

    pixelSnap = false;

    useClearCoatNormalMap = false;

    useDiffuseMap = false;

    useAoMap = false;

    detailModes = 0;

    /**
     * The value of {@link StandardMaterial#shadingModel}.
     *
     * @type {number}
     */
    shadingModel = 0;

    /**
     * If ambient spherical harmonics are used. Ambient SH replace prefiltered cubemap ambient on
     * certain platforms (mostly Android) for performance reasons.
     *
     * @type {boolean}
     */
    ambientSH = false;

    /**
     * Use slightly cheaper normal mapping code (skip tangent space normalization). Can look buggy
     * sometimes.
     *
     * @type {boolean}
     */
    fastTbn = false;

    /**
     * The value of {@link Material#twoSidedLighting}.
     *
     * @type {boolean}
     */
    twoSidedLighting = false;

    /**
     * The value of {@link StandardMaterial#occludeSpecular}.
     *
     * @type {number}
     */
    occludeSpecular = 0;

    /**
     * Defines if {@link StandardMaterial#occludeSpecularIntensity} constant should affect specular
     * occlusion.
     *
     * @type {boolean}
     */
    occludeSpecularFloat = false;

    useMsdf = false;

    msdfTextAttribute = 0;

    /**
     * Enable alpha to coverage. See {@link Material#alphaToCoverage}.
     *
     * @type {boolean}
     */
    alphaToCoverage = false;

    /**
     * Enable specular fade. See {@link Material#opacityFadesSpecular}.
     *
     * @type {boolean}
     */
    opacityFadesSpecular = false;

    /**
     * The value of {@link StandardMaterial#cubeMapProjection}.
     *
     * @type {number}
     */
    cubeMapProjection = 0;

    /**
     * The value of {@link StandardMaterial#occludeDirect}.
     *
     * @type {boolean}
     */
    occludeDirect = false;

    /**
     * The value of {@link StandardMaterial#conserveEnergy}.
     *
     * @type {boolean}
     */
    conserveEnergy = false;

    /**
     * If any specular or reflections are needed at all.
     *
     * @type {boolean}
     */
    useSpecular = false;

    useSpecularityFactor = false;

    useSpecularColor = false;

    enableGGXSpecular = false;

    /**
     * The value of {@link StandardMaterial#fresnelModel}.
     *
     * @type {number}
     */
    fresnelModel = 0;

    /**
     * If refraction is used.
     *
     * @type {boolean}
     */
    useRefraction = false;

    useClearCoat = false;

    useSheen = false;

    useIridescence = false;

    /**
     * The value of {@link StandardMaterial#useMetalness}.
     *
     * @type {boolean}
     */
    useMetalness = false;

    useDynamicRefraction = false;

    /**
     * The type of fog being applied in the shader. See {@link Scene#fog} for the list of possible
     * values.
     *
     * @type {string}
     */
    fog = FOG_NONE;

    /**
     * The type of gamma correction being applied in the shader. See {@link Scene#gammaCorrection}
     * for the list of possible values.
     *
     * @type {number}
     */
    gamma = GAMMA_NONE;

    /**
     * The type of tone mapping being applied in the shader. See {@link Scene#toneMapping} for the
     * list of possible values.
     *
     * @type {number}
     */
    toneMap = -1;

    /**
     * If cubemaps require seam fixing (see {@link Texture#options.fixCubemapSeams}).
     *
     * @type {boolean}
     */
    fixSeams = false;

    /**
     * One of "envAtlasHQ", "envAtlas", "cubeMap", "sphereMap".
     *
     * @type {string}
     */
    reflectionSource = null;

    reflectionEncoding = null;

    /**
     * One of "ambientSH", "envAtlas", "constant".
     *
     * @type {string}
     */
    ambientSource = 'constant';

    ambientEncoding = null;

    // TODO: add a test for if non skybox cubemaps have rotation (when this is supported) - for now
    // assume no non-skybox cubemap rotation
    /**
     * Skybox intensity factor.
     *
     * @type {number}
     */
    skyboxIntensity = 1.0;

    /**
     * If cube map rotation is enabled.
     *
     * @type {boolean}
     */
    useCubeMapRotation = false;

    lightMapWithoutAmbient = false;

    lights = [];

    noShadow = false;

    lightMaskDynamic = 0x0;

    set pass(p) {
        Debug.warn(`pc.LitOptions#pass should be set by its parent pc.StandardMaterialOptions, setting it directly has no effect.`);
    }

    get pass() {
        return this._pass;
    }
}

export { LitOptions };
