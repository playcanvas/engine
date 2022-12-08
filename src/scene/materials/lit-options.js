import { Debug } from 'src/core/debug.js';
import {
    BLEND_NONE, GAMMA_NONE
} from '../constants.js';

/**
 * @property {object} chunks Object containing custom shader chunks that will replace default ones.
 * @property {string} customFragmentShader Replaced the whole fragment shader with this string.
 * @property {number} fog The type of fog being applied in the shader. See {@link Scene#fog} for the list of
 * possible values.
 * @property {number} gamma The type of gamma correction being applied in the shader. See
 * {@link Scene#gammaCorrection} for the list of possible values.
 * @property {number} toneMap The type of tone mapping being applied in the shader. See {@link Scene#toneMapping}
 * for the list of possible values.
 * @property {boolean} conserveEnergy The value of {@link StandardMaterial#conserveEnergy}.
 * @property {number} occludeSpecular The value of {@link StandardMaterial#occludeSpecular}.
 * @property {boolean} occludeDirect The value of {@link StandardMaterial#occludeDirect}.
 * @property {number} shadingModel The value of {@link StandardMaterial#shadingModel}.
 * @property {number} fresnelModel The value of {@link StandardMaterial#fresnelModel}.
 * @property {number} cubeMapProjection The value of {@link StandardMaterial#cubeMapProjection}.
 * @property {boolean} useMetalness The value of {@link StandardMaterial#useMetalness}.
 * @property {number} blendType The value of {@link Material#blendType}.
 * @property {boolean} twoSidedLighting The value of {@link Material#twoSidedLighting}.
 * @property {number} occludeSpecularFloat Defines if {@link StandardMaterial#occludeSpecularIntensity} constant
 * should affect specular occlusion.
 * @property {boolean} alphaTest Enable alpha testing. See {@link Material#alphaTest}.
 * @property {boolean} alphaToCoverage Enable alpha to coverage. See {@link Material#alphaToCoverage}.
 * @property {boolean} opacityFadesSpecular Enable specular fade. See {@link Material#opacityFadesSpecular}.
 * @property {float} ambientSH If ambient spherical harmonics are used. Ambient SH replace prefiltered cubemap
 * ambient on certain platform (mostly Android) for performance reasons.
 * @property {boolean} useSpecular If any specular or reflections are needed at all.
 * @property {boolean} fixSeams If cubemaps require seam fixing (see {@link Texture#options.fixCubemapSeams}).
 * @property {string} forceFragmentPrecision Override fragment shader numeric precision. Can be "lowp", "mediump",
 * "highp" or null to use default.
 * @property {boolean} fastTbn Use slightly cheaper normal mapping code (skip tangent space normalization). Can look
 * buggy sometimes.
 * @property {boolean} useRefraction If refraction is used.
 * @property {number} skyboxIntensity If reflected skybox intensity should be modulated.
 * @property {boolean} useCubeMapRotation If cube map rotation is enabled.
 * @property {boolean} useInstancing If hardware instancing compatible shader should be generated. Transform is read
 * from per-instance {@link VertexBuffer} instead of shader's uniforms.
 * @property {boolean} useMorphPosition If morphing code should be generated to morph positions.
 * @property {boolean} useMorphNormal If morphing code should be generated to morph normals.
 * @property {string} reflectionSource One of "envAtlasHQ", "envAtlas", "cubeMap", "sphereMap"
 * @property {boolean} ambientSource One of "ambientSH", "envAtlas", "constant"
 */
class LitOptions {
    constructor() {
        this.hasTangents = false;
        this.chunks = [];

        this._pass = 0;
        this.alphaTest = false;
        this.forceFragmentPrecision = false;
        this.blendType = BLEND_NONE;
        this.separateAmbient = false;
        this.screenSpace = false;
        this.skin = false;
        this.useInstancing = false;
        this.useMorphPosition = false;
        this.useMorphNormal = false;
        this.useMorphTextureBased = false;

        this.nineSlicedMode = false;

        this.clusteredLightingEnabled = true;

        this.clusteredLightingCookiesEnabled = false;
        this.clusteredLightingShadowsEnabled = false;
        this.clusteredLightingShadowType = 0;
        this.clusteredLightingAreaLightsEnabled = false;

        this.vertexColors = false;
        this.lightMapEnabled = false;
        this.useLightMapVertexColors = false;
        this.dirLightMapEnabled = false;
        this.heightMapEnabled = false;
        this.normalMapEnabled = false;
        this.clearCoatNormalMapEnabled = false;
        this.aoMapEnabled = false;
        this.useAoVertexColors = false;
        this.diffuseMapEnabled = false;

        this.useAmbientTint = false;
        this.customFragmentShader = null;
        this.pixelSnap = false;

        this.useClearCoatNormalMap = false;
        this.useDiffuseMap = false;
        this.useAoMap = false;

        this.detailModes = 0;
        this.shadingModel = 0;
        this.ambientSH = false;
        this.fastTbn = false;
        this.twoSidedLighting = false;
        this.occludeSpecular = false;
        this.occludeSpecularFloat = false;

        this.useMsdf = false;
        this.msdfTextAttribute = 0;

        this.alphaToCoverage = false;
        this.opacityFadesSpecular = false;

        this.cubeMapProjection = false;

        this.occludeDirect = false;
        this.conserveEnergy = false;
        this.useSpecular = false;
        this.useSpecularityFactor = false;
        this.useSpecularColor = false;
        this.enableGGXSpecular = false;
        this.fresnelModel = 0;
        this.useRefraction = false;
        this.useClearCoat = false;
        this.useSheen = false;
        this.useIridescence = false;
        this.useMetalness = false;
        this.useDynamicRefraction = false;

        this.fog = 'none';
        this.gamma = GAMMA_NONE;
        this.toneMap = -1;
        this.fixSeams = false;

        this.reflectionSource = null;
        this.reflectionEncoding = null;
        this.ambientSource = 'constant';
        this.ambientEncoding = null;

        // TODO: add a test for if non skybox cubemaps have rotation (when this is supported) - for now assume no non-skybox cubemap rotation
        this.skyboxIntensity = 1.0;
        this.useCubeMapRotation = false;

        this.lightMapWithoutAmbient = false;

        this.lights = [];
        this.noShadow = false;
        this.lightMaskDynamic = 0x0;
    }

    set pass(p) {
        Debug.warn(`pc.LitOptions#pass should be set by its parent pc.StandardMaterialOptions, setting it directly has no effect.`);
    }

    get pass() {
        Debug.warn(`pc.LitOptions#pass should be accessed by its parent pc.StandardMaterialOptions.`);
        return 0;
    }
}

export { LitOptions };
