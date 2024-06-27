import {
    PIXELFORMAT_DXT5, PIXELFORMAT_RGBA8, TEXTURETYPE_SWIZZLEGGGR
} from '../../platform/graphics/constants.js';

import {
    BLEND_NONE,
    LIGHTTYPE_DIRECTIONAL, LIGHTTYPE_OMNI, LIGHTTYPE_SPOT,
    MASK_AFFECT_DYNAMIC,
    SHADER_PREPASS_VELOCITY,
    SHADERDEF_DIRLM, SHADERDEF_INSTANCING, SHADERDEF_LM, SHADERDEF_MORPH_POSITION, SHADERDEF_MORPH_NORMAL, SHADERDEF_NOSHADOW, SHADERDEF_MORPH_TEXTURE_BASED,
    SHADERDEF_SCREENSPACE, SHADERDEF_SKIN, SHADERDEF_TANGENTS, SHADERDEF_UV0, SHADERDEF_UV1, SHADERDEF_VCOLOR, SHADERDEF_LMAMBIENT,
    TONEMAP_NONE,
    DITHER_NONE
} from '../constants.js';
import { _matTex2D } from '../shader-lib/programs/standard.js';
import { LitMaterialOptionsBuilder } from './lit-material-options-builder.js';

const arraysEqual = (a, b) => {
    if (a.length !== b.length) {
        return false;
    }
    for (let i = 0; i < a.length; ++i) {
        if (a[i] !== b[i]) {
            return false;
        }
    }
    return true;
};

const notWhite = (color) => {
    return color.r !== 1 || color.g !== 1 || color.b !== 1;
};

const notBlack = (color) => {
    return color.r !== 0 || color.g !== 0 || color.b !== 0;
};

class StandardMaterialOptionsBuilder {
    constructor() {
        this._mapXForms = null;
    }

    // Minimal options for Depth and Shadow passes
    updateMinRef(options, scene, stdMat, objDefs, pass, sortedLights) {
        this._updateSharedOptions(options, scene, stdMat, objDefs, pass);
        this._updateMinOptions(options, stdMat, pass);
        this._updateUVOptions(options, stdMat, objDefs, true);
    }

    updateRef(options, scene, renderParams, stdMat, objDefs, pass, sortedLights) {
        this._updateSharedOptions(options, scene, stdMat, objDefs, pass);
        this._updateEnvOptions(options, stdMat, scene, renderParams);
        this._updateMaterialOptions(options, stdMat);
        options.litOptions.hasTangents = objDefs && ((objDefs & SHADERDEF_TANGENTS) !== 0);
        this._updateLightOptions(options, scene, stdMat, objDefs, sortedLights);
        this._updateUVOptions(options, stdMat, objDefs, false);
    }

    _updateSharedOptions(options, scene, stdMat, objDefs, pass) {
        options.forceUv1 = stdMat.forceUv1;

        // USER ATTRIBUTES
        if (stdMat.userAttributes) {
            options.litOptions.userAttributes = Object.fromEntries(stdMat.userAttributes.entries());
        }

        options.litOptions.chunks = stdMat.chunks || {};
        options.litOptions.pass = pass;
        options.litOptions.alphaTest = stdMat.alphaTest > 0;
        options.litOptions.blendType = stdMat.blendType;

        options.litOptions.screenSpace = objDefs && (objDefs & SHADERDEF_SCREENSPACE) !== 0;
        options.litOptions.skin = objDefs && (objDefs & SHADERDEF_SKIN) !== 0;
        options.litOptions.useInstancing = objDefs && (objDefs & SHADERDEF_INSTANCING) !== 0;
        options.litOptions.useMorphPosition = objDefs && (objDefs & SHADERDEF_MORPH_POSITION) !== 0;
        options.litOptions.useMorphNormal = objDefs && (objDefs & SHADERDEF_MORPH_NORMAL) !== 0;
        options.litOptions.useMorphTextureBased = objDefs && (objDefs & SHADERDEF_MORPH_TEXTURE_BASED) !== 0;

        options.litOptions.nineSlicedMode = stdMat.nineSlicedMode || 0;

        // clustered lighting features (in shared options as shadow pass needs this too)
        if (scene.clusteredLightingEnabled && stdMat.useLighting) {
            options.litOptions.clusteredLightingEnabled = true;
            options.litOptions.clusteredLightingCookiesEnabled = scene.lighting.cookiesEnabled;
            options.litOptions.clusteredLightingShadowsEnabled = scene.lighting.shadowsEnabled;
            options.litOptions.clusteredLightingShadowType = scene.lighting.shadowType;
            options.litOptions.clusteredLightingAreaLightsEnabled = scene.lighting.areaLightsEnabled;
        } else {
            options.litOptions.clusteredLightingEnabled = false;
            options.litOptions.clusteredLightingCookiesEnabled = false;
            options.litOptions.clusteredLightingShadowsEnabled = false;
            options.litOptions.clusteredLightingAreaLightsEnabled = false;
        }
    }

    _updateUVOptions(options, stdMat, objDefs, minimalOptions) {
        let hasUv0 = false;
        let hasUv1 = false;
        let hasVcolor = false;
        if (objDefs) {
            hasUv0 = (objDefs & SHADERDEF_UV0) !== 0;
            hasUv1 = (objDefs & SHADERDEF_UV1) !== 0;
            hasVcolor = (objDefs & SHADERDEF_VCOLOR) !== 0;
        }

        options.litOptions.vertexColors = false;
        this._mapXForms = [];

        const uniqueTextureMap = {};
        for (const p in _matTex2D) {
            this._updateTexOptions(options, stdMat, p, hasUv0, hasUv1, hasVcolor, minimalOptions, uniqueTextureMap);
        }
        this._mapXForms = null;

        // All texture related lit options
        options.litOptions.lightMapEnabled = options.lightMap;
        options.litOptions.dirLightMapEnabled = options.dirLightMap;
        options.litOptions.useHeights = options.heightMap;
        options.litOptions.useNormals = options.normalMap;
        options.litOptions.useClearCoatNormals = options.clearCoatNormalMap;
        options.litOptions.useAo = options.aoMap || options.aoVertexColor;
        options.litOptions.diffuseMapEnabled = options.diffuseMap;
    }

    _updateTexOptions(options, stdMat, p, hasUv0, hasUv1, hasVcolor, minimalOptions, uniqueTextureMap) {
        const isOpacity = p === 'opacity';

        if (!minimalOptions || isOpacity) {
            const mname = p + 'Map';
            const vname = p + 'VertexColor';
            const vcname = p + 'VertexColorChannel';
            const cname = mname + 'Channel';
            const tname = mname + 'Transform';
            const uname = mname + 'Uv';
            const iname = mname + 'Identifier';

            // Avoid overriding previous lightMap properties
            if (p !== 'light') {
                options[mname] = false;
                options[iname] = undefined;
                options[cname] = '';
                options[tname] = 0;
                options[uname] = 0;
            }
            options[vname] = false;
            options[vcname] = '';

            if (isOpacity && stdMat.blendType === BLEND_NONE && stdMat.alphaTest === 0.0 && !stdMat.alphaToCoverage && stdMat.opacityDither === DITHER_NONE) {
                return;
            }

            if (p !== 'height' && stdMat[vname]) {
                if (hasVcolor) {
                    options[vname] = stdMat[vname];
                    options[vcname] = stdMat[vcname];
                    options.litOptions.vertexColors = true;
                }
            }
            if (stdMat[mname]) {
                let allow = true;
                if (stdMat[uname] === 0 && !hasUv0) allow = false;
                if (stdMat[uname] === 1 && !hasUv1) allow = false;
                if (allow) {

                    // create an intermediate map between the textures and their slots
                    // to ensure the unique texture mapping isn't dependent on the texture id
                    // as that will change when textures are changed, even if the sharing is the same
                    const mapId = stdMat[mname].id;
                    let identifier = uniqueTextureMap[mapId];
                    if (identifier === undefined) {
                        uniqueTextureMap[mapId] = p;
                        identifier = p;
                    }

                    options[mname] = !!stdMat[mname];
                    options[iname] = identifier;
                    options[tname] = this._getMapTransformID(stdMat.getUniform(tname), stdMat[uname]);
                    options[cname] = stdMat[cname];
                    options[uname] = stdMat[uname];
                }
            }
        }
    }

    _updateMinOptions(options, stdMat, pass) {
        options.opacityTint = stdMat.blendType !== BLEND_NONE || stdMat.opacityShadowDither !== DITHER_NONE;

        // pre-pass uses the same dither setting as forward pass, otherwise shadow dither
        const isPrepass = pass === SHADER_PREPASS_VELOCITY;
        options.litOptions.opacityShadowDither = isPrepass ? stdMat.opacityDither : stdMat.opacityShadowDither;

        options.litOptions.lights = [];
    }

    _updateMaterialOptions(options, stdMat) {
        const useSpecular = !!(stdMat.useMetalness || stdMat.specularMap || stdMat.sphereMap || stdMat.cubeMap ||
                            notBlack(stdMat.specular) || (stdMat.specularityFactor > 0 && stdMat.useMetalness) ||
                            stdMat.enableGGXSpecular ||
                            (stdMat.clearCoat > 0));

        const useSpecularColor = (!stdMat.useMetalness || stdMat.useMetalnessSpecularColor);
        const specularTint = useSpecular &&
                             (stdMat.specularTint || (!stdMat.specularMap && !stdMat.specularVertexColor)) &&
                             notWhite(stdMat.specular);

        const specularityFactorTint = useSpecular && stdMat.useMetalnessSpecularColor &&
                                      (stdMat.specularityFactorTint || (stdMat.specularityFactor < 1 && !stdMat.specularityFactorMap));

        const emissiveTintColor = !stdMat.emissiveMap || (notWhite(stdMat.emissive) && stdMat.emissiveTint);
        const emissiveTintIntensity = (stdMat.emissiveIntensity !== 1);

        const isPackedNormalMap = stdMat.normalMap ? (stdMat.normalMap.format === PIXELFORMAT_DXT5 || stdMat.normalMap.type === TEXTURETYPE_SWIZZLEGGGR) : false;

        options.opacityTint = (stdMat.blendType !== BLEND_NONE || stdMat.alphaTest > 0 || stdMat.opacityDither !== DITHER_NONE) ? 1 : 0;
        options.ambientTint = stdMat.ambientTint;
        options.specularTint = specularTint ? 2 : 0;
        options.specularityFactorTint = specularityFactorTint ? 1 : 0;
        options.metalnessTint = (stdMat.useMetalness && stdMat.metalness < 1) ? 1 : 0;
        options.glossTint = 1;
        options.emissiveTint = (emissiveTintColor ? 2 : 0) + (emissiveTintIntensity ? 1 : 0);
        options.diffuseEncoding = stdMat.diffuseMap?.encoding;
        options.diffuseDetailEncoding = stdMat.diffuseDetailMap?.encoding;
        options.emissiveEncoding = stdMat.emissiveMap?.encoding;
        options.lightMapEncoding = stdMat.lightMap?.encoding;
        options.packedNormal = isPackedNormalMap;
        options.refractionTint = (stdMat.refraction !== 1.0) ? 1 : 0;
        options.refractionIndexTint = (stdMat.refractionIndex !== 1.0 / 1.5) ? 1 : 0;
        options.thicknessTint = (stdMat.useDynamicRefraction && stdMat.thickness !== 1.0) ? 1 : 0;
        options.specularEncoding = stdMat.specularEncoding || 'linear';
        options.sheenEncoding = stdMat.sheenEncoding || 'linear';
        options.aoMapUv = stdMat.aoUvSet; // backwards compatibility
        options.aoDetail = !!stdMat.aoMap;
        options.diffuseDetail = !!stdMat.diffuseMap;
        options.normalDetail = !!stdMat.normalMap;
        options.diffuseDetailMode = stdMat.diffuseDetailMode;
        options.aoDetailMode = stdMat.aoDetailMode;
        options.clearCoatTint = (stdMat.clearCoat !== 1.0) ? 1 : 0;
        options.clearCoatGloss = !!stdMat.clearCoatGloss;
        options.clearCoatGlossTint = (stdMat.clearCoatGloss !== 1.0) ? 1 : 0;
        options.iorTint = stdMat.refractionIndex !== 1.0 / 1.5 ? 1 : 0;

        options.iridescenceTint = stdMat.iridescence !== 1.0 ? 1 : 0;

        options.sheenTint = (stdMat.useSheen && notWhite(stdMat.sheen)) ? 2 : 0;
        options.sheenGlossTint = 1;

        options.glossInvert = stdMat.glossInvert;
        options.sheenGlossInvert = stdMat.sheenGlossInvert;
        options.clearCoatGlossInvert = stdMat.clearCoatGlossInvert;

        options.useSpecularColor = useSpecularColor;

        // LIT OPTIONS
        options.litOptions.separateAmbient = false;    // store ambient light color in separate variable, instead of adding it to diffuse directly
        options.litOptions.useAmbientTint = stdMat.ambientTint;
        options.litOptions.customFragmentShader = stdMat.customFragmentShader;
        options.litOptions.pixelSnap = stdMat.pixelSnap;

        options.litOptions.ambientSH = !!stdMat.ambientSH;
        options.litOptions.fastTbn = stdMat.fastTbn;
        options.litOptions.twoSidedLighting = stdMat.twoSidedLighting;
        options.litOptions.occludeSpecular = stdMat.occludeSpecular;
        options.litOptions.occludeSpecularFloat = (stdMat.occludeSpecularIntensity !== 1.0);

        options.litOptions.useMsdf = !!stdMat.msdfMap;
        options.litOptions.msdfTextAttribute = !!stdMat.msdfTextAttribute;

        options.litOptions.alphaToCoverage = stdMat.alphaToCoverage;
        options.litOptions.opacityFadesSpecular = stdMat.opacityFadesSpecular;
        options.litOptions.opacityDither = stdMat.opacityDither;

        options.litOptions.cubeMapProjection = stdMat.cubeMapProjection;

        options.litOptions.occludeDirect = stdMat.occludeDirect;
        options.litOptions.useSpecular = useSpecular;
        options.litOptions.useSpecularityFactor = (specularityFactorTint || !!stdMat.specularityFactorMap) && stdMat.useMetalnessSpecularColor;
        options.litOptions.enableGGXSpecular = stdMat.enableGGXSpecular;
        options.litOptions.fresnelModel = stdMat.fresnelModel;
        options.litOptions.useRefraction = (stdMat.refraction || !!stdMat.refractionMap) && (stdMat.useDynamicRefraction || !!options.litOptions.reflectionSource);
        options.litOptions.useClearCoat = !!stdMat.clearCoat;
        options.litOptions.useSheen = stdMat.useSheen;
        options.litOptions.useIridescence = stdMat.useIridescence && stdMat.iridescence !== 0.0;
        options.litOptions.useMetalness = stdMat.useMetalness;
        options.litOptions.useDynamicRefraction = stdMat.useDynamicRefraction;
        options.litOptions.dispersion = stdMat.dispersion > 0;
    }

    _updateEnvOptions(options, stdMat, scene, renderParams) {
        options.litOptions.fog = stdMat.useFog ? scene.fog : 'none';
        options.litOptions.gamma = renderParams.gammaCorrection;
        options.litOptions.toneMap = stdMat.useTonemap ? renderParams.toneMapping : TONEMAP_NONE;

        let usingSceneEnv = false;

        // source of environment reflections is as follows:
        if (stdMat.envAtlas && stdMat.cubeMap) {
            options.litOptions.reflectionSource = 'envAtlasHQ';
            options.litOptions.reflectionEncoding = stdMat.envAtlas.encoding;
            options.litOptions.reflectionCubemapEncoding = stdMat.cubeMap.encoding;
        } else if (stdMat.envAtlas) {
            options.litOptions.reflectionSource = 'envAtlas';
            options.litOptions.reflectionEncoding = stdMat.envAtlas.encoding;
        } else if (stdMat.cubeMap) {
            options.litOptions.reflectionSource = 'cubeMap';
            options.litOptions.reflectionEncoding = stdMat.cubeMap.encoding;
        } else if (stdMat.sphereMap) {
            options.litOptions.reflectionSource = 'sphereMap';
            options.litOptions.reflectionEncoding = stdMat.sphereMap.encoding;
        } else if (stdMat.useSkybox && scene.envAtlas && scene.skybox) {
            options.litOptions.reflectionSource = 'envAtlasHQ';
            options.litOptions.reflectionEncoding = scene.envAtlas.encoding;
            options.litOptions.reflectionCubemapEncoding = scene.skybox.encoding;
            usingSceneEnv = true;
        } else if (stdMat.useSkybox && scene.envAtlas) {
            options.litOptions.reflectionSource = 'envAtlas';
            options.litOptions.reflectionEncoding = scene.envAtlas.encoding;
            usingSceneEnv = true;
        } else if (stdMat.useSkybox && scene.skybox) {
            options.litOptions.reflectionSource = 'cubeMap';
            options.litOptions.reflectionEncoding = scene.skybox.encoding;
            usingSceneEnv = true;
        } else {
            options.litOptions.reflectionSource = null;
            options.litOptions.reflectionEncoding = null;
        }

        // source of environment ambient is as follows:
        if (stdMat.ambientSH) {
            options.litOptions.ambientSource = 'ambientSH';
            options.litOptions.ambientEncoding = null;
        } else {
            const envAtlas = stdMat.envAtlas || (stdMat.useSkybox && scene.envAtlas ? scene.envAtlas : null);
            if (envAtlas) {
                options.litOptions.ambientSource = 'envAtlas';
                options.litOptions.ambientEncoding = envAtlas.encoding;
            } else {
                options.litOptions.ambientSource = 'constant';
                options.litOptions.ambientEncoding = null;
            }
        }

        // TODO: add a test for if non skybox cubemaps have rotation (when this is supported) - for now assume no non-skybox cubemap rotation
        options.litOptions.skyboxIntensity = usingSceneEnv;
        options.litOptions.useCubeMapRotation = usingSceneEnv && scene._skyboxRotationShaderInclude;
    }

    _updateLightOptions(options, scene, stdMat, objDefs, sortedLights) {
        options.lightMap = false;
        options.lightMapChannel = '';
        options.lightMapUv = 0;
        options.lightMapTransform = 0;
        options.litOptions.lightMapWithoutAmbient = false;
        options.dirLightMap = false;

        if (objDefs) {
            options.litOptions.noShadow = (objDefs & SHADERDEF_NOSHADOW) !== 0;

            if ((objDefs & SHADERDEF_LM) !== 0) {
                options.lightMapEncoding = scene.lightmapPixelFormat === PIXELFORMAT_RGBA8 ? 'rgbm' : 'linear';
                options.lightMap = true;
                options.lightMapChannel = 'rgb';
                options.lightMapUv = 1;
                options.lightMapTransform = 0;
                options.litOptions.lightMapWithoutAmbient = !stdMat.lightMap;
                if ((objDefs & SHADERDEF_DIRLM) !== 0) {
                    options.dirLightMap = true;
                }

                // if lightmaps contain baked ambient light, disable real-time ambient light
                if ((objDefs & SHADERDEF_LMAMBIENT) !== 0) {
                    options.litOptions.lightMapWithoutAmbient = false;
                }
            }
        }

        if (stdMat.useLighting) {
            const lightsFiltered = [];
            const mask = objDefs ? (objDefs >> 16) : MASK_AFFECT_DYNAMIC;

            // mask to select lights (dynamic vs lightmapped) when using clustered lighting
            options.litOptions.lightMaskDynamic = !!(mask & MASK_AFFECT_DYNAMIC);

            if (sortedLights) {
                LitMaterialOptionsBuilder.collectLights(LIGHTTYPE_DIRECTIONAL, sortedLights[LIGHTTYPE_DIRECTIONAL], lightsFiltered, mask);
                LitMaterialOptionsBuilder.collectLights(LIGHTTYPE_OMNI, sortedLights[LIGHTTYPE_OMNI], lightsFiltered, mask);
                LitMaterialOptionsBuilder.collectLights(LIGHTTYPE_SPOT, sortedLights[LIGHTTYPE_SPOT], lightsFiltered, mask);
            }
            options.litOptions.lights = lightsFiltered;
        } else {
            options.litOptions.lights = [];
        }

        if (options.litOptions.lights.length === 0) {
            options.litOptions.noShadow = true;
        }
    }

    _getMapTransformID(xform, uv) {
        if (!xform) return 0;

        let xforms = this._mapXForms[uv];
        if (!xforms) {
            xforms = [];
            this._mapXForms[uv] = xforms;
        }

        for (let i = 0; i < xforms.length; i++) {
            if (arraysEqual(xforms[i][0].value, xform[0].value) &&
                arraysEqual(xforms[i][1].value, xform[1].value)) {
                return i + 1;
            }
        }

        return xforms.push(xform);
    }
}

export { StandardMaterialOptionsBuilder };
