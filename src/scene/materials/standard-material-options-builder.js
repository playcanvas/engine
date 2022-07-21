import { _matTex2D } from '../../graphics/program-lib/programs/standard.js';

import {
    PIXELFORMAT_DXT5, TEXTURETYPE_SWIZZLEGGGR
} from '../../graphics/constants.js';
import {
    BLEND_NONE,
    GAMMA_NONE, GAMMA_SRGBHDR,
    LIGHTTYPE_DIRECTIONAL, LIGHTTYPE_OMNI, LIGHTTYPE_SPOT,
    MASK_AFFECT_DYNAMIC,
    SHADER_FORWARDHDR,
    SHADERDEF_DIRLM, SHADERDEF_INSTANCING, SHADERDEF_LM, SHADERDEF_MORPH_POSITION, SHADERDEF_MORPH_NORMAL, SHADERDEF_NOSHADOW, SHADERDEF_MORPH_TEXTURE_BASED,
    SHADERDEF_SCREENSPACE, SHADERDEF_SKIN, SHADERDEF_TANGENTS, SHADERDEF_UV0, SHADERDEF_UV1, SHADERDEF_VCOLOR, SHADERDEF_LMAMBIENT,
    TONEMAP_LINEAR,
    SPECULAR_PHONG
} from '../constants.js';

import { Quat } from '../../math/quat.js';

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
    updateMinRef(options, scene, stdMat, objDefs, staticLightList, pass, sortedLights) {
        this._updateSharedOptions(options, scene, stdMat, objDefs, pass);
        this._updateMinOptions(options, stdMat);
        this._updateUVOptions(options, stdMat, objDefs, true);
    }

    updateRef(options, scene, stdMat, objDefs, staticLightList, pass, sortedLights) {
        this._updateSharedOptions(options, scene, stdMat, objDefs, pass);
        this._updateEnvOptions(options, stdMat, scene);
        this._updateMaterialOptions(options, stdMat);
        if (pass === SHADER_FORWARDHDR) {
            if (options.gamma) options.gamma = GAMMA_SRGBHDR;
            options.toneMap = TONEMAP_LINEAR;
        }
        options.hasTangents = objDefs && ((objDefs & SHADERDEF_TANGENTS) !== 0);
        this._updateLightOptions(options, stdMat, objDefs, sortedLights, staticLightList);
        this._updateUVOptions(options, stdMat, objDefs, false);
    }

    _updateSharedOptions(options, scene, stdMat, objDefs, pass) {
        options.pass = pass;
        options.alphaTest = stdMat.alphaTest > 0;
        options.forceFragmentPrecision = stdMat.forceFragmentPrecision || '';
        options.chunks = stdMat.chunks || '';
        options.blendType = stdMat.blendType;
        options.forceUv1 = stdMat.forceUv1;
        options.separateAmbient = false;    // store ambient light color in separate variable, instead of adding it to diffuse directly
        options.screenSpace = objDefs && (objDefs & SHADERDEF_SCREENSPACE) !== 0;
        options.skin = objDefs && (objDefs & SHADERDEF_SKIN) !== 0;
        options.useInstancing = objDefs && (objDefs & SHADERDEF_INSTANCING) !== 0;
        options.useMorphPosition = objDefs && (objDefs & SHADERDEF_MORPH_POSITION) !== 0;
        options.useMorphNormal = objDefs && (objDefs & SHADERDEF_MORPH_NORMAL) !== 0;
        options.useMorphTextureBased = objDefs && (objDefs & SHADERDEF_MORPH_TEXTURE_BASED) !== 0;

        options.nineSlicedMode = stdMat.nineSlicedMode || 0;

        // clustered lighting features (in shared options as shadow pass needs this too)
        if (scene.clusteredLightingEnabled && stdMat.useLighting) {
            options.clusteredLightingEnabled = true;
            options.clusteredLightingCookiesEnabled = scene.lighting.cookiesEnabled;
            options.clusteredLightingShadowsEnabled = scene.lighting.shadowsEnabled;
            options.clusteredLightingShadowType = scene.lighting.shadowType;
            options.clusteredLightingAreaLightsEnabled = scene.lighting.areaLightsEnabled;
        } else {
            options.clusteredLightingEnabled = false;
            options.clusteredLightingCookiesEnabled = false;
            options.clusteredLightingShadowsEnabled = false;
            options.clusteredLightingAreaLightsEnabled = false;
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

        options.vertexColors = false;
        this._mapXForms = [];
        for (const p in _matTex2D) {
            this._updateTexOptions(options, stdMat, p, hasUv0, hasUv1, hasVcolor, minimalOptions);
        }
        this._mapXForms = null;
    }

    _updateMinOptions(options, stdMat) {
        options.opacityTint = stdMat.opacity !== 1 && stdMat.blendType !== BLEND_NONE;
        options.lights = [];
    }

    _updateMaterialOptions(options, stdMat) {
        const diffuseTint = (stdMat.diffuseTint || (!stdMat.diffuseMap && !stdMat.diffuseVertexColor)) &&
                            notWhite(stdMat.diffuse);

        const useSpecular = !!(stdMat.useMetalness || stdMat.specularMap || stdMat.sphereMap || stdMat.cubeMap ||
                            notBlack(stdMat.specular) || stdMat.specularityFactor < 1 ||
                            stdMat.enableGGXSpecular ||
                            (stdMat.clearCoat > 0));

        const useSpecularColor = (!stdMat.useMetalness || stdMat.useMetalnessSpecularColor);
        const specularTint = useSpecular &&
                             (stdMat.specularTint || (!stdMat.specularMap && !stdMat.specularVertexColor)) &&
                             notWhite(stdMat.specular);

        const specularityFactorTint = useSpecular && stdMat.useMetalness && (stdMat.specularityFactor < 1 && !stdMat.specularityFactorMap);

        const emissiveTintColor = !stdMat.emissiveMap || (notWhite(stdMat.emissive) && stdMat.emissiveTint);
        const emissiveTintIntensity = (stdMat.emissiveIntensity !== 1);

        const isPackedNormalMap = stdMat.normalMap ? (stdMat.normalMap.format === PIXELFORMAT_DXT5 || stdMat.normalMap.type === TEXTURETYPE_SWIZZLEGGGR) : false;

        options.opacityTint = (stdMat.opacity !== 1 && stdMat.blendType !== BLEND_NONE) ? 1 : 0;
        options.blendMapsWithColors = true;
        options.ambientTint = stdMat.ambientTint;
        options.diffuseTint = diffuseTint ? 2 : 0;
        options.specularTint = specularTint ? 2 : 0;
        options.specularityFactorTint = specularityFactorTint ? 1 : 0;
        options.useSpecularityFactor = specularityFactorTint || !!stdMat.specularityFactorMap;
        options.useSpecularColor = useSpecularColor;
        options.metalnessTint = (stdMat.useMetalness && stdMat.metalness < 1) ? 1 : 0;
        options.glossTint = 1;
        options.emissiveTint = (emissiveTintColor ? 2 : 0) + (emissiveTintIntensity ? 1 : 0);
        options.alphaToCoverage = stdMat.alphaToCoverage;
        options.normalizeNormalMap = stdMat.normalizeNormalMap;
        options.ambientSH = !!stdMat.ambientSH;
        options.useSpecular = useSpecular;
        options.emissiveEncoding = stdMat.emissiveMap ? stdMat.emissiveMap.encoding : null;
        options.lightMapEncoding = stdMat.lightMap ? stdMat.lightMap.encoding : null;
        options.conserveEnergy = stdMat.conserveEnergy;
        options.opacityFadesSpecular = stdMat.opacityFadesSpecular;
        options.alphaFade = stdMat.alphaFade;
        options.occludeSpecular = stdMat.occludeSpecular;
        options.occludeSpecularFloat = (stdMat.occludeSpecularIntensity !== 1.0);
        options.occludeDirect = stdMat.occludeDirect;
        options.shadingModel = stdMat.shadingModel;
        options.fresnelModel = stdMat.fresnelModel;
        options.packedNormal = isPackedNormalMap;
        options.fastTbn = stdMat.fastTbn;
        options.cubeMapProjection = stdMat.cubeMapProjection;
        options.customFragmentShader = stdMat.customFragmentShader;
        options.refraction = !!stdMat.refraction || !!stdMat.refractionMap;
        options.refractionIndexTint = (stdMat.refractionIndex !== 1.5) ? 1 : 0;
        options.useMetalness = stdMat.useMetalness;
        options.specularEncoding = stdMat.specularEncoding === undefined ? 'linear' : stdMat.specularEncoding;
        options.enableGGXSpecular = stdMat.enableGGXSpecular;
        options.msdf = !!stdMat.msdfMap;
        options.msdfTextAttribute = !!stdMat.msdfTextAttribute;
        options.twoSidedLighting = stdMat.twoSidedLighting;
        options.pixelSnap = stdMat.pixelSnap;
        options.aoMapUv = stdMat.aoUvSet; // backwards compatibility
        options.diffuseDetail = !!stdMat.diffuseMap;
        options.normalDetail = !!stdMat.normalMap;
        options.diffuseDetailMode = stdMat.diffuseDetailMode;
        options.detailModes = !!options.diffuseDetail;
        options.clearCoat = !!stdMat.clearCoat;
        options.clearCoatTint = (stdMat.clearCoat !== 1.0) ? 1 : 0;
        options.clearCoatGlossiness = !!stdMat.clearCoatGlossiness;
        options.clearCoatGlossTint = (stdMat.clearCoatGlossiness !== 1.0) ? 1 : 0;

        options.sheen = stdMat.useSheen;
        options.sheenTint = (stdMat.useSheen && notWhite(stdMat.sheen)) ? 2 : 0;
        options.sheenGlossinessTint = (stdMat.useSheen && stdMat.sheenGlossiness < 1) ? 1 : 0;
    }

    _updateEnvOptions(options, stdMat, scene) {
        options.fog = stdMat.useFog ? scene.fog : 'none';
        options.gamma = stdMat.useGammaTonemap ? scene.gammaCorrection : GAMMA_NONE;
        options.toneMap = stdMat.useGammaTonemap ? scene.toneMapping : -1;
        options.fixSeams = (stdMat.cubeMap ? stdMat.cubeMap.fixCubemapSeams : false);

        const isPhong = stdMat.shadingModel === SPECULAR_PHONG;

        let usingSceneEnv = false;

        // source of environment reflections is as follows:
        if (stdMat.envAtlas && !isPhong) {
            options.reflectionSource = 'envAtlas';
            options.reflectionEncoding = stdMat.envAtlas.encoding;
        } else if (stdMat.cubeMap) {
            options.reflectionSource = 'cubeMap';
            options.reflectionEncoding = stdMat.cubeMap.encoding;
        } else if (stdMat.sphereMap) {
            options.reflectionSource = 'sphereMap';
            options.reflectionEncoding = stdMat.sphereMap.encoding;
        } else if (stdMat.useSkybox && scene.envAtlas && !isPhong) {
            options.reflectionSource = 'envAtlas';
            options.reflectionEncoding = scene.envAtlas.encoding;
            usingSceneEnv = true;
        } else if (stdMat.useSkybox && scene.skybox) {
            options.reflectionSource = 'cubeMap';
            options.reflectionEncoding = scene.skybox.encoding;
            usingSceneEnv = true;
        } else {
            options.reflectionSource = null;
            options.reflectionEncoding = null;
        }

        // source of environment ambient is as follows:
        if (stdMat.ambientSH && !isPhong) {
            options.ambientSource = 'ambientSH';
            options.ambientEncoding = null;
        } else {
            const envAtlas = stdMat.envAtlas || (stdMat.useSkybox && scene.envAtlas ? scene.envAtlas : null);
            if (envAtlas && !isPhong) {
                options.ambientSource = 'envAtlas';
                options.ambientEncoding = envAtlas.encoding;
            } else {
                options.ambientSource = 'constant';
                options.ambientEncoding = null;
            }
        }

        // TODO: add a test for if non skybox cubemaps have rotation (when this is supported) - for now assume no non-skybox cubemap rotation
        options.skyboxIntensity = usingSceneEnv && (scene.skyboxIntensity !== 1);
        options.useCubeMapRotation = usingSceneEnv && scene.skyboxRotation && !scene.skyboxRotation.equals(Quat.IDENTITY);
    }

    _updateLightOptions(options, stdMat, objDefs, sortedLights, staticLightList) {
        options.lightMap = false;
        options.lightMapChannel = '';
        options.lightMapUv = 0;
        options.lightMapTransform = 0;
        options.lightMapWithoutAmbient = false;
        options.dirLightMap = false;

        if (objDefs) {
            options.noShadow = (objDefs & SHADERDEF_NOSHADOW) !== 0;

            if ((objDefs & SHADERDEF_LM) !== 0) {
                options.lightMapEncoding = 'rgbm';
                options.lightMap = true;
                options.lightMapChannel = 'rgb';
                options.lightMapUv = 1;
                options.lightMapTransform = 0;
                options.lightMapWithoutAmbient = !stdMat.lightMap;
                if ((objDefs & SHADERDEF_DIRLM) !== 0) {
                    options.dirLightMap = true;
                }

                // if lightmaps contain baked ambient light, disable real-time ambient light
                if ((objDefs & SHADERDEF_LMAMBIENT) !== 0) {
                    options.lightMapWithoutAmbient = false;
                }
            }
        }

        if (stdMat.useLighting) {
            const lightsFiltered = [];
            const mask = objDefs ? (objDefs >> 16) : MASK_AFFECT_DYNAMIC;

            // mask to select lights (dynamic vs lightmapped) when using clustered lighting
            options.lightMaskDynamic = !!(mask & MASK_AFFECT_DYNAMIC);

            if (sortedLights) {
                this._collectLights(LIGHTTYPE_DIRECTIONAL, sortedLights[LIGHTTYPE_DIRECTIONAL], lightsFiltered, mask);
                this._collectLights(LIGHTTYPE_OMNI, sortedLights[LIGHTTYPE_OMNI], lightsFiltered, mask, staticLightList);
                this._collectLights(LIGHTTYPE_SPOT, sortedLights[LIGHTTYPE_SPOT], lightsFiltered, mask, staticLightList);
            }
            options.lights = lightsFiltered;
        } else {
            options.lights = [];
        }

        if (options.lights.length === 0) {
            options.noShadow = true;
        }
    }

    _updateTexOptions(options, stdMat, p, hasUv0, hasUv1, hasVcolor, minimalOptions) {
        const mname = p + 'Map';
        const vname = p + 'VertexColor';
        const vcname = p + 'VertexColorChannel';
        const cname = mname + 'Channel';
        const tname = mname + 'Transform';
        const uname = mname + 'Uv';

        // Avoid overriding previous lightMap properties
        if (p !== 'light') {
            options[mname] = false;
            options[cname] = '';
            options[tname] = 0;
            options[uname] = 0;
        }
        options[vname] = false;
        options[vcname] = '';

        const isOpacity = p === 'opacity';
        if (isOpacity && stdMat.blendType === BLEND_NONE && stdMat.alphaTest === 0.0 && !stdMat.alphaToCoverage)
            return;

        if (!minimalOptions || isOpacity) {
            if (p !== 'height' && stdMat[vname]) {
                if (hasVcolor) {
                    options[vname] = stdMat[vname];
                    options[vcname] = stdMat[vcname];
                    options.vertexColors = true;
                }
            }
            if (stdMat[mname]) {
                let allow = true;
                if (stdMat[uname] === 0 && !hasUv0) allow = false;
                if (stdMat[uname] === 1 && !hasUv1) allow = false;
                if (allow) {
                    options[mname] = !!stdMat[mname];
                    options[tname] = this._getMapTransformID(stdMat.getUniform(tname), stdMat[uname]);
                    options[cname] = stdMat[cname];
                    options[uname] = stdMat[uname];
                }
            }
        }
    }

    _collectLights(lType, lights, lightsFiltered, mask, staticLightList) {
        for (let i = 0; i < lights.length; i++) {
            const light = lights[i];
            if (light.enabled) {
                if (light.mask & mask) {
                    if (lType !== LIGHTTYPE_DIRECTIONAL) {
                        if (light.isStatic) {
                            continue;
                        }
                    }
                    lightsFiltered.push(light);
                }
            }
        }

        if (staticLightList) {
            for (let i = 0; i < staticLightList.length; i++) {
                const light = staticLightList[i];
                if (light._type === lType) {
                    lightsFiltered.push(light);
                }
            }
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
