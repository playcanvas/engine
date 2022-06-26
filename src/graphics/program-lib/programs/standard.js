import { hashCode } from '../../../core/hash.js';

import {
    BLEND_NONE, FRESNEL_SCHLICK, LIGHTTYPE_DIRECTIONAL,
    SHADER_FORWARD, SHADER_FORWARDHDR, SPECULAR_PHONG,
    SPRITE_RENDERMODE_SLICED, SPRITE_RENDERMODE_TILED
} from '../../../scene/constants.js';

import { LitShader } from './lit-shader.js';
import { ChunkBuilder } from '../chunk-builder.js';

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
     * @param {number|null} samplerFormat - Format of texture sampler to use - 0: "texture2DSRGB", 1: "texture2DRGBM", 2: "texture2D".
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

    _correctChannel: function (p, chan, _matTex2D) {
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
    },

    /** @type { Function } */
    createShaderDefinition: function (device, options) {
        const litShader = new LitShader(device, options);

        // generate vertex shader
        const useUv = [];
        const useUnmodifiedUv = [];
        const mapTransforms = [];
        const maxUvSets = 2;

        for (const p in _matTex2D) {
            const mname = p + "Map";

            if (options[p + "VertexColor"]) {
                const cname = p + "VertexColorChannel";
                options[cname] = this._correctChannel(p, options[cname], _matTex2D);
            }

            if (options[mname]) {
                const cname = mname + "Channel";
                const tname = mname + "Transform";
                const uname = mname + "Uv";

                options[uname] = Math.min(options[uname], maxUvSets - 1);
                options[cname] = this._correctChannel(p, options[cname], _matTex2D);

                const uvSet = options[uname];
                useUv[uvSet] = true;
                useUnmodifiedUv[uvSet] = useUnmodifiedUv[uvSet] || (options[mname] && !options[tname]);

                // create map transforms
                if (options[tname]) {
                    mapTransforms.push({
                        name: p,
                        id: options[tname],
                        uv: options[uname]
                    });
                }
            }
        }

        if (options.forceUv1) {
            useUv[1] = true;
            useUnmodifiedUv[1] = (useUnmodifiedUv[1] !== undefined) ? useUnmodifiedUv[1] : true;
        }

        litShader.generateVertexShader(useUv, useUnmodifiedUv, mapTransforms);

        // handle fragment shader
        if (options.shadingModel === SPECULAR_PHONG) {
            options.fresnelModel = 0;
            options.ambientSH = false;
        } else {
            options.fresnelModel = (options.fresnelModel === 0) ? FRESNEL_SCHLICK : options.fresnelModel;
        }

        const decl = new ChunkBuilder();
        const code = new ChunkBuilder();
        const func = new ChunkBuilder();
        let lightingUv = "";

        // global texture bias for standard textures
        decl.append("uniform float textureBias;");

        if (options.pass === SHADER_FORWARD || options.pass === SHADER_FORWARDHDR) {
            // parallax
            if (options.heightMap) {
                // if (!options.normalMap) {
                //     const transformedHeightMapUv = this._getUvSourceExpression("heightMapTransform", "heightMapUv", options);
                //     if (!options.hasTangents) tbn = tbn.replace(/\$UV/g, transformedHeightMapUv);
                //     code += tbn;
                // }
                code.append(this._addMap("height", "parallaxPS", options, litShader.chunks));
                func.append("getParallax();");
            }

            // opacity
            if (options.blendType !== BLEND_NONE || options.alphaTest || options.alphaToCoverage) {
                decl.append("float dAlpha;");
                code.append(this._addMap("opacity", "opacityPS", options, litShader.chunks));
                func.append("getOpacity();");
                if (options.alphaTest) {
                    code.append(litShader.chunks.alphaTestPS);
                    func.append("alphaTest(dAlpha);");
                }
            } else {
                decl.append("float dAlpha = 1.0;");
            }

            // normal
            if (litShader.needsNormal) {
                if (options.normalMap || options.clearCoatNormalMap) {
                    // TODO: let each normalmap input (normalMap, normalDetailMap, clearCoatNormalMap) independently decide which unpackNormal to use.
                    code.append(options.packedNormal ? litShader.chunks.normalXYPS : litShader.chunks.normalXYZPS);

                    if (!options.hasTangents) {
                        // TODO: generalize to support each normalmap input (normalMap, normalDetailMap, clearCoatNormalMap) independently
                        const baseName = options.normalMap ? "normalMap" : "clearCoatNormalMap";
                        lightingUv = this._getUvSourceExpression(`${baseName}Transform`, `${baseName}Uv`, options);
                    }
                }

                decl.append("vec3 dNormalW;");
                code.append(this._addMap("normalDetail", "normalDetailMapPS", options, litShader.chunks));
                code.append(this._addMap("normal", "normalMapPS", options, litShader.chunks));
                func.append("getNormal();");
            }

            // albedo
            decl.append("vec3 dAlbedo;");
            if (options.diffuseDetail) {
                code.append(this._addMap("diffuseDetail", "diffuseDetailMapPS", options, litShader.chunks));
            }
            code.append(this._addMap("diffuse", "diffusePS", options, litShader.chunks));
            func.append("getAlbedo();");

            // specularity & glossiness
            if ((litShader.lighting && options.useSpecular) || litShader.reflections) {
                const specularPropName = options.useMetalness ? "metalness" : "specular";
                decl.append("vec3 dSpecularity;");
                decl.append("float dGlossiness;");
                code.append(this._addMap(specularPropName, specularPropName + "PS", options, litShader.chunks));
                code.append(this._addMap("gloss", "glossPS", options, litShader.chunks));
                func.append("getSpecularity();");
                func.append("getGlossiness();");
            } else {
                decl.append("vec3 dSpecularity = vec3(0.0);");
                decl.append("float dGlossiness = 0.0;");
            }

            // ao
            if (options.aoMap || options.aoVertexColor) {
                decl.append("float dAo;");
                code.append(this._addMap("ao", "aoPS", options, litShader.chunks));
                func.append("getAO();");
            }

            // emission
            decl.append("vec3 dEmission;");
            code.append(this._addMap("emissive", "emissivePS", options, litShader.chunks, options.emissiveFormat));
            func.append("getEmission();");

            // clearcoat
            if (options.clearCoat > 0) {
                decl.append("float ccSpecularity;");
                decl.append("float ccGlossiness;");
                decl.append("vec3 ccNormalW;");

                code.append(this._addMap("clearCoat", "clearCoatPS", options, litShader.chunks));
                code.append(this._addMap("clearCoatGloss", "clearCoatGlossPS", options, litShader.chunks));
                code.append(this._addMap("clearCoatNormal", "clearCoatNormalPS", options, litShader.chunks));

                func.append("getClearCoat();");
                func.append("getClearCoatGlossiness();");
                func.append("getClearCoatNormal();");
            }

            // lightmap
            if (options.lightMap || options.lightVertexColor) {
                const lightmapDir = (options.dirLightMap && options.useSpecular);
                const lightmapChunkPropName = lightmapDir ? 'lightmapDirPS' : 'lightmapSinglePS';
                decl.append("vec3 dLightmap;");
                if (lightmapDir) {
                    decl.append("vec3 dLightmapDir;");
                }
                code.append(this._addMap("light", lightmapChunkPropName, options, litShader.chunks, options.lightMapFormat));
                func.append("getLightMap();");
            }
        } else {
            // all other passes require only opacity
            if (options.alphaTest) {
                decl.append("float dAlpha;");
                code.append(this._addMap("opacity", "opacityPS", options, litShader.chunks));
                code.append(litShader.chunks.alphaTestPS);
                func.append("getOpacity();");
                func.append("alphaTest(dAlpha);");
            }
        }

        // decl.append('//-------- frontend decl begin', decl.code, '//-------- frontend decl end');
        // code.append('//-------- frontend code begin', code.code, '//-------- frontend code end');
        // func.append('//-------- frontend func begin\n${func}//-------- frontend func end\n`;

        // format func
        func.code = `\n${func.code.split('\n').map(l => `    ${l}`).join('\n')}\n\n`;

        litShader.generateFragmentShader(decl.code, code.code, func.code, lightingUv);

        return litShader.getDefinition();
    }
};

export { _matTex2D, standard };
