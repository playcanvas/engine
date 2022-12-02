import {
    BLEND_NONE, GAMMA_NONE
} from '../constants.js';

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
        this.lightMapVertexColors = false;
        this.dirLightMapEnabled = false;
        this.heightMapEnabled = false;
        this.normalMapEnabled = false;
        this.clearCoatNormalMapEnabled = false;
        this.aoMapEnabled = false;
        this.aoVertexColors = false;
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
