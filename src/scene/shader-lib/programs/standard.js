import { Debug } from '../../../core/debug.js';
import {
    BLEND_NONE, DITHER_NONE, ditherNames, FRESNEL_SCHLICK,
    SHADER_FORWARD,
    SPRITE_RENDERMODE_SLICED, SPRITE_RENDERMODE_TILED
} from '../../constants.js';
import { ShaderPass } from '../../shader-pass.js';
import { LitShader } from './lit-shader.js';
import { ChunkBuilder } from '../chunk-builder.js';
import { ChunkUtils } from '../chunk-utils.js';
import { StandardMaterialOptions } from '../../materials/standard-material-options.js';
import { LitOptionsUtils } from './lit-options-utils.js';
import { ShaderGenerator } from './shader-generator.js';
import { ShaderUtils } from '../../../platform/graphics/shader-utils.js';
import { SHADERTAG_MATERIAL } from '../../../platform/graphics/constants.js';

/**
 * @import { GraphicsDevice } from '../../../platform/graphics/graphics-device.js'
 */

const _matTex2D = [];

const buildPropertiesList = (options) => {
    return Object.keys(options)
    .filter(key => key !== 'litOptions')
    .sort();
};

class ShaderGeneratorStandard extends ShaderGenerator {
    // Shared Standard Material option structures
    optionsContext = new StandardMaterialOptions();

    optionsContextMin = new StandardMaterialOptions();

    generateKey(options) {
        let props;
        if (options === this.optionsContextMin) {
            if (!this.propsMin) this.propsMin = buildPropertiesList(options);
            props = this.propsMin;
        } else if (options === this.optionsContext) {
            if (!this.props) this.props = buildPropertiesList(options);
            props = this.props;
        } else {
            props = buildPropertiesList(options);
        }

        const definesHash = ShaderGenerator.definesHash(options.defines);
        const key = `standard:\n${definesHash}\n${
            props.map(prop => prop + options[prop]).join('\n')
        }${LitOptionsUtils.generateKey(options.litOptions)}`;

        return key;
    }

    /**
     * Get the code with which to to replace '*_TEXTURE_UV' in the map shader functions.
     *
     * @param {string} transformPropName - Name of the transform id in the options block. Usually "basenameTransform".
     * @param {string} uVPropName - Name of the UV channel in the options block. Usually "basenameUv".
     * @param {object} options - The options passed into createShaderDefinition.
     * @returns {string} The code used to replace '*_TEXTURE_UV' in the shader code.
     * @private
     */
    _getUvSourceExpression(transformPropName, uVPropName, options) {
        const transformId = options[transformPropName];
        const uvChannel = options[uVPropName];
        const isMainPass = options.litOptions.pass === SHADER_FORWARD;

        let expression;
        if (isMainPass && options.litOptions.nineSlicedMode === SPRITE_RENDERMODE_SLICED) {
            expression = 'nineSlicedUv';
        } else if (isMainPass && options.litOptions.nineSlicedMode === SPRITE_RENDERMODE_TILED) {
            expression = 'nineSlicedUv';
        } else {
            if (transformId === 0) {
                expression = `vUv${uvChannel}`;
            } else {
                // note: different capitalization!
                expression = `vUV${uvChannel}_${transformId}`;
            }

            // if heightmap is enabled all maps except the heightmap are offset
            if (options.heightMap && transformPropName !== 'heightMapTransform') {
                expression += ' + dUvOffset';
            }
        }

        return expression;
    }

    _validateMapChunk(propName, chunkName, chunks) {
        Debug.call(() => {
            const code = chunks[chunkName];
            const requiredChangeStrings = [];

            // Helper function to add a formatted change string if the old syntax is found
            const trackChange = (oldSyntax, newSyntax) => {
                if (code.includes(oldSyntax)) {
                    requiredChangeStrings.push(`  ${oldSyntax} -> ${newSyntax}`);
                }
            };

            // inject defines (with curly braces)
            [
                ['$UV',         `{STD_${propName}_TEXTURE_UV}`],
                ['$CH',         `{STD_${propName}_TEXTURE_CHANNEL}`],
                ['$SAMPLER',    `{STD_${propName}_TEXTURE_NAME}`],
                ['$DECODE',     `{STD_${propName}_TEXTURE_DECODE}`],
                ['$VC',         `{STD_${propName}_VERTEX_CHANNEL}`],
                ['$DETAILMODE', `{STD_${propName}_DETAILMODE}`],
                ['unpackNormal(', `{STD_${propName}_TEXTURE_DECODE}(`]
            ].forEach(([oldSyntax, newSyntax]) => trackChange(oldSyntax, newSyntax));

            // defines
            [
                ['MAPFLOAT',   `STD_${propName}_CONSTANT`],
                ['MAPCOLOR',   `STD_${propName}_CONSTANT`],
                ['MAPVERTEX',  `STD_${propName}_VERTEX`],
                ['MAPTEXTURE', `STD_${propName}_TEXTURE`],
                ['MAPINVERT',  `STD_${propName}_INVERT`]
            ].forEach(([oldSyntax, newSyntax]) => trackChange(oldSyntax, newSyntax));

            // custom handling
            if (code.includes('$texture2DSAMPLE')) {
                trackChange('$texture2DSAMPLE', '(Macro no longer supported - remove/refactor)');
            }

            if (requiredChangeStrings.length > 0) {
                Debug.errorOnce(`Shader chunk ${chunkName} is in no longer compatible format. Please make these replacements to bring it to the current version:\n${requiredChangeStrings.join('\n')}`, { code: code });
            }
        });
    }

    /**
     * Add chunk for Map Types (used for all maps except Normal).
     *
     * @param {Map<string, string>} fDefines - The fragment defines.
     * @param {string} propName - The base name of the map: diffuse | emissive | opacity | light | height | metalness | specular | gloss | ao.
     * @param {string} chunkName - The name of the chunk to use. Usually "basenamePS".
     * @param {object} options - The options passed into to createShaderDefinition.
     * @param {object} chunks - The set of shader chunks to choose from.
     * @param {object} mapping - The mapping between chunk and sampler
     * @param {string|null} encoding - The texture's encoding
     * @returns {string} The shader code to support this map.
     * @private
     */
    _addMap(fDefines, propName, chunkName, options, chunks, mapping, encoding = null) {
        const mapPropName = `${propName}Map`;
        const propNameCaps = propName.toUpperCase();
        const uVPropName = `${mapPropName}Uv`;
        const identifierPropName = `${mapPropName}Identifier`;
        const transformPropName = `${mapPropName}Transform`;
        const channelPropName = `${mapPropName}Channel`;
        const vertexColorChannelPropName = `${propName}VertexColorChannel`;
        const tintPropName = `${propName}Tint`;
        const vertexColorPropName = `${propName}VertexColor`;
        const detailModePropName = `${propName}Mode`;
        const invertName = `${propName}Invert`;

        const tintOption = options[tintPropName];
        const vertexColorOption = options[vertexColorPropName];
        const textureOption = options[mapPropName];
        const textureIdentifier = options[identifierPropName];
        const detailModeOption = options[detailModePropName];

        const chunkCode = chunks[chunkName];

        // log errors if the chunk format is deprecated (format changed in engine 2.7)
        Debug.call(() => {
            if (chunkCode) {
                this._validateMapChunk(propNameCaps, chunkName, chunks);
            }
        });

        if (textureOption) {

            fDefines.set(`STD_${propNameCaps}_TEXTURE`, '');

            const uv = this._getUvSourceExpression(transformPropName, uVPropName, options);

            // chunk injection defines
            fDefines.set(`{STD_${propNameCaps}_TEXTURE_UV}`, uv);
            fDefines.set(`{STD_${propNameCaps}_TEXTURE_CHANNEL}`, options[channelPropName]);

            // texture sampler define
            const textureId = `{STD_${propNameCaps}_TEXTURE_NAME}`;
            if (chunkCode.includes(textureId)) {
                let samplerName = `texture_${mapPropName}`;
                const alias = mapping[textureIdentifier];
                if (alias) {
                    samplerName = alias;
                } else {
                    mapping[textureIdentifier] = samplerName;

                    // texture is not aliased to existing texture, create a new one
                    fDefines.set(`STD_${propNameCaps}_TEXTURE_ALLOCATE`, '');
                }
                fDefines.set(textureId, samplerName);
            }

            if (encoding) {
                // decode function, ignored for alpha channel
                const textureDecode = options[channelPropName] === 'aaa' ? 'passThrough' : ChunkUtils.decodeFunc(encoding);
                fDefines.set(`{STD_${propNameCaps}_TEXTURE_DECODE}`, textureDecode);
            }
        }

        if (vertexColorOption) {
            fDefines.set(`STD_${propNameCaps}_VERTEX`, '');
            fDefines.set(`{STD_${propNameCaps}_VERTEX_CHANNEL}`, options[vertexColorChannelPropName]);
        }

        if (detailModeOption) {
            fDefines.set(`{STD_${propNameCaps}_DETAILMODE}`, detailModeOption);
        }

        if (tintOption) {
            fDefines.set(`STD_${propNameCaps}_CONSTANT`, '');
        }
        if (!!(options[invertName])) {
            fDefines.set(`STD_${propNameCaps}_INVERT`, '');
        }

        return chunkCode;
    }

    _correctChannel(p, chan, _matTex2D) {
        if (_matTex2D[p] > 0) {
            if (_matTex2D[p] < chan.length) {
                return chan.substring(0, _matTex2D[p]);
            } else if (_matTex2D[p] > chan.length) {
                let str = chan;
                const chr = str.charAt(str.length - 1);
                const addLen = _matTex2D[p] - str.length;
                for (let i = 0; i < addLen; i++) str += chr;
                return str;
            }
            return chan;
        }
    }

    createVertexShader(litShader, options) {

        const useUv = [];
        const useUnmodifiedUv = [];
        const mapTransforms = [];
        const maxUvSets = 2;

        for (const p in _matTex2D) {
            const mapName = `${p}Map`;

            if (options[`${p}VertexColor`]) {
                const colorChannelName = `${p}VertexColorChannel`;
                options[colorChannelName] = this._correctChannel(p, options[colorChannelName], _matTex2D);
            }

            if (options[mapName]) {
                const channelName = `${mapName}Channel`;
                const transformName = `${mapName}Transform`;
                const uvName = `${mapName}Uv`;

                options[uvName] = Math.min(options[uvName], maxUvSets - 1);
                options[channelName] = this._correctChannel(p, options[channelName], _matTex2D);

                const uvSet = options[uvName];
                useUv[uvSet] = true;
                useUnmodifiedUv[uvSet] = useUnmodifiedUv[uvSet] || (options[mapName] && !options[transformName]);

                // create map transforms
                if (options[transformName]) {
                    mapTransforms.push({
                        name: p,
                        id: options[transformName],
                        uv: options[uvName]
                    });
                }
            }
        }

        if (options.forceUv1) {
            useUv[1] = true;
            useUnmodifiedUv[1] = (useUnmodifiedUv[1] !== undefined) ? useUnmodifiedUv[1] : true;
        }

        litShader.generateVertexShader(useUv, useUnmodifiedUv, mapTransforms);
    }

    /**
     * @param {StandardMaterialOptions} options - The create options.
     * @param {Map<string, string>} fDefines - The fragment defines.
     * @param {ShaderPass} shaderPassInfo - The shader pass info.
     */
    prepareFragmentDefines(options, fDefines, shaderPassInfo) {

        const fDefineSet = (condition, name, value = '') => {
            if (condition) {
                fDefines.set(name, value);
            }
        };

        fDefineSet(options.diffuseDetail, 'STD_DIFFUSE_DETAIL', '');
        fDefineSet(options.aoDetail, 'STD_AO_DETAIL', '');
        fDefineSet(options.heightMap, 'STD_HEIGHT_MAP', '');
        fDefineSet(true, 'STD_OPACITY_DITHER', ditherNames[shaderPassInfo.isForward ? options.litOptions.opacityDither : options.litOptions.opacityShadowDither]);
    }

    /**
     * @param {GraphicsDevice} device - The graphics device.
     * @param {StandardMaterialOptions} options - The create options.
     * @returns {object} Returns the created shader definition.
     */
    createShaderDefinition(device, options) {

        const shaderPassInfo = ShaderPass.get(device).getByIndex(options.litOptions.pass);
        const isForwardPass = shaderPassInfo.isForward;
        const litShader = new LitShader(device, options.litOptions);

        // generate vertex shader
        this.createVertexShader(litShader, options);

        // handle fragment shader
        const textureMapping = {};

        options.litOptions.fresnelModel = (options.litOptions.fresnelModel === 0) ? FRESNEL_SCHLICK : options.litOptions.fresnelModel;

        // fragment defines
        const fDefines = litShader.fDefines;
        this.prepareFragmentDefines(options, fDefines, shaderPassInfo);

        const decl = new ChunkBuilder();
        const code = new ChunkBuilder();
        const func = new ChunkBuilder();
        const args = new ChunkBuilder();
        let lightingUv = '';

        decl.append(`
            
            // global texture bias for standard textures
            #if LIT_NONE_SLICE_MODE == TILED
                const float textureBias = -1000.0;
            #else
                uniform float textureBias;
            #endif

            // globals
            float dAlpha = 1.0;

            #if defined(LIT_ALPHA_TEST)
                #include "alphaTestPS"
            #endif

            // dithering
            #if STD_OPACITY_DITHER != NONE
                #include "opacityDitherPS"
            #endif

            #ifdef FORWARD_PASS // ----------------

                // globals
                vec3 dAlbedo;
                vec3 dNormalW;

                #ifdef LIT_REFRACTION
                    float dTransmission;
                    float dThickness;
                #endif

                #ifdef LIT_SCENE_COLOR
                    uniform sampler2D uSceneColorMap;
                #endif

                #ifdef LIT_SCREEN_SIZE
                    uniform vec4 uScreenSize;
                #endif

                #ifdef LIT_TRANSFORMS
                    uniform mat4 matrix_viewProjection;
                    uniform mat4 matrix_model;
                #endif

                // parallax
                #ifdef STD_HEIGHT_MAP
                    vec2 dUvOffset;
                    #ifdef STD_DIFFUSE_TEXTURE_ALLOCATE
                        uniform sampler2D texture_heightMap;
                    #endif
                #endif

                #if defined(STD_DIFFUSE_DETAIL) || defined(STD_AO_DETAIL)
                    #include "detailModesPS"
                #endif

                // diffuse
                #ifdef STD_DIFFUSE_TEXTURE_ALLOCATE
                    uniform sampler2D texture_diffuseMap;
                #endif

                #ifdef STD_DIFFUSEDETAIL_TEXTURE_ALLOCATE
                    uniform sampler2D texture_diffuseDetailMap;
                #endif

                // normal
                #ifdef STD_NORMAL_TEXTURE_ALLOCATE
                    uniform sampler2D texture_normalMap;
                #endif

                #ifdef STD_NORMALDETAIL_TEXTURE_ALLOCATE
                    uniform sampler2D texture_normalDetailMap;
                #endif

                // refraction
                #ifdef STD_THICKNESS_TEXTURE_ALLOCATE
                    uniform sampler2D texture_thicknessMap;
                #endif
                #ifdef STD_REFRACTION_TEXTURE_ALLOCATE
                    uniform sampler2D texture_refractionMap;
                #endif

                #ifdef LIT_CLEARCOAT
                    float ccSpecularity;
                    float ccGlossiness;
                    vec3 ccNormalW;
                #endif
            #endif
        `);

        code.append(`

            // all passes handle opacity
            #if LIT_BLEND_TYPE != NONE || defined(LIT_ALPHA_TEST) || defined(LIT_ALPHA_TO_COVERAGE) || STD_OPACITY_DITHER != NONE
                #ifdef STD_OPACITY_TEXTURE_ALLOCATE
                    uniform sampler2D texture_opacityMap;
                #endif
                #include "opacityPS"
            #endif

            #ifdef FORWARD_PASS // ----------------

                // parallax
                #ifdef STD_HEIGHT_MAP
                    #include "parallaxPS"
                #endif

                // diffuse
                #include  "diffusePS"

                // normal
                #ifdef LIT_NEEDS_NORMAL
                    #include "normalMapPS"
                #endif

                // refraction
                #ifdef LIT_REFRACTION
                    #include "transmissionPS"
                    #include "thicknessPS"
                #endif
            #endif
        `);

        func.append(`

            // all passes handle opacity
            #if LIT_BLEND_TYPE != NONE || defined(LIT_ALPHA_TEST) || defined(LIT_ALPHA_TO_COVERAGE) || STD_OPACITY_DITHER != NONE
                getOpacity();

                #if defined(LIT_ALPHA_TEST)
                    alphaTest(dAlpha);
                #endif

                #if STD_OPACITY_DITHER != NONE
                    opacityDither(dAlpha, 0.0);
                #endif

                litArgs_opacity = dAlpha;
            #endif

            #ifdef FORWARD_PASS // ----------------

                // parallax
                #ifdef STD_HEIGHT_MAP
                    getParallax();
                #endif

                // diffuse
                getAlbedo();
                litArgs_albedo = dAlbedo;

                // normal
                #ifdef LIT_NEEDS_NORMAL
                    getNormal();
                    litArgs_worldNormal = dNormalW;
                #endif

                // refraction
                #ifdef LIT_REFRACTION
                    getRefraction();
                    litArgs_transmission = dTransmission;

                    getThickness();
                    litArgs_thickness = dThickness;

                    #ifdef LIT_DISPERSION
                        litArgs_dispersion = material_dispersion;
                    #endif
                #endif
            #endif
        `);

        if (isForwardPass) {
            // parallax
            if (options.heightMap) {
                this._addMap(fDefines, 'height', 'parallaxPS', options, litShader.chunks, textureMapping);
            }

            // opacity
            if (options.litOptions.blendType !== BLEND_NONE || options.litOptions.alphaTest || options.litOptions.alphaToCoverage || options.litOptions.opacityDither !== DITHER_NONE) {
                this._addMap(fDefines, 'opacity', 'opacityPS', options, litShader.chunks, textureMapping);
            }

            // normal
            if (litShader.needsNormal) {
                if (options.normalMap || options.clearCoatNormalMap) {
                    if (!options.litOptions.hasTangents) {
                        // TODO: generalize to support each normalmap input (normalMap, normalDetailMap, clearCoatNormalMap) independently
                        const baseName = options.normalMap ? 'normalMap' : 'clearCoatNormalMap';
                        lightingUv = this._getUvSourceExpression(`${baseName}Transform`, `${baseName}Uv`, options);
                    }
                }

                this._addMap(fDefines, 'normalDetail', 'normalMapPS', options, litShader.chunks, textureMapping, options.normalDetailPackedNormal ? 'xy' : 'xyz');
                this._addMap(fDefines, 'normal', 'normalMapPS', options, litShader.chunks, textureMapping, options.packedNormal ? 'xy' : 'xyz');
            }

            // diffuse
            if (options.diffuseDetail) {
                this._addMap(fDefines, 'diffuseDetail', 'diffusePS', options, litShader.chunks, textureMapping, options.diffuseDetailEncoding);
            }
            this._addMap(fDefines, 'diffuse', 'diffusePS', options, litShader.chunks, textureMapping, options.diffuseEncoding);

            if (options.litOptions.useRefraction) {
                this._addMap(fDefines, 'refraction', 'transmissionPS', options, litShader.chunks, textureMapping);
                this._addMap(fDefines, 'thickness', 'thicknessPS', options, litShader.chunks, textureMapping);
            }






            if (options.litOptions.useIridescence) {
                decl.append('float dIridescence;');
                code.append(this._addMap(fDefines, 'iridescence', 'iridescencePS', options, litShader.chunks, textureMapping));
                func.append('getIridescence();');
                args.append('litArgs_iridescence_intensity = dIridescence;');

                decl.append('float dIridescenceThickness;');
                code.append(this._addMap(fDefines, 'iridescenceThickness', 'iridescenceThicknessPS', options, litShader.chunks, textureMapping));
                func.append('getIridescenceThickness();');
                args.append('litArgs_iridescence_thickness = dIridescenceThickness;');
            }

            // specularity & glossiness
            if ((litShader.lighting && options.litOptions.useSpecular) || litShader.reflections) {
                decl.append('vec3 dSpecularity;');
                decl.append('float dGlossiness;');
                if (options.litOptions.useSheen) {
                    decl.append('vec3 sSpecularity;');
                    code.append(this._addMap(fDefines, 'sheen', 'sheenPS', options, litShader.chunks, textureMapping, options.sheenEncoding));
                    func.append('getSheen();');
                    args.append('litArgs_sheen_specularity = sSpecularity;');

                    decl.append('float sGlossiness;');
                    code.append(this._addMap(fDefines, 'sheenGloss', 'sheenGlossPS', options, litShader.chunks, textureMapping));
                    func.append('getSheenGlossiness();');
                    args.append('litArgs_sheen_gloss = sGlossiness;');
                }
                if (options.litOptions.useMetalness) {
                    decl.append('float dMetalness;');
                    code.append(this._addMap(fDefines, 'metalness', 'metalnessPS', options, litShader.chunks, textureMapping));
                    func.append('getMetalness();');
                    args.append('litArgs_metalness = dMetalness;');

                    decl.append('float dIor;');
                    code.append(this._addMap(fDefines, 'ior', 'iorPS', options, litShader.chunks, textureMapping));
                    func.append('getIor();');
                    args.append('litArgs_ior = dIor;');
                }
                if (options.litOptions.useSpecularityFactor) {
                    decl.append('float dSpecularityFactor;');
                    code.append(this._addMap(fDefines, 'specularityFactor', 'specularityFactorPS', options, litShader.chunks, textureMapping));
                    func.append('getSpecularityFactor();');
                    args.append('litArgs_specularityFactor = dSpecularityFactor;');
                }
                if (options.useSpecularColor) {
                    code.append(this._addMap(fDefines, 'specular', 'specularPS', options, litShader.chunks, textureMapping, options.specularEncoding));
                } else {
                    code.append('void getSpecularity() { dSpecularity = vec3(1); }');
                }
                code.append(this._addMap(fDefines, 'gloss', 'glossPS', options, litShader.chunks, textureMapping));
                func.append('getGlossiness();');
                func.append('getSpecularity();');
                args.append('litArgs_specularity = dSpecularity;');
                args.append('litArgs_gloss = dGlossiness;');
            } else {
                decl.append('vec3 dSpecularity = vec3(0.0);');
                decl.append('float dGlossiness = 0.0;');
            }

            // ao
            if (options.aoDetail) {
                code.append(this._addMap(fDefines, 'aoDetail', 'aoDetailMapPS', options, litShader.chunks, textureMapping));
            }
            if (options.aoMap || options.aoVertexColor || options.useAO) {
                decl.append('float dAo;');
                code.append(this._addMap(fDefines, 'ao', 'aoPS', options, litShader.chunks, textureMapping));
                func.append('getAO();');
                args.append('litArgs_ao = dAo;');
            }

            // emission
            decl.append('vec3 dEmission;');
            code.append(this._addMap(fDefines, 'emissive', 'emissivePS', options, litShader.chunks, textureMapping, options.emissiveEncoding));
            func.append('getEmission();');
            args.append('litArgs_emission = dEmission;');

            // clearcoat
            if (options.litOptions.useClearCoat) {
                code.append(this._addMap(fDefines, 'clearCoat', 'clearCoatPS', options, litShader.chunks, textureMapping));
                code.append(this._addMap(fDefines, 'clearCoatGloss', 'clearCoatGlossPS', options, litShader.chunks, textureMapping));
                code.append(this._addMap(fDefines, 'clearCoatNormal', 'clearCoatNormalPS', options, litShader.chunks, textureMapping, options.clearCoatPackedNormal ? 'xy' : 'xyz'));

                func.append('getClearCoat();');
                func.append('getClearCoatGlossiness();');
                func.append('getClearCoatNormal();');

                args.append('litArgs_clearcoat_specularity = ccSpecularity;');
                args.append('litArgs_clearcoat_gloss = ccGlossiness;');
                args.append('litArgs_clearcoat_worldNormal = ccNormalW;');
            }

            // lightmap
            if (options.lightMap || options.lightVertexColor) {
                const lightmapDir = (options.dirLightMap && options.litOptions.useSpecular);
                const lightmapChunkPropName = lightmapDir ? 'lightmapDirPS' : 'lightmapSinglePS';
                decl.append('vec3 dLightmap;');
                if (lightmapDir) {
                    decl.append('vec3 dLightmapDir;');
                }
                code.append(this._addMap(fDefines, 'light', lightmapChunkPropName, options, litShader.chunks, textureMapping, options.lightMapEncoding));
                func.append('getLightMap();');
                args.append('litArgs_lightmap = dLightmap;');
                if (lightmapDir) {
                    args.append('litArgs_lightmapDir = dLightmapDir;');
                }
            }

        } else {
            // all other passes require only opacity
            const opacityShadowDither = options.litOptions.opacityShadowDither;
            if (options.litOptions.alphaTest || opacityShadowDither) {
                this._addMap(fDefines, 'opacity', 'opacityPS', options, litShader.chunks, textureMapping);
            }
        }

        decl.append(litShader.chunks.litShaderArgsPS);
        code.append(`
            void evaluateFrontend() {
                ${func.code}
                ${args.code}
            }
        `);

        const handled = [
            'texture_heightMap',
            'texture_diffuseMap',
            'texture_diffuseDetailMap',
            'texture_opacityMap',
            'texture_normalDetailMap',
            'texture_normalMap',
            'texture_thicknessMap',
            'texture_refractionMap'
        ];

        // TODO: when refactoring is done, this loop will be removed
        for (const texture in textureMapping) {
            if (handled.includes(textureMapping[texture])) {
                continue;
            }

            decl.append(`uniform sampler2D ${textureMapping[texture]};`);
        }

        litShader.generateFragmentShader(decl.code, code.code, lightingUv);

        const includes = new Map(Object.entries({
            ...Object.getPrototypeOf(litShader.chunks), // the prototype stores the default chunks
            ...litShader.chunks,  // user overrides are supplied as instance properties
            ...options.litOptions.chunks
        }));

        const vDefines = litShader.vDefines;
        options.defines.forEach((value, key) => vDefines.set(key, value));

        options.defines.forEach((value, key) => fDefines.set(key, value));

        const definition = ShaderUtils.createDefinition(device, {
            name: 'StandardShader',
            attributes: litShader.attributes,
            vertexCode: litShader.vshader,
            fragmentCode: litShader.fshader,
            vertexIncludes: includes,
            fragmentIncludes: includes,
            fragmentDefines: fDefines,
            vertexDefines: vDefines
        });

        if (litShader.shaderPassInfo.isForward) {
            definition.tag = SHADERTAG_MATERIAL;
        }

        return definition;
    }
}

const standard = new ShaderGeneratorStandard();

export { _matTex2D, standard };
