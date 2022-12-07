import {
    BLEND_NONE, GAMMA_NONE
} from '../constants.js';

/**
 * - pass: value of {@link Layer#shaderPass} of the Layer being rendered.
 * - chunks: Object containing custom shader chunks that will replace default ones.
 * - customFragmentShader: Completely replace fragment shader with this code.
 * - fog: the type of fog being applied in the shader. See {@link Scene#fog} for the list of
 * possible values.
 * - gamma: the type of gamma correction being applied in the shader. See
 * {@link Scene#gammaCorrection} for the list of possible values.
 * - toneMap: the type of tone mapping being applied in the shader. See {@link Scene#toneMapping}
 * for the list of possible values.
 * - conserveEnergy: the value of {@link StandardMaterial#conserveEnergy}.
 * - occludeSpecular: the value of {@link StandardMaterial#occludeSpecular}.
 * - occludeDirect: the value of {@link StandardMaterial#occludeDirect}.
 * - shadingModel: the value of {@link StandardMaterial#shadingModel}.
 * - fresnelModel: the value of {@link StandardMaterial#fresnelModel}.
 * - cubeMapProjection: the value of {@link StandardMaterial#cubeMapProjection}.
 * - useMetalness: the value of {@link StandardMaterial#useMetalness}.
 * - blendType: the value of {@link Material#blendType}.
 * - twoSidedLighting: the value of {@link Material#twoSidedLighting}.
 * - occludeSpecularFloat: defines if {@link StandardMaterial#occludeSpecularIntensity} constant
 * should affect specular occlusion.
 * - alphaTest: enable alpha testing. See {@link Material#alphaTest}.
 * - alphaToCoverage: enable alpha to coverage. See {@link Material#alphaToCoverage}.
 * - opacityFadesSpecular: enable specular fade. See {@link Material#opacityFadesSpecular}.
 * - ambientSH: if ambient spherical harmonics are used. Ambient SH replace prefiltered cubemap
 * ambient on certain platform (mostly Android) for performance reasons.
 * - useSpecular: if any specular or reflections are needed at all.
 * - fixSeams: if cubemaps require seam fixing (see {@link Texture#options.fixCubemapSeams}).
 * - forceFragmentPrecision: Override fragment shader numeric precision. Can be "lowp", "mediump",
 * "highp" or null to use default.
 * - fastTbn: Use slightly cheaper normal mapping code (skip tangent space normalization). Can look
 * buggy sometimes.
 * - useRefraction: if refraction is used.
 * - skyboxIntensity: if reflected skybox intensity should be modulated.
 * - useCubeMapRotation: if cube map rotation is enabled.
 * - useInstancing: if hardware instancing compatible shader should be generated. Transform is read
 * from per-instance {@link VertexBuffer} instead of shader's uniforms.
 * - useMorphPosition: if morphing code should be generated to morph positions.
 * - useMorphNormal: if morphing code should be generated to morph normals.
 * - reflectionSource: one of "envAtlasHQ", "envAtlas", "cubeMap", "sphereMap"
 * - reflectionEncoding: one of null, "rgbm", "rgbe", "linear", "srgb"
 * - ambientSource: one of "ambientSH", "envAtlas", "constant"
 * - ambientEncoding: one of null, "rgbm", "rgbe", "linear", "srgb"
 */
class LitOptions {
    constructor() {
        this.hasTangents = false;
        this.chunks = [];

        this.pass = 0;
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
}

export { LitOptions };
