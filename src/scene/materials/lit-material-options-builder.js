import {
    CUBEPROJ_NONE, LIGHTTYPE_DIRECTIONAL, LIGHTTYPE_OMNI, LIGHTTYPE_SPOT,
    MASK_AFFECT_DYNAMIC, MASK_AFFECT_RUNTIME, TONEMAP_NONE, SHADERDEF_INSTANCING, SHADERDEF_MORPH_NORMAL,
    SHADERDEF_MORPH_POSITION, SHADERDEF_SCREENSPACE, SHADERDEF_SKIN,
    SHADERDEF_NOSHADOW, SHADERDEF_TANGENTS, SPRITE_RENDERMODE_SIMPLE,
    SHADERDEF_MORPH_TEXTURE_BASED_INT,
    FOG_NONE,
    REFLECTIONSRC_NONE, REFLECTIONSRC_ENVATLAS, REFLECTIONSRC_ENVATLASHQ, REFLECTIONSRC_CUBEMAP,
    AMBIENTSRC_AMBIENTSH, AMBIENTSRC_ENVALATLAS, AMBIENTSRC_CONSTANT,
    SHADER_PREPASS, SCENETEXTURE_DEPTH
} from '../constants.js';

/**
 * @import { Light } from '../light.js'
 */

class LitMaterialOptionsBuilder {
    static update(litOptions, material, scene, renderParams, objDefs, pass, sortedLights) {
        LitMaterialOptionsBuilder.updateSharedOptions(litOptions, material, scene, objDefs, pass, renderParams);
        LitMaterialOptionsBuilder.updateMaterialOptions(litOptions, material);
        LitMaterialOptionsBuilder.updateEnvOptions(litOptions, material, scene, renderParams);
        LitMaterialOptionsBuilder.updateLightingOptions(litOptions, material, scene, objDefs, sortedLights);
    }

    static updateSharedOptions(litOptions, material, scene, objDefs, pass, renderParams) {
        litOptions.shaderChunks = material.shaderChunks;
        litOptions.pass = pass;

        // linear depth is rendered by the prepass, and by the forward pass when the camera renders
        // the scene depth into a scene texture
        litOptions.linearDepth = pass === SHADER_PREPASS ||
            !!renderParams?.sceneTextures.includes(SCENETEXTURE_DEPTH);

        litOptions.alphaTest = material.alphaTest > 0;
        litOptions.blendType = material.blendType;

        litOptions.screenSpace = objDefs && (objDefs & SHADERDEF_SCREENSPACE) !== 0;
        litOptions.skin = objDefs && (objDefs & SHADERDEF_SKIN) !== 0;
        litOptions.useInstancing = objDefs && (objDefs & SHADERDEF_INSTANCING) !== 0;
        litOptions.useMorphPosition = objDefs && (objDefs & SHADERDEF_MORPH_POSITION) !== 0;
        litOptions.useMorphNormal = objDefs && (objDefs & SHADERDEF_MORPH_NORMAL) !== 0;
        litOptions.useMorphTextureBasedInt = objDefs && (objDefs & SHADERDEF_MORPH_TEXTURE_BASED_INT) !== 0;
        litOptions.hasTangents = objDefs && ((objDefs & SHADERDEF_TANGENTS) !== 0);

        litOptions.nineSlicedMode = material.nineSlicedMode || SPRITE_RENDERMODE_SIMPLE;

        // clustered lighting features (in shared options as shadow pass needs this too)
        if (material.useLighting && scene.clusteredLightingEnabled) {
            litOptions.clusteredLightingEnabled = true;
            litOptions.clusteredLightingCookiesEnabled = scene.lighting.cookiesEnabled;
            litOptions.clusteredLightingShadowsEnabled = scene.lighting.shadowsEnabled;
            litOptions.clusteredLightingShadowType = scene.lighting.shadowType;
            litOptions.clusteredLightingAreaLightsEnabled = scene.lighting.areaLightsEnabled;
        } else {
            litOptions.clusteredLightingEnabled = false;
            litOptions.clusteredLightingCookiesEnabled = false;
            litOptions.clusteredLightingShadowsEnabled = false;
            litOptions.clusteredLightingAreaLightsEnabled = false;
        }
    }

    static updateMaterialOptions(litOptions, material) {
        litOptions.separateAmbient = false;    // store ambient light color in separate variable, instead of adding it to diffuse directly
        litOptions.pixelSnap = material.pixelSnap;

        litOptions.ambientSH = material.ambientSH;
        litOptions.twoSidedLighting = material.twoSidedLighting;
        litOptions.occludeDirect = material.occludeDirect;
        litOptions.occludeSpecular = material.occludeSpecular;
        litOptions.occludeSpecularFloat = (material.occludeSpecularIntensity !== 1.0);

        litOptions.useMsdf = false;
        litOptions.msdfTextAttribute = false;

        litOptions.alphaToCoverage = material.alphaToCoverage;
        litOptions.opacityFadesSpecular = material.opacityFadesSpecular;
        litOptions.opacityDither = material.opacityDither;

        litOptions.cubeMapProjection = CUBEPROJ_NONE;

        litOptions.useSpecular = material.hasSpecular;
        litOptions.useSpecularityFactor = material.hasSpecularityFactor;
        litOptions.enableGGXSpecular = material.ggxSpecular;
        litOptions.useAnisotropy = false; // LitMaterial doesn't support anisotropy
        litOptions.fresnelModel = material.fresnelModel;
        litOptions.useRefraction = material.hasRefraction;
        litOptions.useClearCoat = material.hasClearCoat;
        litOptions.useSheen = material.hasSheen;
        litOptions.useIridescence = material.hasIrridescence;
        litOptions.useMetalness = material.hasMetalness;
        litOptions.useDynamicRefraction = material.dynamicRefraction;
        litOptions.dispersion = material.dispersion > 0;

        litOptions.vertexColors = false;
        litOptions.lightMapEnabled = material.hasLighting;
        litOptions.dirLightMapEnabled = material.dirLightMap;
        litOptions.useHeights = material.hasHeights;
        litOptions.useNormals = material.hasNormals;
        litOptions.useClearCoatNormals = material.hasClearCoatNormals;
        litOptions.useAo = material.hasAo;
        litOptions.diffuseMapEnabled = material.hasDiffuseMap;
    }

    static updateEnvOptions(litOptions, material, scene, renderParams) {
        litOptions.fog = material.useFog ? renderParams.fog : FOG_NONE;
        litOptions.gamma = renderParams.shaderOutputGamma;
        litOptions.toneMap = material.useTonemap ? renderParams.toneMapping : TONEMAP_NONE;

        // source of reflections
        if (material.useSkybox && scene.envAtlas && scene.skybox) {
            litOptions.reflectionSource = REFLECTIONSRC_ENVATLASHQ;
            litOptions.reflectionEncoding = scene.envAtlas.encoding;
            litOptions.reflectionCubemapEncoding = scene.skybox.encoding;
        } else if (material.useSkybox && scene.envAtlas) {
            litOptions.reflectionSource = REFLECTIONSRC_ENVATLAS;
            litOptions.reflectionEncoding = scene.envAtlas.encoding;
        } else if (material.useSkybox && scene.skybox) {
            litOptions.reflectionSource = REFLECTIONSRC_CUBEMAP;
            litOptions.reflectionEncoding = scene.skybox.encoding;
        } else {
            litOptions.reflectionSource = REFLECTIONSRC_NONE;
            litOptions.reflectionEncoding = null;
        }

        // source of environment ambient is as follows:
        if (material.ambientSH) {
            litOptions.ambientSource = AMBIENTSRC_AMBIENTSH;
            litOptions.ambientEncoding = null;
        } else if (litOptions.reflectionSource !== REFLECTIONSRC_NONE && scene.envAtlas) {
            litOptions.ambientSource = AMBIENTSRC_ENVALATLAS;
            litOptions.ambientEncoding = scene.envAtlas.encoding;
        } else {
            litOptions.ambientSource = AMBIENTSRC_CONSTANT;
            litOptions.ambientEncoding = null;
        }

        const hasSkybox = litOptions.reflectionSource !== REFLECTIONSRC_NONE;
        litOptions.skyboxIntensity = hasSkybox;
        litOptions.useCubeMapRotation = hasSkybox && scene._skyboxRotationShaderInclude;
    }

    static updateLightingOptions(litOptions, material, scene, objDefs, sortedLights) {
        litOptions.lightMapWithoutAmbient = false;

        if (material.useLighting) {
            const lightsFiltered = [];
            const mask = objDefs ? (objDefs >> 16) : MASK_AFFECT_DYNAMIC;

            // mask to select lights (dynamic vs lightmapped) when using clustered lighting
            litOptions.lightMaskDynamic = !!(mask & MASK_AFFECT_DYNAMIC);
            litOptions.lightMapWithoutAmbient = false;

            if (sortedLights) {
                // slots are assigned in the same order the renderer dispatches them, see
                // ForwardRenderer#dispatchDirectLights
                let slotCount = LitMaterialOptionsBuilder.collectLights(sortedLights[LIGHTTYPE_DIRECTIONAL], lightsFiltered, mask, 0);

                if (!scene.clusteredLightingEnabled) {
                    slotCount = LitMaterialOptionsBuilder.collectLights(sortedLights[LIGHTTYPE_OMNI], lightsFiltered, mask, slotCount);
                    LitMaterialOptionsBuilder.collectLights(sortedLights[LIGHTTYPE_SPOT], lightsFiltered, mask, slotCount);
                }
            }
            litOptions.lights = lightsFiltered;
        } else {
            litOptions.lights = [];
        }

        if ((litOptions.lights.length === 0 && !scene.clusteredLightingEnabled) || ((objDefs & SHADERDEF_NOSHADOW) !== 0)) {
            litOptions.noShadow = true;
        }
    }

    /**
     * Places the lights this mask selects at their light slots in `lightsFiltered`. Slots are
     * absolute: every light applied at runtime takes its slot whether or not this mask selects
     * it, so that a slot denotes the same light for every mask drawn in the pass, and the slots a
     * mask does not select are left as holes. A light contributing only to a lightmap reaches
     * nothing at runtime and takes no slot. {@link ForwardRenderer#dispatchDirectLights} assigns
     * slots the same way, and the two must agree.
     *
     * @param {Light[]} lights - The lights of one type, in the pass order.
     * @param {Light[]} lightsFiltered - Receives the selected lights, indexed by light slot.
     * @param {number} mask - The mask of the mesh instance being drawn.
     * @param {number} slotBase - The first slot these lights can take.
     * @returns {number} The first slot after these lights.
     */
    static collectLights(lights, lightsFiltered, mask, slotBase) {
        let slotCount = slotBase;
        for (let i = 0; i < lights.length; i++) {
            const light = lights[i];
            if (light.enabled && (light.mask & MASK_AFFECT_RUNTIME)) {
                const slot = slotCount++;
                if (light.mask & mask) {
                    lightsFiltered[slot] = light;
                }
            }
        }
        return slotCount;
    }
}

export { LitMaterialOptionsBuilder };
