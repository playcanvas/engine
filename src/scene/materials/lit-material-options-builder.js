import {
    CUBEPROJ_NONE, LIGHTTYPE_DIRECTIONAL, LIGHTTYPE_OMNI, LIGHTTYPE_SPOT,
    MASK_AFFECT_DYNAMIC, TONEMAP_NONE, SHADERDEF_INSTANCING, SHADERDEF_MORPH_NORMAL,
    SHADERDEF_MORPH_POSITION, SHADERDEF_MORPH_TEXTURE_BASED, SHADERDEF_SCREENSPACE, SHADERDEF_SKIN,
    SHADERDEF_NOSHADOW, SHADERDEF_TANGENTS, SPRITE_RENDERMODE_SIMPLE
} from "../constants.js";

class LitMaterialOptionsBuilder {
    static update(litOptions, material, scene, renderParams, objDefs, pass, sortedLights) {
        LitMaterialOptionsBuilder.updateSharedOptions(litOptions, material, scene, objDefs, pass);
        LitMaterialOptionsBuilder.updateMaterialOptions(litOptions, material);
        LitMaterialOptionsBuilder.updateEnvOptions(litOptions, material, scene, renderParams);
        LitMaterialOptionsBuilder.updateLightingOptions(litOptions, material, objDefs, sortedLights);
    }

    static updateSharedOptions(litOptions, material, scene, objDefs, pass) {
        litOptions.chunks = material.chunks;
        litOptions.pass = pass;
        litOptions.alphaTest = material.alphaTest > 0;
        litOptions.blendType = material.blendType;

        litOptions.screenSpace = objDefs && (objDefs & SHADERDEF_SCREENSPACE) !== 0;
        litOptions.skin = objDefs && (objDefs & SHADERDEF_SKIN) !== 0;
        litOptions.useInstancing = objDefs && (objDefs & SHADERDEF_INSTANCING) !== 0;
        litOptions.useMorphPosition = objDefs && (objDefs & SHADERDEF_MORPH_POSITION) !== 0;
        litOptions.useMorphNormal = objDefs && (objDefs & SHADERDEF_MORPH_NORMAL) !== 0;
        litOptions.useMorphTextureBased = objDefs && (objDefs & SHADERDEF_MORPH_TEXTURE_BASED) !== 0;
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
        litOptions.useAmbientTint = false;
        litOptions.separateAmbient = false;    // store ambient light color in separate variable, instead of adding it to diffuse directly
        litOptions.customFragmentShader = null;
        litOptions.pixelSnap = material.pixelSnap;

        litOptions.ambientSH = material.ambientSH;
        litOptions.fastTbn = material.fastTbn;
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
        litOptions.fog = material.useFog ? scene.fog : 'none';
        litOptions.gamma = renderParams.gammaCorrection;
        litOptions.toneMap = material.useTonemap ? renderParams.toneMapping : TONEMAP_NONE;

        // source of reflections
        if (material.useSkybox && scene.envAtlas && scene.skybox) {
            litOptions.reflectionSource = 'envAtlasHQ';
            litOptions.reflectionEncoding = scene.envAtlas.encoding;
            litOptions.reflectionCubemapEncoding = scene.skybox.encoding;
        } else if (material.useSkybox && scene.envAtlas) {
            litOptions.reflectionSource = 'envAtlas';
            litOptions.reflectionEncoding = scene.envAtlas.encoding;
        } else if (material.useSkybox && scene.skybox) {
            litOptions.reflectionSource = 'cubeMap';
            litOptions.reflectionEncoding = scene.skybox.encoding;
        } else {
            litOptions.reflectionSource = null;
            litOptions.reflectionEncoding = null;
        }

        // source of environment ambient is as follows:
        if (material.ambientSH) {
            litOptions.ambientSource = 'ambientSH';
            litOptions.ambientEncoding = null;
        } else if (litOptions.reflectionSource && scene.envAtlas) {
            litOptions.ambientSource = 'envAtlas';
            litOptions.ambientEncoding = scene.envAtlas.encoding;
        } else {
            litOptions.ambientSource = 'constant';
            litOptions.ambientEncoding = null;
        }

        const hasSkybox = !!litOptions.reflectionSource;
        litOptions.skyboxIntensity = hasSkybox;
        litOptions.useCubeMapRotation = hasSkybox && scene._skyboxRotationShaderInclude;
    }

    static updateLightingOptions(litOptions, material, objDefs, sortedLights) {
        litOptions.lightMapWithoutAmbient = false;

        if (material.useLighting) {
            const lightsFiltered = [];
            const mask = objDefs ? (objDefs >> 16) : MASK_AFFECT_DYNAMIC;

            // mask to select lights (dynamic vs lightmapped) when using clustered lighting
            litOptions.lightMaskDynamic = !!(mask & MASK_AFFECT_DYNAMIC);
            litOptions.lightMapWithoutAmbient = false;

            if (sortedLights) {
                LitMaterialOptionsBuilder.collectLights(LIGHTTYPE_DIRECTIONAL, sortedLights[LIGHTTYPE_DIRECTIONAL], lightsFiltered, mask);
                LitMaterialOptionsBuilder.collectLights(LIGHTTYPE_OMNI, sortedLights[LIGHTTYPE_OMNI], lightsFiltered, mask);
                LitMaterialOptionsBuilder.collectLights(LIGHTTYPE_SPOT, sortedLights[LIGHTTYPE_SPOT], lightsFiltered, mask);
            }
            litOptions.lights = lightsFiltered;
        } else {
            litOptions.lights = [];
        }

        if (litOptions.lights.length === 0 || ((objDefs & SHADERDEF_NOSHADOW) !== 0)) {
            litOptions.noShadow = true;
        }
    }

    static collectLights(lType, lights, lightsFiltered, mask) {
        for (let i = 0; i < lights.length; i++) {
            const light = lights[i];
            if (light.enabled) {
                if (light.mask & mask) {
                    lightsFiltered.push(light);
                }
            }
        }
    }
}

export { LitMaterialOptionsBuilder };
