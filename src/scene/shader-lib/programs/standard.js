import { Debug } from '../../../core/debug.js';
import {
    BLEND_NONE, DITHER_NONE, ditherNames, FRESNEL_SCHLICK,
    SHADER_FORWARD,
    SPRITE_RENDERMODE_SLICED, SPRITE_RENDERMODE_TILED
} from '../../constants.js';
import { ShaderPass } from '../../shader-pass.js';
import { LitShader } from './lit-shader.js';
import { ChunkUtils } from '../chunk-utils.js';
import { StandardMaterialOptions } from '../../materials/standard-material-options.js';
import { LitOptionsUtils } from './lit-options-utils.js';
import { ShaderGenerator } from './shader-generator.js';
import { ShaderDefinitionUtils } from '../../../platform/graphics/shader-definition-utils.js';
import { SHADERTAG_MATERIAL } from '../../../platform/graphics/constants.js';
import { MapUtils } from '../../../core/map-utils.js';

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

    _validateMapChunk(code, propName, chunkName, chunks) {
        Debug.call(() => {
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
     * Add shader defines for a texture map.
     *
     * @param {Map<string, string>} fDefines - The fragment defines.
     * @param {string} propName - The base name of the map: diffuse | emissive | opacity | light | height | metalness | specular | gloss | ao.
     * @param {string} chunkName - The name of the chunk to use. Usually "basenamePS".
     * @param {object} options - The options passed into to createShaderDefinition.
     * @param {Map<string, string>} chunks - The set of shader chunks to choose from.
     * @param {object} mapping - The mapping between chunk and sampler
     * @param {string|null} encoding - The texture's encoding
     * @private
     */
    _addMapDefines(fDefines, propName, chunkName, options, chunks, mapping, encoding = null) {
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

        const chunkCode = chunks.get(chunkName);
        Debug.assert(chunkCode, `Shader chunk ${chunkName} not found.`);

        // log errors if the chunk format is deprecated (format changed in engine 2.7)
        Debug.call(() => {
            if (chunkCode) {
                // strip comments from the chunk
                const code = chunks.get(chunkName).replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '$1');

                this._validateMapChunk(code, propNameCaps, chunkName, chunks);

                if (vertexColorOption) {
                    if (code.includes('gammaCorrectInputVec3(saturate3(vVertexColor.') || code.includes('gammaCorrectInput(saturate(vVertexColor.')) {
                        Debug.errorOnce(`Shader chunk ${chunkName} contains gamma correction code which is incompatible with vertexColorGamma=true. Please remove gamma correction calls from the chunk.`, { code: code });
                    }
                }
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

        fDefineSet(options.lightMap, 'STD_LIGHTMAP', '');
        fDefineSet(options.lightVertexColor, 'STD_LIGHT_VERTEX_COLOR', '');
        fDefineSet(options.dirLightMap && options.litOptions.useSpecular, 'STD_LIGHTMAP_DIR', '');
        fDefineSet(options.heightMap, 'STD_HEIGHT_MAP', '');
        fDefineSet(options.useSpecularColor, 'STD_SPECULAR_COLOR', '');
        fDefineSet(options.aoMap || options.aoVertexColor || options.useAO, 'STD_AO', '');
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

        let lightingUv = '';

        if (isForwardPass) {
            // parallax
            if (options.heightMap) {
                this._addMapDefines(fDefines, 'height', 'parallaxPS', options, litShader.chunks, textureMapping);
            }

            // opacity
            if (options.litOptions.blendType !== BLEND_NONE || options.litOptions.alphaTest || options.litOptions.alphaToCoverage || options.litOptions.opacityDither !== DITHER_NONE) {
                this._addMapDefines(fDefines, 'opacity', 'opacityPS', options, litShader.chunks, textureMapping);
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

                this._addMapDefines(fDefines, 'normalDetail', 'normalMapPS', options, litShader.chunks, textureMapping, options.normalDetailPackedNormal ? 'xy' : 'xyz');
                this._addMapDefines(fDefines, 'normal', 'normalMapPS', options, litShader.chunks, textureMapping, options.packedNormal ? 'xy' : 'xyz');
            }

            // diffuse
            if (options.diffuseDetail) {
                this._addMapDefines(fDefines, 'diffuseDetail', 'diffusePS', options, litShader.chunks, textureMapping, options.diffuseDetailEncoding);
            }
            this._addMapDefines(fDefines, 'diffuse', 'diffusePS', options, litShader.chunks, textureMapping, options.diffuseEncoding);

            // refraction
            if (options.litOptions.useRefraction) {
                this._addMapDefines(fDefines, 'refraction', 'transmissionPS', options, litShader.chunks, textureMapping);
                this._addMapDefines(fDefines, 'thickness', 'thicknessPS', options, litShader.chunks, textureMapping);
            }

            // iridescence
            if (options.litOptions.useIridescence) {
                this._addMapDefines(fDefines, 'iridescence', 'iridescencePS', options, litShader.chunks, textureMapping);
                this._addMapDefines(fDefines, 'iridescenceThickness', 'iridescenceThicknessPS', options, litShader.chunks, textureMapping);
            }

            // specularity & glossiness
            if ((litShader.lighting && options.litOptions.useSpecular) || litShader.reflections) {
                if (options.litOptions.useSheen) {
                    this._addMapDefines(fDefines, 'sheen', 'sheenPS', options, litShader.chunks, textureMapping, options.sheenEncoding);
                    this._addMapDefines(fDefines, 'sheenGloss', 'sheenGlossPS', options, litShader.chunks, textureMapping);
                }

                if (options.litOptions.useMetalness) {
                    this._addMapDefines(fDefines, 'metalness', 'metalnessPS', options, litShader.chunks, textureMapping);
                    this._addMapDefines(fDefines, 'ior', 'iorPS', options, litShader.chunks, textureMapping);
                }

                if (options.litOptions.useSpecularityFactor) {
                    this._addMapDefines(fDefines, 'specularityFactor', 'specularityFactorPS', options, litShader.chunks, textureMapping);
                }

                if (options.useSpecularColor) {
                    this._addMapDefines(fDefines, 'specular', 'specularPS', options, litShader.chunks, textureMapping, options.specularEncoding);
                }

                this._addMapDefines(fDefines, 'gloss', 'glossPS', options, litShader.chunks, textureMapping);
            }

            // ao
            if (options.aoDetail) {
                this._addMapDefines(fDefines, 'aoDetail', 'aoPS', options, litShader.chunks, textureMapping);
            }
            if (options.aoMap || options.aoVertexColor || options.useAO) {
                this._addMapDefines(fDefines, 'ao', 'aoPS', options, litShader.chunks, textureMapping);
            }

            // emission
            this._addMapDefines(fDefines, 'emissive', 'emissivePS', options, litShader.chunks, textureMapping, options.emissiveEncoding);

            // clearcoat
            if (options.litOptions.useClearCoat) {
                this._addMapDefines(fDefines, 'clearCoat', 'clearCoatPS', options, litShader.chunks, textureMapping);
                this._addMapDefines(fDefines, 'clearCoatGloss', 'clearCoatGlossPS', options, litShader.chunks, textureMapping);
                this._addMapDefines(fDefines, 'clearCoatNormal', 'clearCoatNormalPS', options, litShader.chunks, textureMapping, options.clearCoatPackedNormal ? 'xy' : 'xyz');
            }

            // anisotropy
            if (options.litOptions.enableGGXSpecular) {
                this._addMapDefines(fDefines, 'anisotropy', 'anisotropyPS', options, litShader.chunks, textureMapping);
            }

            // lightmap
            if (options.lightMap || options.lightVertexColor) {
                this._addMapDefines(fDefines, 'light', 'lightmapPS', options, litShader.chunks, textureMapping, options.lightMapEncoding);
            }

        } else {
            // all other passes require only opacity
            const opacityShadowDither = options.litOptions.opacityShadowDither;
            if (options.litOptions.alphaTest || opacityShadowDither) {
                this._addMapDefines(fDefines, 'opacity', 'opacityPS', options, litShader.chunks, textureMapping);
            }
        }

        // generate fragment shader - supply the front end declaration and code to the lit shader, which will
        // use the outputs from this standard shader generator as an input to the lit shader generator
        litShader.generateFragmentShader(litShader.chunks.get('stdDeclarationPS'), litShader.chunks.get('stdFrontEndPS'), lightingUv);

        // chunks collected by the lit shader + includes generated by the lit shader
        const includes = MapUtils.merge(litShader.chunks, litShader.includes);

        const vDefines = litShader.vDefines;
        options.defines.forEach((value, key) => vDefines.set(key, value));

        options.defines.forEach((value, key) => fDefines.set(key, value));

        const definition = ShaderDefinitionUtils.createDefinition(device, {
            name: 'StandardShader',
            attributes: litShader.attributes,
            shaderLanguage: litShader.shaderLanguage,
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
