import {
    SEMANTIC_ATTR8, SEMANTIC_ATTR9, SEMANTIC_ATTR12, SEMANTIC_ATTR11, SEMANTIC_ATTR14, SEMANTIC_ATTR15,
    SEMANTIC_BLENDINDICES, SEMANTIC_BLENDWEIGHT, SEMANTIC_COLOR, SEMANTIC_NORMAL, SEMANTIC_POSITION, SEMANTIC_TANGENT,
    SEMANTIC_TEXCOORD0, SEMANTIC_TEXCOORD1,
    SHADERLANGUAGE_GLSL,
    SHADERLANGUAGE_WGSL,
    primitiveGlslToWgslTypeMap
} from '../../../platform/graphics/constants.js';
import {
    LIGHTSHAPE_PUNCTUAL,
    LIGHTTYPE_DIRECTIONAL, LIGHTTYPE_OMNI, LIGHTTYPE_SPOT,
    SHADER_PICK,
    SPRITE_RENDERMODE_SLICED, SPRITE_RENDERMODE_TILED, shadowTypeInfo, SHADER_PREPASS,
    lightTypeNames, lightShapeNames, spriteRenderModeNames, fresnelNames, blendNames, lightFalloffNames,
    cubemaProjectionNames, specularOcclusionNames, reflectionSrcNames, ambientSrcNames,
    REFLECTIONSRC_NONE
} from '../../constants.js';
import { ChunkUtils } from '../chunk-utils.js';
import { ShaderPass } from '../../shader-pass.js';
import { validateUserChunks } from '../glsl/chunks/chunk-validation.js';
import { Debug } from '../../../core/debug.js';
import { ShaderChunks } from '../shader-chunks.js';

/**
 * @import { GraphicsDevice } from '../../../platform/graphics/graphics-device.js'
 * @import { LitShaderOptions } from './lit-shader-options.js'
 */

const builtinAttributes = {
    vertex_normal: SEMANTIC_NORMAL,
    vertex_tangent: SEMANTIC_TANGENT,
    vertex_texCoord0: SEMANTIC_TEXCOORD0,
    vertex_texCoord1: SEMANTIC_TEXCOORD1,
    vertex_color: SEMANTIC_COLOR,
    vertex_boneWeights: SEMANTIC_BLENDWEIGHT,
    vertex_boneIndices: SEMANTIC_BLENDINDICES
};

class LitShader {
    /**
     * Shader code representing varyings.
     *
     * @type {string}
     */
    varyingsCode = '';

    /**
     * The graphics device.
     *
     * @type {GraphicsDevice}
     */
    device;

    /**
     * The lit options.
     *
     * @type {LitShaderOptions}
     */
    options;

    /**
     * The shader language, {@link SHADERLANGUAGE_GLSL} or {@link SHADERLANGUAGE_WGSL}.
     *
     * @type {string}
     */
    shaderLanguage;

    /**
     * The vertex shader defines needed for the shader compilation.
     *
     * @type {Map<string, string>}
     */
    vDefines = new Map();

    /**
     * The fragment shader defines needed for the shader compilation.
     *
     * @type {Map<string, string>}
     */
    fDefines = new Map();

    /**
     * The vertex and fragment shader includes needed for the shader compilation.
     *
     * @type {Map<string, string>}
     */
    includes = new Map();

    /**
     * The shader chunks to use for the shader generation.
     *
     * @type {Map<string, string>}
     */
    chunks = null;

    /**
     * @param {GraphicsDevice} device - The graphics device.
     * @param {LitShaderOptions} options - The lit options.
     * @param {boolean} [allowWGSL] - Whether to allow WGSL shader language.
     */
    constructor(device, options, allowWGSL = true) {
        this.device = device;
        this.options = options;

        // shader language
        const userChunks = options.shaderChunks;
        this.shaderLanguage = (device.isWebGPU && allowWGSL && (!userChunks || userChunks.useWGSL)) ? SHADERLANGUAGE_WGSL : SHADERLANGUAGE_GLSL;

        if (device.isWebGPU && this.shaderLanguage === SHADERLANGUAGE_GLSL) {
            if (!device.hasTranspilers) {
                Debug.errorOnce('Cannot use GLSL shader on WebGPU without transpilers', {
                    litShader: this
                });
            }
        }

        // resolve custom chunk attributes
        this.attributes = {
            vertex_position: SEMANTIC_POSITION
        };

        if (options.userAttributes) {
            for (const [semantic, name] of Object.entries(options.userAttributes)) {
                this.attributes[name] = semantic;
            }
        }

        // start with the default engine chunks
        const engineChunks = ShaderChunks.get(device, this.shaderLanguage);
        this.chunks = new Map(engineChunks);

        // optionally add user chunks
        if (userChunks) {
            const userChunkMap = this.shaderLanguage === SHADERLANGUAGE_GLSL ? userChunks.glsl : userChunks.wgsl;

            Debug.call(() => {
                validateUserChunks(userChunkMap, userChunks.version);
            });

            userChunkMap.forEach((chunk, chunkName) => {

                // extract attribute names from the used chunk
                Debug.assert(chunk);
                for (const a in builtinAttributes) {
                    if (builtinAttributes.hasOwnProperty(a) && chunk.indexOf(a) >= 0) {
                        this.attributes[a] = builtinAttributes[a];
                    }
                }

                // add user chunk
                this.chunks.set(chunkName, chunk);
            });
        }

        this.shaderPassInfo = ShaderPass.get(this.device).getByIndex(options.pass);
        this.shadowPass = this.shaderPassInfo.isShadow;

        this.lighting = (options.lights.length > 0) || options.dirLightMapEnabled || options.clusteredLightingEnabled;
        this.reflections = options.reflectionSource !== REFLECTIONSRC_NONE;
        this.needsNormal =
            this.lighting ||
            this.reflections ||
            options.useSpecular ||
            options.ambientSH ||
            options.useHeights ||
            options.enableGGXSpecular ||
            (options.clusteredLightingEnabled && !this.shadowPass) ||
            options.useClearCoatNormals;
        this.needsNormal = this.needsNormal && !this.shadowPass;
        this.needsSceneColor = options.useDynamicRefraction;
        this.needsScreenSize = options.useDynamicRefraction;
        this.needsTransforms = options.useDynamicRefraction;

        // generated by vshader
        this.vshader = null;

        // generated by fshader
        this.fshader = null;
    }

    /**
     * Helper function to define a value in the fragment shader.
     *
     * @param {boolean} condition - The define is added if the condition is true.
     * @param {string} name - The define name.
     * @param {string} [value] - The define value.
     */
    fDefineSet(condition, name, value = '') {
        if (condition) {
            this.fDefines.set(name, value);
        }
    }

    /**
     * The function generates defines for the lit vertex shader, and handles required attributes and
     * varyings. The source code of the shader is supplied by litMainVS chunk. This vertex shader is
     * used for all render passes.
     *
     * @param {any} useUv - Info about used UVs.
     * @param {any} useUnmodifiedUv - Info about used unmodified UVs.
     * @param {any} mapTransforms - Info about used texture transforms.
     */
    generateVertexShader(useUv, useUnmodifiedUv, mapTransforms) {

        const { options, vDefines, attributes } = this;

        // varyings
        const varyings = new Map();
        varyings.set('vPositionW', 'vec3');

        if (options.nineSlicedMode === SPRITE_RENDERMODE_SLICED || options.nineSlicedMode === SPRITE_RENDERMODE_TILED) {
            vDefines.set('NINESLICED', true);
        }

        if (this.options.linearDepth) {
            vDefines.set('LINEAR_DEPTH', true);
            varyings.set('vLinearDepth', 'float');
        }

        if (this.needsNormal) vDefines.set('NORMALS', true);

        if (this.options.useInstancing) {

            // only attach these if the default instancing chunk is used, otherwise it is expected
            // for the user to provide required attributes using material.setAttribute
            const languageChunks = ShaderChunks.get(this.device, this.shaderLanguage);
            if (this.chunks.get('transformInstancingVS') === languageChunks.get('transformInstancingVS')) {
                attributes.instance_line1 = SEMANTIC_ATTR11;
                attributes.instance_line2 = SEMANTIC_ATTR12;
                attributes.instance_line3 = SEMANTIC_ATTR14;
                attributes.instance_line4 = SEMANTIC_ATTR15;
            }
        }

        if (this.needsNormal) {
            attributes.vertex_normal = SEMANTIC_NORMAL;
            varyings.set('vNormalW', 'vec3');

            if (options.hasTangents && (options.useHeights || options.useNormals || options.useClearCoatNormals || options.enableGGXSpecular)) {

                vDefines.set('TANGENTS', true);
                attributes.vertex_tangent = SEMANTIC_TANGENT;
                varyings.set('vTangentW', 'vec3');
                varyings.set('vBinormalW', 'vec3');

            } else if (options.enableGGXSpecular) {

                vDefines.set('GGX_SPECULAR', true);
                varyings.set('vObjectSpaceUpW', 'vec3');
            }
        }

        const maxUvSets = 2;
        for (let i = 0; i < maxUvSets; i++) {
            if (useUv[i]) {
                vDefines.set(`UV${i}`, true);
                attributes[`vertex_texCoord${i}`] = `TEXCOORD${i}`;
            }
            if (useUnmodifiedUv[i]) {
                vDefines.set(`UV${i}_UNMODIFIED`, true);
                varyings.set(`vUv${i}`, 'vec2');
            }
        }

        // prepare defines for texture transforms
        let numTransforms = 0;
        const transformDone = new Set();
        mapTransforms.forEach((mapTransform) => {

            const { id, uv, name } = mapTransform;
            const checkId = id + uv * 100; // make sure each UV set is transformed by each unique transform only once

            if (!transformDone.has(checkId)) {
                transformDone.add(checkId);

                // register the varying
                varyings.set(`vUV${uv}_${id}`, 'vec2');

                // defines used by the included chunks
                const varName = `texture_${name}MapTransform`;
                vDefines.set(`{TRANSFORM_NAME_${numTransforms}}`, varName);
                vDefines.set(`{TRANSFORM_UV_${numTransforms}}`, uv);
                vDefines.set(`{TRANSFORM_ID_${numTransforms}}`, id);

                numTransforms++;
            }
        });

        // number of transforms, this drives the looped includes
        vDefines.set('UV_TRANSFORMS_COUNT', numTransforms);

        if (options.vertexColors) {
            attributes.vertex_color = SEMANTIC_COLOR;
            vDefines.set('VERTEX_COLOR', true);
            varyings.set('vVertexColor', 'vec4');
            if (options.useVertexColorGamma) {
                vDefines.set('STD_VERTEX_COLOR_GAMMA', '');
            }
        }

        if (options.useMsdf && options.msdfTextAttribute) {
            attributes.vertex_outlineParameters = SEMANTIC_ATTR8;
            attributes.vertex_shadowParameters = SEMANTIC_ATTR9;
            vDefines.set('MSDF', true);
        }

        // morphing
        if (options.useMorphPosition || options.useMorphNormal) {

            vDefines.set('MORPHING', true);
            if (options.useMorphTextureBasedInt) vDefines.set('MORPHING_INT', true);
            if (options.useMorphPosition) vDefines.set('MORPHING_POSITION', true);
            if (options.useMorphNormal) vDefines.set('MORPHING_NORMAL', true);

            // vertex ids attributes
            attributes.morph_vertex_id = SEMANTIC_ATTR15;
        }

        if (options.skin) {

            attributes.vertex_boneIndices = SEMANTIC_BLENDINDICES;

            if (options.batch) {
                vDefines.set('BATCH', true);
            } else {
                attributes.vertex_boneWeights = SEMANTIC_BLENDWEIGHT;
                vDefines.set('SKIN', true);
            }
        }

        if (options.useInstancing) vDefines.set('INSTANCING', true);
        if (options.screenSpace) vDefines.set('SCREENSPACE', true);
        if (options.pixelSnap) vDefines.set('PIXELSNAP', true);

        // generate varyings code
        varyings.forEach((type, name) => {
            this.varyingsCode += `#define VARYING_${name.toUpperCase()}\n`;
            this.varyingsCode += this.shaderLanguage === SHADERLANGUAGE_WGSL ?
                `varying ${name}: ${primitiveGlslToWgslTypeMap.get(type)};\n` :
                `varying ${type} ${name};\n`;
        });

        // varyings code exposed as an include
        this.includes.set('varyingsVS', this.varyingsCode);
        this.includes.set('varyingsPS', this.varyingsCode);

        this.vshader = `
            #include "litMainVS"
        `;
    }

    /**
     * Generate defines for lighting environment as well as individual lights.
     *
     * @param {boolean} hasAreaLights - Whether any of the lights are area lights.
     * @param {boolean} clusteredLightingEnabled - Whether clustered lighting is enabled.
     */
    _setupLightingDefines(hasAreaLights, clusteredLightingEnabled) {

        const fDefines = this.fDefines;
        const options = this.options;

        this.fDefines.set('LIGHT_COUNT', options.lights.length);
        if (hasAreaLights) fDefines.set('AREA_LIGHTS', true);

        // clustered lights defines
        if (clusteredLightingEnabled && this.lighting) {
            fDefines.set('LIT_CLUSTERED_LIGHTS', true);
            if (options.clusteredLightingCookiesEnabled) fDefines.set('CLUSTER_COOKIES', true);
            if (options.clusteredLightingAreaLightsEnabled) fDefines.set('CLUSTER_AREALIGHTS', true);
            if (options.lightMaskDynamic) fDefines.set('CLUSTER_MESH_DYNAMIC_LIGHTS', true);

            // shadows
            if (options.clusteredLightingShadowsEnabled && !options.noShadow) {
                const clusteredShadowInfo = shadowTypeInfo.get(options.clusteredLightingShadowType);
                fDefines.set('CLUSTER_SHADOWS', true);
                fDefines.set(`SHADOW_KIND_${clusteredShadowInfo.kind}`, true);
                fDefines.set(`CLUSTER_SHADOW_TYPE_${clusteredShadowInfo.kind}`, true);
            }
        }

        // generate defines for all non-clustered lights
        for (let i = 0; i < options.lights.length; i++) {
            const light = options.lights[i];
            const lightType = light._type;

            // when clustered lighting is enabled, skip non-directional lights
            if (clusteredLightingEnabled && lightType !== LIGHTTYPE_DIRECTIONAL) {
                continue;
            }

            const lightShape = (hasAreaLights && light._shape) ? light._shape : LIGHTSHAPE_PUNCTUAL;
            const shadowType = light._shadowType;
            const castShadow = light.castShadows && !options.noShadow;
            const shadowInfo = shadowTypeInfo.get(shadowType);
            Debug.assert(shadowInfo);

            // per light defines
            fDefines.set(`LIGHT${i}`, true);
            fDefines.set(`LIGHT${i}TYPE`, `${lightTypeNames[lightType]}`);
            fDefines.set(`LIGHT${i}SHADOWTYPE`, `${shadowInfo.name}`);
            fDefines.set(`LIGHT${i}SHAPE`, `${lightShapeNames[lightShape]}`);
            fDefines.set(`LIGHT${i}FALLOFF`, `${lightFalloffNames[light._falloffMode]}`);
            if (light.affectSpecularity) fDefines.set(`LIGHT${i}AFFECT_SPECULARITY`, true);

            if (light._cookie) {
                if (lightType === LIGHTTYPE_SPOT && !light._cookie._cubemap ||
                    lightType === LIGHTTYPE_OMNI && light._cookie._cubemap) {
                    fDefines.set(`LIGHT${i}COOKIE`, true);
                    fDefines.set(`{LIGHT${i}COOKIE_CHANNEL}`, light._cookieChannel);
                    if (lightType === LIGHTTYPE_SPOT) {
                        if (light._cookieTransform) fDefines.set(`LIGHT${i}COOKIE_TRANSFORM`, true);
                        if (light._cookieFalloff) fDefines.set(`LIGHT${i}COOKIE_FALLOFF`, true);
                    }
                }
            }

            if (castShadow) {
                fDefines.set(`LIGHT${i}CASTSHADOW`, true);
                if (shadowInfo.pcf) fDefines.set(`LIGHT${i}SHADOW_PCF`, true);

                // shadow addressing defines, used by lightFunctionShadowPS
                if (light._normalOffsetBias && !light._isVsm) fDefines.set(`LIGHT${i}_SHADOW_SAMPLE_NORMAL_OFFSET`, true);
                if (lightType === LIGHTTYPE_DIRECTIONAL) {
                    fDefines.set(`LIGHT${i}_SHADOW_SAMPLE_ORTHO`, true);
                    if (light.cascadeBlend > 0) fDefines.set(`LIGHT${i}_SHADOW_CASCADE_BLEND`, true);
                    if (light.numCascades > 1) fDefines.set(`LIGHT${i}_SHADOW_CASCADES`, true);
                }
                if (shadowInfo.pcf || shadowInfo.pcss || this.device.isWebGPU) fDefines.set(`LIGHT${i}_SHADOW_SAMPLE_SOURCE_ZBUFFER`, true);
                if (lightType === LIGHTTYPE_OMNI) fDefines.set(`LIGHT${i}_SHADOW_SAMPLE_POINT`, true);
            }

            // global lighting defines
            if (castShadow) {
                fDefines.set(`SHADOW_KIND_${shadowInfo.kind}`, true);
                if (lightType === LIGHTTYPE_DIRECTIONAL) fDefines.set('SHADOW_DIRECTIONAL', true);
            }
        }
    }

    prepareForwardPass(lightingUv) {
        const { options } = this;

        // area lights are used when clustered area lights are enabled or any lights have area shape
        const clusteredAreaLights = options.clusteredLightingEnabled && options.clusteredLightingAreaLightsEnabled;
        const hasAreaLights = clusteredAreaLights || options.lights.some((light) => {
            return light._shape && light._shape !== LIGHTSHAPE_PUNCTUAL;
        });
        const addAmbient = !options.lightMapEnabled || options.lightMapWithoutAmbient;
        const hasTBN = this.needsNormal && (options.useNormals || options.useClearCoatNormals || (options.enableGGXSpecular && !options.useHeights));

        if (options.useSpecular) {
            this.fDefineSet(true, 'LIT_SPECULAR');
            this.fDefineSet(this.reflections, 'LIT_REFLECTIONS');
            this.fDefineSet(options.useClearCoat, 'LIT_CLEARCOAT');
            this.fDefineSet(options.fresnelModel > 0, 'LIT_SPECULAR_FRESNEL');
            this.fDefineSet(options.useSheen, 'LIT_SHEEN');
            this.fDefineSet(options.useIridescence, 'LIT_IRIDESCENCE');
        }
        this.fDefineSet((this.lighting && options.useSpecular) || this.reflections, 'LIT_SPECULAR_OR_REFLECTION');
        this.fDefineSet(this.needsSceneColor, 'LIT_SCENE_COLOR');
        this.fDefineSet(this.needsScreenSize, 'LIT_SCREEN_SIZE');
        this.fDefineSet(this.needsTransforms, 'LIT_TRANSFORMS');
        this.fDefineSet(this.needsNormal, 'LIT_NEEDS_NORMAL');
        this.fDefineSet(this.lighting, 'LIT_LIGHTING');
        this.fDefineSet(options.useMetalness, 'LIT_METALNESS');
        this.fDefineSet(options.enableGGXSpecular, 'LIT_GGX_SPECULAR');
        this.fDefineSet(options.useSpecularityFactor, 'LIT_SPECULARITY_FACTOR');
        this.fDefineSet(options.useCubeMapRotation, 'CUBEMAP_ROTATION');
        this.fDefineSet(options.occludeSpecularFloat, 'LIT_OCCLUDE_SPECULAR_FLOAT');
        this.fDefineSet(options.separateAmbient, 'LIT_SEPARATE_AMBIENT');
        this.fDefineSet(options.twoSidedLighting, 'LIT_TWO_SIDED_LIGHTING');
        this.fDefineSet(options.lightMapEnabled, 'LIT_LIGHTMAP');
        this.fDefineSet(options.dirLightMapEnabled, 'LIT_DIR_LIGHTMAP');
        this.fDefineSet(options.skyboxIntensity > 0, 'LIT_SKYBOX_INTENSITY');
        this.fDefineSet(options.clusteredLightingShadowsEnabled, 'LIT_CLUSTERED_SHADOWS');
        this.fDefineSet(options.clusteredLightingAreaLightsEnabled, 'LIT_CLUSTERED_AREA_LIGHTS');
        this.fDefineSet(hasTBN, 'LIT_TBN');
        this.fDefineSet(addAmbient, 'LIT_ADD_AMBIENT');
        this.fDefineSet(options.hasTangents, 'LIT_TANGENTS');
        this.fDefineSet(options.useNormals, 'LIT_USE_NORMALS');
        this.fDefineSet(options.useClearCoatNormals, 'LIT_USE_CLEARCOAT_NORMALS');
        this.fDefineSet(options.useRefraction, 'LIT_REFRACTION');
        this.fDefineSet(options.useDynamicRefraction, 'LIT_DYNAMIC_REFRACTION');
        this.fDefineSet(options.dispersion, 'LIT_DISPERSION');
        this.fDefineSet(options.useHeights, 'LIT_HEIGHTS');
        this.fDefineSet(options.opacityFadesSpecular, 'LIT_OPACITY_FADES_SPECULAR');
        this.fDefineSet(options.alphaToCoverage, 'LIT_ALPHA_TO_COVERAGE');
        this.fDefineSet(options.alphaTest, 'LIT_ALPHA_TEST');
        this.fDefineSet(options.useMsdf, 'LIT_MSDF');
        this.fDefineSet(options.ssao, 'LIT_SSAO');
        this.fDefineSet(options.useAo, 'LIT_AO');
        this.fDefineSet(options.occludeDirect, 'LIT_OCCLUDE_DIRECT');
        this.fDefineSet(options.msdfTextAttribute, 'LIT_MSDF_TEXT_ATTRIBUTE');
        this.fDefineSet(options.diffuseMapEnabled, 'LIT_DIFFUSE_MAP');
        this.fDefineSet(options.shadowCatcher, 'LIT_SHADOW_CATCHER');
        this.fDefineSet(true, 'LIT_FRESNEL_MODEL', fresnelNames[options.fresnelModel]);
        this.fDefineSet(true, 'LIT_NONE_SLICE_MODE', spriteRenderModeNames[options.nineSlicedMode]);
        this.fDefineSet(true, 'LIT_BLEND_TYPE', blendNames[options.blendType]);
        this.fDefineSet(true, 'LIT_CUBEMAP_PROJECTION', cubemaProjectionNames[options.cubeMapProjection]);
        this.fDefineSet(true, 'LIT_OCCLUDE_SPECULAR', specularOcclusionNames[options.occludeSpecular]);
        this.fDefineSet(true, 'LIT_REFLECTION_SOURCE', reflectionSrcNames[options.reflectionSource]);
        this.fDefineSet(true, 'LIT_AMBIENT_SOURCE', ambientSrcNames[options.ambientSource]);

        // injection defines
        this.fDefineSet(true, '{lightingUv}', lightingUv ?? ''); // example: vUV0_1
        this.fDefineSet(true, '{reflectionDecode}', ChunkUtils.decodeFunc(options.reflectionEncoding));
        this.fDefineSet(true, '{reflectionCubemapDecode}', ChunkUtils.decodeFunc(options.reflectionCubemapEncoding));
        this.fDefineSet(true, '{ambientDecode}', ChunkUtils.decodeFunc(options.ambientEncoding));

        // lighting defines
        this._setupLightingDefines(hasAreaLights, options.clusteredLightingEnabled);
    }

    prepareShadowPass() {

        const { options } = this;
        const lightType = this.shaderPassInfo.lightType;

        const shadowType = this.shaderPassInfo.shadowType;
        const shadowInfo = shadowTypeInfo.get(shadowType);
        Debug.assert(shadowInfo);

        // Use perspective depth for:
        // - Directional: Always since light has no position
        // - Spot: If not using VSM
        // - Point: Never
        const usePerspectiveDepth = (lightType === LIGHTTYPE_DIRECTIONAL || (!shadowInfo.vsm && lightType === LIGHTTYPE_SPOT));

        this.fDefineSet(usePerspectiveDepth, 'PERSPECTIVE_DEPTH');
        this.fDefineSet(true, 'LIGHT_TYPE', `${lightTypeNames[lightType]}`);
        this.fDefineSet(true, 'SHADOW_TYPE', `${shadowInfo.name}`);
        this.fDefineSet(options.alphaTest, 'LIT_ALPHA_TEST');
    }

    /**
     * Generates a fragment shader.
     *
     * @param {string} frontendDecl - Frontend declarations like `float dAlpha;`
     * @param {string} frontendCode - Frontend code containing `getOpacity()` etc.
     * @param {string} lightingUv - E.g. `vUv0`
     */
    generateFragmentShader(frontendDecl, frontendCode, lightingUv) {
        const options = this.options;

        // generated code is exposed as an include
        this.includes.set('frontendDeclPS', frontendDecl ?? '');
        this.includes.set('frontendCodePS', frontendCode ?? '');

        if (options.pass === SHADER_PICK || options.pass === SHADER_PREPASS) {
            // nothing to prepare currently
        } else if (this.shadowPass) {
            this.prepareShadowPass();
        } else {
            this.prepareForwardPass(lightingUv);
        }

        this.fshader = `
            #include "litMainPS"
        `;
    }
}

export { LitShader };
