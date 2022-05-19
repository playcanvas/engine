import { hashCode } from '../../../core/hash.js';

import {
    BLEND_NONE, FRESNEL_SCHLICK, LIGHTTYPE_DIRECTIONAL,
    SHADER_FORWARD, SHADER_FORWARDHDR, SPECULAR_PHONG,
    SPRITE_RENDERMODE_SLICED, SPRITE_RENDERMODE_TILED
} from '../../../scene/constants.js';

import { LitShader } from './lit-shader.js';

/** @typedef {import('../../graphics-device.js').GraphicsDevice} GraphicsDevice */

const _matTex2D = [];

const standard = {
    // Shared Standard Material option structures
    optionsContext: {},
    optionsContextMin: {},

    /** @type { Function } */
    generateKey: function (options) {
        const buildPropertiesList = function (options) {
            const props = [];
            for (const prop in options) {
                if (options.hasOwnProperty(prop) && prop !== "chunks" && prop !== "lights")
                    props.push(prop);
            }
            return props.sort();
        };
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

        let key = "standard";

        for (let i = 0; i < props.length; i++) {
            if (options[props[i]])
                key += props[i] + options[props[i]];
        }

        if (options.chunks) {
            const chunks = [];
            for (const p in options.chunks) {
                if (options.chunks.hasOwnProperty(p)) {
                    chunks.push(p + options.chunks[p]);
                }
            }
            chunks.sort();
            key += chunks;
        }

        if (options.lights) {
            const isClustered = options.clusteredLightingEnabled;
            for (let i = 0; i < options.lights.length; i++) {
                const light = options.lights[i];
                if (!isClustered || light._type === LIGHTTYPE_DIRECTIONAL) {
                    key += light.key;
                }
            }
        }

        return hashCode(key);
    },

    // get the value to replace $UV with in Map Shader functions

    /**
     * Get the code with which to to replace '$UV' in the map shader functions.
     *
     * @param {string} transformPropName - Name of the transform id in the options block. Usually "basenameTransform".
     * @param {string} uVPropName - Name of the UV channel in the options block. Usually "basenameUv".
     * @param {object} options - The options passed into createShaderDefinition.
     * @returns {string} The code used to replace "$UV" in the shader code.
     * @private
     */
    _getUvSourceExpression: function (transformPropName, uVPropName, options) {
        const transformId = options[transformPropName];
        const uvChannel = options[uVPropName];
        const isMainPass = (options.pass === SHADER_FORWARD || options.pass === SHADER_FORWARDHDR);

        let expression;
        if (isMainPass && options.nineSlicedMode === SPRITE_RENDERMODE_SLICED) {
            expression = "nineSlicedUv";
        } else if (isMainPass && options.nineSlicedMode === SPRITE_RENDERMODE_TILED) {
            expression = "nineSlicedUv";
        } else {
            if (transformId === 0) {
                expression = "vUv" + uvChannel;
            } else {
                // note: different capitalization!
                expression = "vUV" + uvChannel + "_" + transformId;
            }

            // if heightmap is enabled all maps except the heightmap are offset
            if (options.heightMap && transformPropName !== "heightMapTransform") {
                expression += " + dUvOffset";
            }
        }

        return expression;
    },

    _addMapDef: function (name, enabled) {
        return enabled ? `#define ${name}\n` : `#undef ${name}\n`;
    },

    _addMapDefs: function (float, color, vertex, map) {
        return this._addMapDef("MAPFLOAT", float) +
               this._addMapDef("MAPCOLOR", color) +
               this._addMapDef("MAPVERTEX", vertex) +
               this._addMapDef("MAPTEXTURE", map);
    },

    /**
     * Add chunk for Map Types (used for all maps except Normal).
     *
     * @param {string} propName - The base name of the map: diffuse | emissive | opacity | light | height | metalness | specular | gloss | ao.
     * @param {string} chunkName - The name of the chunk to use. Usually "basenamePS".
     * @param {object} options - The options passed into to createShaderDefinition.
     * @param {object} chunks - The set of shader chunks to choose from.
     * @param {number} samplerFormat - Format of texture sampler to use - 0: "texture2DSRGB", 1: "texture2DRGBM", 2: "texture2D".
     * @returns {string} The shader code to support this map.
     * @private
     */
    _addMap: function (propName, chunkName, options, chunks, samplerFormat = null) {
        const mapPropName = propName + "Map";
        const uVPropName = mapPropName + "Uv";
        const transformPropName = mapPropName + "Transform";
        const channelPropName = mapPropName + "Channel";
        const vertexColorChannelPropName = propName + "VertexColorChannel";
        const tintPropName = propName + "Tint";
        const vertexColorPropName = propName + "VertexColor";
        const detailModePropName = propName + "Mode";

        const tintOption = options[tintPropName];
        const vertexColorOption = options[vertexColorPropName];
        const textureOption = options[mapPropName];
        const detailModeOption = options[detailModePropName];

        let subCode = chunks[chunkName];

        if (textureOption) {
            const uv = this._getUvSourceExpression(transformPropName, uVPropName, options);

            subCode = subCode.replace(/\$UV/g, uv).replace(/\$CH/g, options[channelPropName]);

            if (samplerFormat !== null) {
                const fmt = samplerFormat === 0 ? "texture2DSRGB" : (samplerFormat === 1 ? "texture2DRGBM" : "texture2D");
                subCode = subCode.replace(/\$texture2DSAMPLE/g, fmt);
            }
        }

        if (vertexColorOption) {
            subCode = subCode.replace(/\$VC/g, options[vertexColorChannelPropName]);
        }

        if (detailModeOption) {
            subCode = subCode.replace(/\$DETAILMODE/g, detailModeOption);
        }

        const isFloatTint = !!(tintOption & 1);
        const isVecTint = !!(tintOption & 2);

        subCode = this._addMapDefs(isFloatTint, isVecTint, vertexColorOption, textureOption) + subCode;
        return subCode.replace(/\$/g, "");
    },

    /** @type { Function } */
    createShaderDefinition: function (device, options) {
        if (options.shadingModel === SPECULAR_PHONG) {
            options.fresnelModel = 0;
            options.ambientSH = false;
        } else {
            options.fresnelModel = (options.fresnelModel === 0) ? FRESNEL_SCHLICK : options.fresnelModel;
        }

        const litShader = new LitShader(device, options);

        let decl = "";
        let code = "";
        let func = "";
        let lightingUv = "";

        // global texture bias for standard textures
        decl += "uniform float textureBias;\n";

        if (options.pass === SHADER_FORWARD || options.pass === SHADER_FORWARDHDR) {
            // parallax
            if (options.heightMap) {
                // if (!options.normalMap) {
                //     const transformedHeightMapUv = this._getUvSourceExpression("heightMapTransform", "heightMapUv", options);
                //     if (!options.hasTangents) tbn = tbn.replace(/\$UV/g, transformedHeightMapUv);
                //     code += tbn;
                // }
                code += this._addMap("height", "parallaxPS", options, litShader.chunks);
                func += "getParallax();\n";
            }

            // opacity
            if (options.blendType !== BLEND_NONE || options.alphaTest || options.alphaToCoverage) {
                decl += "float dAlpha;\n";
                code += this._addMap("opacity", "opacityPS", options, litShader.chunks);
                func += "getOpacity();\n";
                if (options.alphaTest) {
                    code += litShader.chunks.alphaTestPS;
                    func += "alphaTest(dAlpha);\n";
                }
            } else {
                decl += "float dAlpha = 1.0;\n";
            }

            // normal
            if (litShader.needsNormal) {
                if (options.normalMap || options.clearCoatNormalMap) {
                    // TODO: let each normalmap input (normalMap, normalDetailMap, clearCoatNormalMap) independently decide which unpackNormal to use.
                    code += options.packedNormal ? litShader.chunks.normalXYPS : litShader.chunks.normalXYZPS;

                    if (!options.hasTangents) {
                        // TODO: generalize to support each normalmap input (normalMap, normalDetailMap, clearCoatNormalMap) independently
                        const baseName = options.normalMap ? "normalMap" : "clearCoatNormalMap";
                        lightingUv = this._getUvSourceExpression(`${baseName}Transform`, `${baseName}Uv`, options);
                    }
                }

                decl += "vec3 dNormalW;\n";
                code += this._addMap("normalDetail", "normalDetailMapPS", options, litShader.chunks);
                code += this._addMap("normal", "normalMapPS", options, litShader.chunks);
                func += "getNormal();\n";
            }

            // albedo
            decl += "vec3 dAlbedo;\n";
            if (options.diffuseDetail) {
                code += this._addMap("diffuseDetail", "diffuseDetailMapPS", options, litShader.chunks);
            }
            code += this._addMap("diffuse", "diffusePS", options, litShader.chunks);
            func += "getAlbedo();\n";

            // specularity & glossiness
            if ((litShader.lighting && options.useSpecular) || litShader.reflections) {
                const specularPropName = options.useMetalness ? "metalness" : "specular";
                decl += "vec3 dSpecularity;\n";
                decl += "float dGlossiness;\n";
                code += this._addMap(specularPropName, specularPropName + "PS", options, litShader.chunks);
                code += this._addMap("gloss", "glossPS", options, litShader.chunks);
                func += "getSpecularity();\n";
                func += "getGlossiness();\n";
            } else {
                decl += "vec3 dSpecularity = vec3(0.0);\n";
                decl += "float dGlossiness = 0.0;\n";
            }

            // ao
            if (options.aoMap || options.aoVertexColor) {
                decl += "float dAo;\n";
                code += this._addMap("ao", "aoPS", options, litShader.chunks);
                func += "getAO();\n";
            }

            // emission
            decl += "vec3 dEmission;\n";
            code += this._addMap("emissive", "emissivePS", options, litShader.chunks, options.emissiveFormat);
            func += "getEmission();\n";

            // clearcoat
            if (options.clearCoat > 0) {
                decl += "float ccSpecularity;\n";
                decl += "float ccGlossiness;\n";
                decl += "vec3 ccNormalW;\n";

                code += this._addMap("clearCoat", "clearCoatPS", options, litShader.chunks);
                code += this._addMap("clearCoatGloss", "clearCoatGlossPS", options, litShader.chunks);
                code += this._addMap("clearCoatNormal", "clearCoatNormalPS", options, litShader.chunks);

                func += "getClearCoat();\n";
                func += "getClearCoatGlossiness();\n";
                func += "getClearCoatNormal();\n";
            }

            // lightmap
            if (options.lightMap || options.lightVertexColor) {
                const lightmapDir = (options.dirLightMap && options.useSpecular);
                const lightmapChunkPropName = lightmapDir ? 'lightmapDirPS' : 'lightmapSinglePS';
                decl += "vec3 dLightmap;\n";
                if (lightmapDir) {
                    decl += "vec3 dLightmapDir;\n";
                }
                code += this._addMap("light", lightmapChunkPropName, options, litShader.chunks, options.lightMapFormat);
                func += "getLightMap();\n";
            }
        } else {
            // all other passes require only opacity
            if (options.alphaTest) {
                decl += "float dAlpha;\n";
                code += this._addMap("opacity", "opacityPS", options, litShader.chunks);
                code += litShader.chunks.alphaTestPS;
                func += "getOpacity();\n";
                func += "alphaTest(dAlpha);\n";
            }
        }

        decl = `//-------- frontend begin\n${decl}//-------- frontend end\n`;
        code = `//-------- frontend begin\n${code}//-------- frontend end\n`;
        func = `//-------- frontend begin\n${func}//-------- frontend end\n`;
        func = `\n${func.split('\n').map(l => `    ${l}`).join('\n')}\n\n`;

        litShader.generateVertexShader(_matTex2D);
        litShader.generateFragmentShader(decl, code, func, lightingUv);
        return litShader.getDefinition();
    }
};

export { _matTex2D, standard };
