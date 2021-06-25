import { hashCode } from '../../../core/hash.js';

import {
    SEMANTIC_ATTR8, SEMANTIC_ATTR9, SEMANTIC_ATTR10, SEMANTIC_ATTR11, SEMANTIC_ATTR12, SEMANTIC_ATTR13, SEMANTIC_ATTR14, SEMANTIC_ATTR15,
    SEMANTIC_BLENDINDICES, SEMANTIC_BLENDWEIGHT, SEMANTIC_COLOR, SEMANTIC_NORMAL, SEMANTIC_POSITION, SEMANTIC_TANGENT,
    SEMANTIC_TEXCOORD0, SEMANTIC_TEXCOORD1, SEMANTIC_TEXCOORD2, SEMANTIC_TEXCOORD3, SEMANTIC_TEXCOORD4, SEMANTIC_TEXCOORD5,
    SHADERTAG_MATERIAL,
    PIXELFORMAT_R8_G8_B8_A8
} from '../../constants.js';
import { shaderChunks } from '../chunks/chunks.js';

import {
    BLEND_ADDITIVEALPHA, BLEND_NONE, BLEND_NORMAL, BLEND_PREMULTIPLIED,
    FRESNEL_SCHLICK,
    LIGHTFALLOFF_LINEAR,
    LIGHTSHAPE_PUNCTUAL, LIGHTSHAPE_RECT, LIGHTSHAPE_DISK, LIGHTSHAPE_SPHERE,
    LIGHTTYPE_DIRECTIONAL, LIGHTTYPE_OMNI, LIGHTTYPE_SPOT,
    SHADER_DEPTH, SHADER_FORWARD, SHADER_FORWARDHDR, SHADER_PICK, SHADER_SHADOW,
    SHADOW_PCF3, SHADOW_PCF5, SHADOW_VSM8, SHADOW_VSM16, SHADOW_VSM32, SHADOW_COUNT,
    SPECOCC_AO,
    SPECULAR_PHONG,
    SPRITE_RENDERMODE_SLICED, SPRITE_RENDERMODE_TILED
} from '../../../scene/constants.js';
import { WorldClusters } from '../../../scene/world-clusters.js';
import { LayerComposition } from '../../../scene/layer-composition.js';

import { begin, end, fogCode, gammaCode, precisionCode, skinCode, tonemapCode, versionCode } from './common.js';

var _oldChunkWarn = function (oldName, newName) {
    // #if _DEBUG
    console.warn("Shader chunk " + oldName + " is deprecated - override " + newName + " instead");
    // #endif
};

var _oldChunkFloat = function (s, o, p) {
    _oldChunkWarn(p, o);
    return "\n#ifdef MAPFLOAT\n" + s + "\n#else\n" + shaderChunks[o] + "\n#endif\n";
};

var _oldChunkColor = function (s, o, p) {
    _oldChunkWarn(p, o);
    return "\n#ifdef MAPCOLOR\n" + s + "\n#else\n" + shaderChunks[o] + "\n#endif\n";
};

var _oldChunkTex = function (s, o, p) {
    _oldChunkWarn(p, o);
    return "\n#ifdef MAPTEXTURE\n" + s + "\n#else\n" + shaderChunks[o] + "\n#endif\n";
};

var _oldChunkTexColor = function (s, o, p) {
    _oldChunkWarn(p, o);
    return "#undef MAPTEXTURECOLOR\n#ifdef MAPTEXTURE\n#ifdef MAPCOLOR\n#define MAPTEXTURECOLOR\n#endif\n#endif\n" +
            "#ifdef MAPTEXTURECOLOR\n" + s + "\n#else\n" + shaderChunks[o] + "\n#endif\n";
};

var _oldChunkTexFloat = function (s, o, p) {
    _oldChunkWarn(p, o);
    return "#undef MAPTEXTUREFLOAT\n#ifdef MAPTEXTURE\n#ifdef MAPFLOAT\n#define MAPTEXTUREFLOAT\n#endif\n#endif\n" +
            "#ifdef MAPTEXTUREFLOAT\n" + s + "\n#else\n" + shaderChunks[o] + "\n#endif\n";
};

var _oldChunkVert = function (s, o, p) {
    _oldChunkWarn(p, o);
    return "\n#ifdef MAPVERTEX\n" + s + "\n#else\n" + shaderChunks[o] + "\n#endif\n";
};

var _oldChunkVertColor = function (s, o, p) {
    _oldChunkWarn(p, o);
    return "#undef MAPVERTEXCOLOR\n#ifdef MAPVERTEX\n#ifdef MAPCOLOR\n#define MAPVERTEXCOLOR\n#endif\n#endif\n" +
            "#ifdef MAPVERTEXCOLOR\n" + s + "\n#else\n" + shaderChunks[o] + "\n#endif\n";
};

var _oldChunkVertFloat = function (s, o, p) {
    _oldChunkWarn(p, o);
    return "#undef MAPVERTEXFLOAT\n#ifdef MAPVERTEX\n#ifdef MAPFLOAT\n#define MAPVERTEXFLOAT\n#endif\n#endif\n" +
            "#ifdef MAPVERTEXFLOAT\n" + s + "\n#else\n" + shaderChunks[o] + "\n#endif\n";
};

var _oldChunkTransformSkin = function (s, o, p) {
    _oldChunkWarn(p, o);
    return "\n#ifdef SKIN\n" + s + "\n#else\n" + shaderChunks[o] + "\n#endif\n";
};

var _oldChunkTransformDynbatch = function (s, o, p) {
    _oldChunkWarn(p, o);
    return "\n#ifdef DYNAMICBATCH\n" + s + "\n#else\n" + shaderChunks[o] + "\n#endif\n";
};

var _oldChunkTransformInstanced = function (s, o, p) {
    _oldChunkWarn(p, o);
    return "\n#ifdef INSTANCING\n" + s + "\n#else\n" + shaderChunks[o] + "\n#endif\n";
};

var _oldChunkTransformPixelSnap = function (s, o, p) {
    _oldChunkWarn(p, o);
    return "\n#ifdef PIXELSNAP\n" + s + "\n#else\n" + shaderChunks[o] + "\n#endif\n";
};

var _oldChunkTransformScreenSpace = function (s, o, p) {
    _oldChunkWarn(p, o);
    return "\n#ifdef SCREENSPACE\n" + s + "\n#else\n" + shaderChunks[o] + "\n#endif\n";
};

var _oldChunkTransformScreenSpaceBatch = function (s, o, p) {
    _oldChunkWarn(p, o);
    return "#undef SCREENSPACEBATCH\n#ifdef SCREENSPACE\n#ifdef BATCH\n#define SCREENSPACEBATCH\n#endif\n#endif\n" +
            "#ifdef SCREENSPACEBATCH\n" + s + "\n#else\n" + shaderChunks[o] + "\n#endif\n";
};

var _oldChunkTransformUv1 = function (s, o, p) {
    _oldChunkWarn(p, o);
    return "\n#ifdef UV1LAYOUT\n" + s + "\n#else\n" + shaderChunks[o] + "\n#endif\n";
};

var _matTex2D = [];

var standard = {

    _oldChunkToNew: {
        aoTexPS: { n: "aoPS", f: _oldChunkTex },
        aoVertPS: { n: "aoPS", f: _oldChunkVert },

        diffuseConstPS: { n: "diffusePS", f: _oldChunkColor },
        diffuseTexPS: { n: "diffusePS", f: _oldChunkTex },
        diffuseTexConstPS: { n: "diffusePS", f: _oldChunkTexColor },
        diffuseVertPS: { n: "diffusePS", f: _oldChunkVert },
        diffuseVertConstPS: { n: "diffusePS", f: _oldChunkVertColor },

        emissiveConstPS: { n: "emissivePS", f: _oldChunkColor },
        emissiveTexPS: { n: "emissivePS", f: _oldChunkTex },
        emissiveTexConstPS: { n: "emissivePS", f: _oldChunkTexColor },
        emissiveTexConstFloatPS: { n: "emissivePS", f: _oldChunkTexFloat },
        emissiveVertPS: { n: "emissivePS", f: _oldChunkVert },
        emissiveVertConstPS: { n: "emissivePS", f: _oldChunkVertColor },
        emissiveVertConstFloatPS: { n: "emissivePS", f: _oldChunkVertFloat },

        glossConstPS: { n: "glossPS", f: _oldChunkFloat },
        glossTexPS: { n: "glossPS", f: _oldChunkTex },
        glossTexConstPS: { n: "glossPS", f: _oldChunkTexFloat },
        glossVertPS: { n: "glossPS", f: _oldChunkVert },
        glossVertConstPS: { n: "glossPS", f: _oldChunkVertFloat },

        metalnessConstPS: { n: "metalnessPS", f: _oldChunkFloat },
        metalnessTexPS: { n: "metalnessPS", f: _oldChunkTex },
        metalnessTexConstPS: { n: "metalnessPS", f: _oldChunkTexFloat },
        metalnessVertPS: { n: "metalnessPS", f: _oldChunkVert },
        metalnessVertConstPS: { n: "metalnessPS", f: _oldChunkVertFloat },

        opacityConstPS: { n: "opacityPS", f: _oldChunkFloat },
        opacityTexPS: { n: "opacityPS", f: _oldChunkTex },
        opacityTexConstPS: { n: "opacityPS", f: _oldChunkTexFloat },
        opacityVertPS: { n: "opacityPS", f: _oldChunkVert },
        opacityVertConstPS: { n: "opacityPS", f: _oldChunkVertFloat },

        specularConstPS: { n: "specularPS", f: _oldChunkColor },
        specularTexPS: { n: "specularPS", f: _oldChunkTex },
        specularTexConstPS: { n: "specularPS", f: _oldChunkTexColor },
        specularVertPS: { n: "specularPS", f: _oldChunkVert },
        specularVertConstPS: { n: "specularPS", f: _oldChunkVertColor },

        transformBatchSkinnedVS: { n: "transformVS", f: _oldChunkTransformDynbatch },
        transformInstancedVS: { n: "transformVS", f: _oldChunkTransformInstanced },
        transformPixelSnapVS: { n: "transformVS", f: _oldChunkTransformPixelSnap },
        transformScreenSpaceVS: { n: "transformVS", f: _oldChunkTransformScreenSpace },
        transformScreenSpaceBatchSkinned: { n: "transformVS", f: _oldChunkTransformScreenSpaceBatch },
        transformSkinned: { n: "transformVS", f: _oldChunkTransformSkin },
        transformUv1: { n: "transformVS", f: _oldChunkTransformUv1 }
    },

    // Shared Sandard Material option structures
    optionsContext: {},
    optionsContextMin: {},

    generateKey: function (options) {
        var buildPropertiesList = function (options) {
            var props = [];
            for (var prop in options) {
                if (options.hasOwnProperty(prop) && prop !== "chunks" && prop !== "lights")
                    props.push(prop);
            }
            return props.sort();
        };
        var props;
        if (options === this.optionsContextMin) {
            if (!this.propsMin) this.propsMin = buildPropertiesList(options);
            props = this.propsMin;
        } else if (options === this.optionsContext) {
            if (!this.props) this.props = buildPropertiesList(options);
            props = this.props;
        } else {
            props = buildPropertiesList(options);
        }

        var key = "standard";

        var i;
        for (i = 0; i < props.length; i++) {
            if (options[props[i]])
                key += props[i] + options[props[i]];
        }

        if (options.chunks) {
            var chunks = [];
            for (var p in options.chunks) {
                if (options.chunks.hasOwnProperty(p)) {
                    chunks.push(p + options.chunks[p]);
                }
            }
            chunks.sort();
            key += chunks;
        }

        if (options.lights) {
            for (i = 0; i < options.lights.length; i++) {
                key += options.lights[i].key;
            }
        }

        return hashCode(key);
    },

    _correctChannel: function (p, chan) {
        if (_matTex2D[p] > 0) {
            if (_matTex2D[p] < chan.length) {
                return chan.substring(0, _matTex2D[p]);
            } else if (_matTex2D[p] > chan.length) {
                var str = chan;
                var chr = str.charAt(str.length - 1);
                var addLen = _matTex2D[p] - str.length;
                for (var i = 0; i < addLen; i++) str += chr;
                return str;
            }
            return chan;
        }
    },

    _setMapTransform: function (codes, name, id, uv) {
        codes[0] += "uniform vec4 texture_" + name + "MapTransform;\n";

        var checkId = id + uv * 100;
        if (!codes[3][checkId]) {
            codes[1] += "varying vec2 vUV" + uv + "_" + id + ";\n";
            codes[2] += "   vUV" + uv + "_" + id + " = uv" + uv + " * texture_" + name + "MapTransform.xy + texture_" + name + "MapTransform.zw;\n";
            codes[3][checkId] = true;
        }
        return codes;
    },

    // get the value to replace $UV with in Map Shader functions

    /**
     * @private
     * @function
     * @name _getUvSourceExpression
     * @description Get the code with which to to replace '$UV' in the map shader functions.
     * @param {string} transformPropName - Name of the transform id in the options block. Usually "basenameTransform".
     * @param {string} uVPropName - Name of the UV channel in the options block. Usually "basenameUv".
     * @param {object} options - The options passed into createShaderDefinition.
     * @returns {string} The code used to replace "$UV" in the shader code.
     */
    _getUvSourceExpression: function (transformPropName, uVPropName, options) {
        var transformId = options[transformPropName];
        var uvChannel = options[uVPropName];

        var expression;
        var isMainPass = (options.pass === SHADER_FORWARD || options.pass === SHADER_FORWARDHDR);

        if (isMainPass && options.nineSlicedMode === SPRITE_RENDERMODE_SLICED) {
            expression = "nineSlicedUv";
        } else if (isMainPass && options.nineSlicedMode === SPRITE_RENDERMODE_TILED) {
            expression = "nineSlicedUv, -1000.0";
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
        var s = "\n#undef " + name + "\n";
        if (enabled) s += " #define " + name + "\n";
        return s;
    },

    _addMapDefs: function (float, color, vertex, map) {
        var s = "";
        s += this._addMapDef("MAPFLOAT", float);
        s += this._addMapDef("MAPCOLOR", color);
        s += this._addMapDef("MAPVERTEX", vertex);
        s += this._addMapDef("MAPTEXTURE", map);
        return s;
    },

    /**
     * @private
     * @function
     * @name _addMap
     * @description Add chunk for Map Types (used for all maps except Normal).
     * @param {string} propName - The base name of the map: diffuse | emissive | opacity | light | height | metalness | specular | gloss | ao.
     * @param {string} chunkName - The name of the chunk to use. Usually "basenamePS".
     * @param {object} options - The options passed into to createShaderDefinition.
     * @param {object} chunks - The set of shader chunks to choose from.
     * @param {string} samplerFormat - Format of texture sampler to use - 0: "texture2DSRGB", 1: "texture2DRGBM", 2: "texture2D".
     * @returns {string} The shader code to support this map.
     */
    _addMap: function (propName, chunkName, options, chunks, samplerFormat) {
        var mapPropName = propName + "Map";

        var uVPropName = mapPropName + "Uv";
        var transformPropName = mapPropName + "Transform";
        var channelPropName = mapPropName + "Channel";
        var vertexColorChannelPropName = propName + "VertexColorChannel";
        var tintPropName = propName + "Tint";
        var vertexColorPropName = propName + "VertexColor";
        var detailModePropName = propName + "Mode";

        var tintOption = options[tintPropName];
        var vertexColorOption = options[vertexColorPropName];
        var textureOption = options[mapPropName];
        var detailModeOption = options[detailModePropName];

        var subCode = chunks[chunkName];

        if (textureOption) {
            var uv = this._getUvSourceExpression(transformPropName, uVPropName, options);

            subCode = subCode.replace(/\$UV/g, uv).replace(/\$CH/g, options[channelPropName]);

            if (samplerFormat !== undefined) {
                var fmt = samplerFormat === 0 ? "texture2DSRGB" : (samplerFormat === 1 ? "texture2DRGBM" : "texture2D");
                subCode = subCode.replace(/\$texture2DSAMPLE/g, fmt);
            }
        }

        if (vertexColorOption) {
            subCode = subCode.replace(/\$VC/g, options[vertexColorChannelPropName]);
        }

        if (detailModeOption) {
            subCode = subCode.replace(/\$DETAILMODE/g, detailModeOption);
        }

        var isFloatTint = (tintOption === 1);
        var isVecTint = (tintOption === 3);

        subCode = this._addMapDefs(isFloatTint, isVecTint, vertexColorOption, textureOption) + subCode;
        return subCode.replace(/\$/g, "");
    },

    // handles directional map shadow coordinate generation, including cascaded shadows
    _directionalShadowMapProjection: function (light, shadowCoordArgs, shadowParamArg, lightIndex, coordsFunctioName) {

        // for shadow cascades
        let code = "";
        if (light.numCascades > 1) {
            // compute which cascade matrix needs to be used
            code += `getShadowCascadeMatrix(light${lightIndex}_shadowMatrixPalette, light${lightIndex}_shadowCascadeDistances, light${lightIndex}_shadowCascadeCount);\n`;
            shadowCoordArgs = `(cascadeShadowMat, ${shadowParamArg});\n`;
        }

        // shadow coordinate generation
        code += coordsFunctioName + shadowCoordArgs;

        // stop shadow at the far distance
        code += `fadeShadow(light${lightIndex}_shadowCascadeDistances);\n`;
        return code;
    },

    _nonPointShadowMapProjection: function (device, light, shadowMatArg, shadowParamArg, lightIndex) {
        const shadowCoordArgs = `(${shadowMatArg}, ${shadowParamArg});\n`;
        if (!light._normalOffsetBias || light._isVsm) {
            if (light._type === LIGHTTYPE_SPOT) {
                if (light._isPcf && (device.webgl2 || device.extStandardDerivatives)) {
                    return "       getShadowCoordPerspZbuffer" + shadowCoordArgs;
                }
                return "       getShadowCoordPersp" + shadowCoordArgs;
            }
            return this._directionalShadowMapProjection(light, shadowCoordArgs, shadowParamArg, lightIndex, "getShadowCoordOrtho");
        }
        if (light._type === LIGHTTYPE_SPOT) {
            if (light._isPcf && (device.webgl2 || device.extStandardDerivatives)) {
                return "       getShadowCoordPerspZbufferNormalOffset" + shadowCoordArgs;
            }
            return "       getShadowCoordPerspNormalOffset" + shadowCoordArgs;
        }
        return this._directionalShadowMapProjection(light, shadowCoordArgs, shadowParamArg, lightIndex, "getShadowCoordOrthoNormalOffset");
    },

    _addVaryingIfNeeded: function (code, type, name) {
        return code.indexOf(name) >= 0 ? ("varying " + type + " " + name + ";\n") : "";
    },

    _getLightSourceShapeString: function (shape) {
        switch (shape) {
            case LIGHTSHAPE_RECT:
                return 'Rect';
            case LIGHTSHAPE_DISK:
                return 'Disk';
            case LIGHTSHAPE_SPHERE:
                return 'Sphere';
            default:
                return '';
        }
    },

    _vsAddTransformCode: function (code, device, chunks, options) {
        code += chunks.transformVS;

        return code;
    },

    _vsAddBaseCode: function (code, device, chunks, options) {
        code += chunks.baseVS;
        if (options.nineSlicedMode === SPRITE_RENDERMODE_SLICED ||
            options.nineSlicedMode === SPRITE_RENDERMODE_TILED) {
            code += chunks.baseNineSlicedVS;
        }

        return code;
    },

    /**
     * @private
     * @function
     * @name _fsAddBaseCode
     * @description Add "Base" Code section to fragment shader.
     * @param {string} code - Current fragment shader code.
     * @param {GraphicsDevice} device - The graphics device.
     * @param {object} chunks - All available shader chunks.
     * @param {object} options - The Shader Definition options.
     * @returns {string} The new fragment shader code (old+new).
     */
    _fsAddBaseCode: function (code, device, chunks, options) {
        code += chunks.basePS;
        if (options.nineSlicedMode === SPRITE_RENDERMODE_SLICED) {
            code += chunks.baseNineSlicedPS;
        } else if (options.nineSlicedMode === SPRITE_RENDERMODE_TILED) {
            code += chunks.baseNineSlicedTiledPS;
        }

        return code;
    },

    /**
     * @private
     * @function
     * @name _fsAddStartCode
     * @description Add "Start" Code section to fragment shader.
     * @param {string} code -  Current fragment shader code.
     * @param {GraphicsDevice} device - The graphics device.
     * @param {object} chunks - All available shader chunks.
     * @param {object} options - The Shader Definition options.
     * @returns {string} The new fragment shader code (old+new).
     */
    _fsAddStartCode: function (code, device, chunks, options) {
        code += chunks.startPS;

        if (options.nineSlicedMode === SPRITE_RENDERMODE_SLICED) {
            code += chunks.startNineSlicedPS;
        } else if (options.nineSlicedMode === SPRITE_RENDERMODE_TILED) {
            code += chunks.startNineSlicedTiledPS;
        }

        return code;
    },

    createShaderDefinition: function (device, options) {
        var i, p;
        var lighting = options.lights.length > 0;

        if (options.dirLightMap) {
            lighting = true;
        }

        if (LayerComposition.clusteredLightingEnabled) {
            lighting = true;
        }

        if (options.shadingModel === SPECULAR_PHONG) {
            options.fresnelModel = 0;
            options.specularAntialias = false;
            options.prefilteredCubemap = false;
            options.dpAtlas = false;
            options.ambientSH = false;
        } else {
            options.fresnelModel = (options.fresnelModel === 0) ? FRESNEL_SCHLICK : options.fresnelModel;
        }

        var cubemapReflection = (options.cubeMap || (options.prefilteredCubemap && options.useSpecular)) && !options.sphereMap && !options.dpAtlas;
        var reflections = options.sphereMap || cubemapReflection || options.dpAtlas;
        var useTexCubeLod = options.useTexCubeLod;
        if (options.cubeMap) options.sphereMap = null; // cubeMaps have higher priority
        if (options.dpAtlas) options.prefilteredCubemap = null; // dp has even higher priority
        if (!options.useSpecular) options.specularMap = options.glossMap = null;
        var needsNormal = lighting || reflections || options.ambientSH || options.prefilteredCubemap || options.heightMap || options.enableGGXSpecular;
        var shadowPass = options.pass >= SHADER_SHADOW && options.pass <= 17;

        this.options = options;

        // GENERATE VERTEX SHADER
        var code = '';
        var codeBody = '';

        var varyings = ""; // additional varyings for map transforms

        var chunks = shaderChunks;

        var lightType;
        var shadowCoordArgs;
        var chunk;

        var attributes = {
            vertex_position: SEMANTIC_POSITION
        };

        if (options.chunks) {
            var customChunks = {};
            var newP;
            for (p in chunks) {
                if (chunks.hasOwnProperty(p)) {
                    if (!options.chunks[p]) {
                        customChunks[p] = chunks[p];
                    } else {
                        chunk = options.chunks[p];
                        // scan for attributes in custom code
                        if (chunk.indexOf("vertex_normal") >= 0) {
                            attributes.vertex_normal = SEMANTIC_NORMAL;
                        }
                        if (chunk.indexOf("vertex_tangent") >= 0) {
                            attributes.vertex_tangent = SEMANTIC_TANGENT;
                        }
                        if (chunk.indexOf("vertex_texCoord0") >= 0) {
                            attributes.vertex_texCoord0 = SEMANTIC_TEXCOORD0;
                        }
                        if (chunk.indexOf("vertex_texCoord1") >= 0) {
                            attributes.vertex_texCoord1 = SEMANTIC_TEXCOORD1;
                        }
                        if (chunk.indexOf("vertex_color") >= 0) {
                            attributes.vertex_color = SEMANTIC_COLOR;
                        }
                        if (chunk.indexOf("vertex_boneWeights") >= 0) {
                            attributes.vertex_boneWeights = SEMANTIC_BLENDWEIGHT;
                        }
                        if (chunk.indexOf("vertex_boneIndices") >= 0) {
                            attributes.vertex_boneIndices = SEMANTIC_BLENDINDICES;
                        }
                        customChunks[p] = chunk;
                    }
                }
            }

            for (p in options.chunks) {
                newP = this._oldChunkToNew[p];
                if (newP) {
                    customChunks[newP.n] = newP.f(options.chunks[p], newP.n, p);
                }
            }

            chunks = customChunks;
        }


        // code += chunks.baseVS;
        code = this._vsAddBaseCode(code, device, chunks, options);

        codeBody += "   vPositionW    = getWorldPosition();\n";

        if (options.pass === SHADER_DEPTH) {
            code += 'varying float vDepth;\n';
            code += '#ifndef VIEWMATRIX\n';
            code += '#define VIEWMATRIX\n';
            code += 'uniform mat4 matrix_view;\n';
            code += '#endif\n';
            code += '#ifndef CAMERAPLANES\n';
            code += '#define CAMERAPLANES\n';
            code += 'uniform vec4 camera_params;\n\n';
            code += '#endif\n';
            codeBody += "    vDepth = -(matrix_view * vec4(vPositionW,1.0)).z * camera_params.x;\n";
        }

        if (options.useInstancing) {
            attributes.instance_line1 = SEMANTIC_TEXCOORD2;
            attributes.instance_line2 = SEMANTIC_TEXCOORD3;
            attributes.instance_line3 = SEMANTIC_TEXCOORD4;
            attributes.instance_line4 = SEMANTIC_TEXCOORD5;
            code += chunks.instancingVS;
        }

        if (needsNormal) {
            attributes.vertex_normal = SEMANTIC_NORMAL;
            codeBody += "   vNormalW = getNormal();\n";

            if ((options.sphereMap) && (device.fragmentUniformsCount <= 16)) {
                code += chunks.viewNormalVS;
                codeBody += "   vNormalV    = getViewNormal();\n";
            }

            if ((options.heightMap || options.normalMap || options.enableGGXSpecular) && options.hasTangents) {
                attributes.vertex_tangent = SEMANTIC_TANGENT;
                code += chunks.tangentBinormalVS;
                codeBody += "   vTangentW   = getTangent();\n";
                codeBody += "   vBinormalW  = getBinormal();\n";
            } else if (options.enableGGXSpecular) {
                code += chunks.tangentBinormalVS;
                codeBody += "   vObjectSpaceUpW  = getObjectSpaceUp();\n";
            }
        }

        var useUv = [];
        var useUnmodifiedUv = [];
        var maxUvSets = 2;
        var cname, mname, tname, uname;

        for (p in _matTex2D) {
            mname = p + "Map";
            if (options[p + "VertexColor"]) {
                cname = p + "VertexColorChannel";
                options[cname] = this._correctChannel(p, options[cname]);
            }
            if (options[mname]) {
                cname = mname + "Channel";
                tname = mname + "Transform";
                uname = mname + "Uv";
                options[uname] = Math.min(options[uname], maxUvSets - 1);
                options[cname] = this._correctChannel(p, options[cname]);
                var uvSet = options[uname];
                useUv[uvSet] = true;
                useUnmodifiedUv[uvSet] = useUnmodifiedUv[uvSet] || (options[mname] && !options[tname]);
            }
        }

        if (options.forceUv1) {
            useUv[1] = true;
            useUnmodifiedUv[1] = (useUnmodifiedUv[1] !== undefined) ? useUnmodifiedUv[1] : true;
        }

        for (i = 0; i < maxUvSets; i++) {
            if (useUv[i]) {
                attributes["vertex_texCoord" + i] = "TEXCOORD" + i;
                code += chunks["uv" + i + "VS"];
                codeBody += "   vec2 uv" + i + " = getUv" + i + "();\n";
            }
            if (useUnmodifiedUv[i]) {
                codeBody += "   vUv" + i + " = uv" + i + ";\n";
            }
        }

        var codes = [code, varyings, codeBody, []];

        for (p in _matTex2D) {
            mname = p + "Map";
            if (options[mname]) {
                tname = mname + "Transform";
                if (options[tname]) {
                    uname = mname + "Uv";
                    this._setMapTransform(codes, p, options[tname], options[uname]);
                }
            }
        }

        code = codes[0];
        varyings = codes[1];
        codeBody = codes[2];

        if (options.vertexColors) {
            attributes.vertex_color = SEMANTIC_COLOR;
            codeBody += "   vVertexColor = vertex_color;\n";
        }

        // morphing
        if (options.useMorphPosition || options.useMorphNormal) {

            if (options.useMorphTextureBased) {

                code += "#define MORPHING_TEXTURE_BASED\n";

                if (options.useMorphPosition) {
                    code += "#define MORPHING_TEXTURE_BASED_POSITION\n";
                }

                if (options.useMorphNormal) {
                    code += "#define MORPHING_TEXTURE_BASED_NORMAL\n";
                }

                // vertex ids attributes
                attributes.morph_vertex_id = SEMANTIC_ATTR15;
                code += "attribute float morph_vertex_id;\n";

            } else {

                // set up 8 slots for morphing. these are supported combinations: PPPPPPPP, NNNNNNNN, PPPPNNNN
                code += "#define MORPHING\n";

                // first 4 slots are either position or normal
                if (options.useMorphPosition) {
                    attributes.morph_pos0 = SEMANTIC_ATTR8;
                    attributes.morph_pos1 = SEMANTIC_ATTR9;
                    attributes.morph_pos2 = SEMANTIC_ATTR10;
                    attributes.morph_pos3 = SEMANTIC_ATTR11;

                    code += "#define MORPHING_POS03\n";
                    code += "attribute vec3 morph_pos0;\n";
                    code += "attribute vec3 morph_pos1;\n";
                    code += "attribute vec3 morph_pos2;\n";
                    code += "attribute vec3 morph_pos3;\n";

                } else if (options.useMorphNormal) {
                    attributes.morph_nrm0 = SEMANTIC_ATTR8;
                    attributes.morph_nrm1 = SEMANTIC_ATTR9;
                    attributes.morph_nrm2 = SEMANTIC_ATTR10;
                    attributes.morph_nrm3 = SEMANTIC_ATTR11;

                    code += "#define MORPHING_NRM03\n";
                    code += "attribute vec3 morph_nrm0;\n";
                    code += "attribute vec3 morph_nrm1;\n";
                    code += "attribute vec3 morph_nrm2;\n";
                    code += "attribute vec3 morph_nrm3;\n";
                }

                // next 4 slots are either position or normal
                if (!options.useMorphNormal) {
                    attributes.morph_pos4 = SEMANTIC_ATTR12;
                    attributes.morph_pos5 = SEMANTIC_ATTR13;
                    attributes.morph_pos6 = SEMANTIC_ATTR14;
                    attributes.morph_pos7 = SEMANTIC_ATTR15;

                    code += "#define MORPHING_POS47\n";
                    code += "attribute vec3 morph_pos4;\n";
                    code += "attribute vec3 morph_pos5;\n";
                    code += "attribute vec3 morph_pos6;\n";
                    code += "attribute vec3 morph_pos7;\n";
                } else {
                    attributes.morph_nrm4 = SEMANTIC_ATTR12;
                    attributes.morph_nrm5 = SEMANTIC_ATTR13;
                    attributes.morph_nrm6 = SEMANTIC_ATTR14;
                    attributes.morph_nrm7 = SEMANTIC_ATTR15;

                    code += "#define MORPHING_NRM47\n";
                    code += "attribute vec3 morph_nrm4;\n";
                    code += "attribute vec3 morph_nrm5;\n";
                    code += "attribute vec3 morph_nrm6;\n";
                    code += "attribute vec3 morph_nrm7;\n";
                }
            }
        }

        if (options.skin) {
            attributes.vertex_boneWeights = SEMANTIC_BLENDWEIGHT;
            attributes.vertex_boneIndices = SEMANTIC_BLENDINDICES;
            code += skinCode(device, chunks);
            code += "#define SKIN\n";
        } else if (options.useInstancing) {
            code += "#define INSTANCING\n";
        }
        if (options.screenSpace) {
            code += "#define SCREENSPACE\n";
        }
        if (options.pixelSnap) {
            code += "#define PIXELSNAP\n";
        }

        code = this._vsAddTransformCode(code, device, chunks, options);

        if (needsNormal) code += chunks.normalVS;

        code += "\n";

        code += chunks.startVS;
        code += codeBody;
        code += chunks.endVS;
        code += "}";

        var vshader = code;

        var oldVars = varyings;
        varyings = "";
        varyings += this._addVaryingIfNeeded(code, "vec4", "vVertexColor");
        varyings += this._addVaryingIfNeeded(code, "vec3", "vPositionW");
        varyings += this._addVaryingIfNeeded(code, "vec3", "vNormalV");
        varyings += this._addVaryingIfNeeded(code, "vec3", "vNormalW");
        varyings += this._addVaryingIfNeeded(code, "vec3", "vTangentW");
        varyings += this._addVaryingIfNeeded(code, "vec3", "vBinormalW");
        varyings += this._addVaryingIfNeeded(code, "vec3", "vObjectSpaceUpW");
        varyings += this._addVaryingIfNeeded(code, "vec2", "vUv0");
        varyings += this._addVaryingIfNeeded(code, "vec2", "vUv1");
        varyings += oldVars;
        vshader = varyings + vshader;

        var startCode = "";
        if (device.webgl2) {
            startCode = versionCode(device);
            if (chunks.extensionVS) {
                startCode += chunks.extensionVS + "\n";
            }
            vshader = startCode + chunks.gles3VS + vshader;
        } else {
            if (chunks.extensionVS) {
                startCode = chunks.extensionVS + "\n";
            }
            vshader = startCode + vshader;
        }

        // GENERATE FRAGMENT SHADER
        if (options.forceFragmentPrecision && options.forceFragmentPrecision !== "highp" &&
            options.forceFragmentPrecision !== "mediump" && options.forceFragmentPrecision !== "lowp")
            options.forceFragmentPrecision = null;

        if (options.forceFragmentPrecision) {
            if (options.forceFragmentPrecision === "highp" && device.maxPrecision !== "highp") options.forceFragmentPrecision = "mediump";
            if (options.forceFragmentPrecision === "mediump" && device.maxPrecision === "lowp") options.forceFragmentPrecision = "lowp";
        }

        var fshader;
        code = '';

        if (device.webgl2) {
            code += versionCode(device);
        }

        if (device.extStandardDerivatives && !device.webgl2) {
            code += "#extension GL_OES_standard_derivatives : enable\n\n";
        }
        if (chunks.extensionPS) {
            code += chunks.extensionPS + "\n";
        }

        if (device.webgl2) {
            code += chunks.gles3PS;
        }

        code += options.forceFragmentPrecision ? "precision " + options.forceFragmentPrecision + " float;\n\n" : precisionCode(device);

        if (options.pass === SHADER_PICK) {
            // ##### PICK PASS #####
            code += "uniform vec4 uColor;\n";
            code += varyings;
            if (options.alphaTest) {
                code += "float dAlpha;\n";
                code += this._addMap("opacity", "opacityPS", options, chunks);
                code += chunks.alphaTestPS;
            }
            code += begin();
            if (options.alphaTest) {
                code += "   getOpacity();\n";
                code += "   alphaTest(dAlpha);\n";
            }
            code += "    gl_FragColor = uColor;\n";
            code += end();
            return {
                attributes: attributes,
                vshader: vshader,
                fshader: code
            };

        } else if (options.pass === SHADER_DEPTH) {
            // ##### SCREEN DEPTH PASS #####
            code += 'varying float vDepth;\n';
            code += varyings;
            code += chunks.packDepthPS;
            if (options.alphaTest) {
                code += "float dAlpha;\n";
                code += this._addMap("opacity", "opacityPS", options, chunks);
                code += chunks.alphaTestPS;
            }
            code += begin();
            if (options.alphaTest) {
                code += "   getOpacity();\n";
                code += "   alphaTest(dAlpha);\n";
            }
            code += "    gl_FragColor = packFloat(vDepth);\n";
            code += end();
            return {
                attributes: attributes,
                vshader: vshader,
                fshader: code
            };

        } else if (shadowPass) {
            // ##### SHADOW PASS #####
            const smode = options.pass - SHADER_SHADOW;
            const numShadowModes = SHADOW_COUNT;
            lightType = Math.floor(smode / numShadowModes);
            var shadowType = smode - lightType * numShadowModes;

            if (device.extStandardDerivatives && !device.webgl2) {
                code += 'uniform vec2 polygonOffset;\n';
            }

            if (shadowType === SHADOW_VSM32) {
                if (device.textureFloatHighPrecision) {
                    code += '#define VSM_EXPONENT 15.0\n\n';
                } else {
                    code += '#define VSM_EXPONENT 5.54\n\n';
                }
            } else if (shadowType === SHADOW_VSM16) {
                code += '#define VSM_EXPONENT 5.54\n\n';
            }

            if (lightType !== LIGHTTYPE_DIRECTIONAL) {
                code += 'uniform vec3 view_position;\n';
                code += 'uniform float light_radius;\n';
            }

            code += varyings;
            if (options.alphaTest) {
                code += "float dAlpha;\n";
                code += this._addMap("opacity", "opacityPS", options, chunks);
                code += chunks.alphaTestPS;
            }

            if (shadowType === SHADOW_PCF3 && (!device.webgl2 || lightType === LIGHTTYPE_OMNI)) {
                code += chunks.packDepthPS;
            } else if (shadowType === SHADOW_VSM8) {
                code += "vec2 encodeFloatRG( float v ) {\n";
                code += "    vec2 enc = vec2(1.0, 255.0) * v;\n";
                code += "    enc = fract(enc);\n";
                code += "    enc -= enc.yy * vec2(1.0/255.0, 1.0/255.0);\n";
                code += "    return enc;\n";
                code += "}\n\n";
            }

            code += begin();

            if (options.alphaTest) {
                code += "   getOpacity();\n";
                code += "   alphaTest(dAlpha);\n";
            }

            var isVsm = shadowType === SHADOW_VSM8 || shadowType === SHADOW_VSM16 || shadowType === SHADOW_VSM32;

            if (lightType === LIGHTTYPE_OMNI || (isVsm && lightType !== LIGHTTYPE_DIRECTIONAL)) {
                code += "   float depth = min(distance(view_position, vPositionW) / light_radius, 0.99999);\n";
            } else {
                code += "   float depth = gl_FragCoord.z;\n";
            }

            if (shadowType === SHADOW_PCF3 && (!device.webgl2 || lightType === LIGHTTYPE_OMNI)) {
                if (device.extStandardDerivatives && !device.webgl2) {
                    code += "   float minValue = 2.3374370500153186e-10; //(1.0 / 255.0) / (256.0 * 256.0 * 256.0);\n";
                    code += "   depth += polygonOffset.x * max(abs(dFdx(depth)), abs(dFdy(depth))) + minValue * polygonOffset.y;\n";
                    code += "   gl_FragColor = packFloat(depth);\n";
                } else {
                    code += "   gl_FragColor = packFloat(depth);\n";
                }
            } else if (shadowType === SHADOW_PCF3 || shadowType === SHADOW_PCF5) {
                code += "   gl_FragColor = vec4(1.0);\n"; // just the simpliest code, color is not written anyway
            } else if (shadowType === SHADOW_VSM8) {
                code += "   gl_FragColor = vec4(encodeFloatRG(depth), encodeFloatRG(depth*depth));\n";
            } else {
                code += chunks.storeEVSMPS;
            }

            code += end();

            return {
                attributes: attributes,
                vshader: vshader,
                fshader: code
            };
        }

        if (options.customFragmentShader) {
            // ##### CUSTOM PS #####
            fshader = code + options.customFragmentShader;
            return {
                attributes: attributes,
                vshader: vshader,
                fshader: fshader,
                tag: SHADERTAG_MATERIAL
            };
        }

        // ##### FORWARD/FORWARDHDR PASS #####
        code += varyings;

        // code += chunks.basePS;
        code = this._fsAddBaseCode(code, device, chunks, options);

        if (options.detailModes) {
            code += chunks.detailModesPS;
        }

        var codeBegin = code;
        code = "";

        if (options.clearCoat > 0) {
            code += '#define CLEARCOAT\n';
        }

        if (options.opacityFadesSpecular === false) {
            code += 'uniform float material_alphaFade;\n';
        }

        // FRAGMENT SHADER INPUTS: UNIFORMS
        var numShadowLights = 0;
        var shadowTypeUsed = [];
        var shadowedDirectionalLightUsed = false;
        var useVsm = false;
        var usePerspZbufferShadow = false;
        var light;

        var hasAreaLights = options.lights.some(function (light) {
            return light._shape && light._shape !== LIGHTSHAPE_PUNCTUAL;
        });

        if (device.areaLightLutFormat === PIXELFORMAT_R8_G8_B8_A8) {
            // use offset and scale for rgb8 format luts
            code += "#define AREA_R8_G8_B8_A8_LUTS\n";
            code += "#define AREA_LUTS_PRECISION lowp\n";
        } else {
            code += "#define AREA_LUTS_PRECISION highp\n";
        }

        if (hasAreaLights) {
            code += "#define AREA_LIGHTS\n";
            code += "uniform AREA_LUTS_PRECISION sampler2D areaLightsLutTex1;\n";
            code += "uniform AREA_LUTS_PRECISION sampler2D areaLightsLutTex2;\n";
        }

        var lightShape = LIGHTSHAPE_PUNCTUAL;

        for (i = 0; i < options.lights.length; i++) {
            light = options.lights[i];
            lightType = light._type;

            if (hasAreaLights && light._shape) {
                lightShape = light._shape;
            } else {
                lightShape = LIGHTSHAPE_PUNCTUAL;
            }

            code += "uniform vec3 light" + i + "_color;\n";
            if (lightType === LIGHTTYPE_DIRECTIONAL) {
                code += "uniform vec3 light" + i + "_direction;\n";
            } else {
                code += "uniform vec3 light" + i + "_position;\n";
                code += "uniform float light" + i + "_radius;\n";
                if (lightType === LIGHTTYPE_SPOT) {
                    code += "uniform vec3 light" + i + "_direction;\n";
                    code += "uniform float light" + i + "_innerConeAngle;\n";
                    code += "uniform float light" + i + "_outerConeAngle;\n";
                }
            }
            if (lightShape !== LIGHTSHAPE_PUNCTUAL) {
                if (lightType === LIGHTTYPE_DIRECTIONAL) {
                    code += "uniform vec3 light" + i + "_position;\n";
                }
                code += "uniform vec3 light" + i + "_halfWidth;\n";
                code += "uniform vec3 light" + i + "_halfHeight;\n";
            }
            if (light.castShadows && !options.noShadow) {
                code += "uniform mat4 light" + i + "_shadowMatrix;\n";

                // directional (cascaded) shadows
                if (lightType === LIGHTTYPE_DIRECTIONAL) {
                    code += "uniform mat4 light" + i + "_shadowMatrixPalette[4];\n";
                    code += "uniform float light" + i + "_shadowCascadeDistances[4];\n";
                    code += "uniform float light" + i + "_shadowCascadeCount;\n";
                }

                if (lightType !== LIGHTTYPE_DIRECTIONAL) {
                    code += "uniform vec4 light" + i + "_shadowParams;\n"; // Width, height, bias, radius
                } else {
                    shadowedDirectionalLightUsed = true;
                    code += "uniform vec3 light" + i + "_shadowParams;\n"; // Width, height, bias
                }
                if (lightType === LIGHTTYPE_OMNI) {
                    code += "uniform samplerCube light" + i + "_shadowMap;\n";
                } else {
                    if (light._isPcf && device.webgl2) {
                        code += "uniform sampler2DShadow light" + i + "_shadowMap;\n";
                    } else {
                        code += "uniform sampler2D light" + i + "_shadowMap;\n";
                    }
                }
                numShadowLights++;
                shadowTypeUsed[light._shadowType] = true;
                if (light._isVsm) useVsm = true;
                if (light._isPcf && (device.webgl2 || device.extStandardDerivatives) && lightType === LIGHTTYPE_SPOT) usePerspZbufferShadow = true;
            }
            if (light._cookie) {
                if (light._cookie._cubemap) {
                    if (lightType === LIGHTTYPE_OMNI) {
                        code += "uniform samplerCube light" + i + "_cookie;\n";
                        code += "uniform float light" + i + "_cookieIntensity;\n";
                        if (!light.castShadows || options.noShadow) code += "uniform mat4 light" + i + "_shadowMatrix;\n";
                    }
                } else {
                    if (lightType === LIGHTTYPE_SPOT) {
                        code += "uniform sampler2D light" + i + "_cookie;\n";
                        code += "uniform float light" + i + "_cookieIntensity;\n";
                        if (!light.castShadows || options.noShadow) code += "uniform mat4 light" + i + "_shadowMatrix;\n";
                        if (light._cookieTransform) {
                            code += "uniform vec4 light" + i + "_cookieMatrix;\n";
                            code += "uniform vec2 light" + i + "_cookieOffset;\n";
                        }
                    }
                }
            }
        }

        code += "\n"; // End of uniform declarations


        var tbn;
        if (!options.hasTangents && device.extStandardDerivatives) {
            tbn = chunks.TBNderivativePS;
        } else if (options.fastTbn) {
            tbn = chunks.TBNfastPS;
        } else {
            tbn = chunks.TBNPS;
        }

        if (needsNormal) {
             // if normalMap is disabled, then so is normalDetailMap
            if (options.normalMap || options.clearCoatNormalMap) {
                // TODO: let each normalmap input (normalMap, normalDetailMap, clearCoatNormalMap) indenpendently decide which unpackNormal to use.
                code += options.packedNormal ? chunks.normalXYPS : chunks.normalXYZPS;

                if (!options.hasTangents) {
                    // TODO: generalize to support each normalmap input (normalMap, normalDetailMap, clearCoatNormalMap) indenpendently
                    var normalMapUv = this._getUvSourceExpression("normalMapTransform", "normalMapUv", options);
                    tbn = tbn.replace(/\$UV/g, normalMapUv);
                }
                code += tbn;
            } else if (options.enableGGXSpecular && !options.heightMap) {
                code += chunks.normalVertexPS;
                code += chunks.TBNObjectSpacePS;
            }
        }

        if (needsNormal) {
            if (options.normalMap) {
                if (options.normalDetail) {
                    code += this._addMap("normalDetail", "normalDetailMapPS", options, chunks);
                }

                var transformedNormalMapUv = this._getUvSourceExpression("normalMapTransform", "normalMapUv", options);
                if (options.normalizeNormalMap) {
                    code += chunks.normalMapPS.replace(/\$UV/g, transformedNormalMapUv);
                } else {
                    code += chunks.normalMapFastPS.replace(/\$UV/g, transformedNormalMapUv);
                }
            } else if (!(options.enableGGXSpecular && !options.heightMap)) {
                code += chunks.normalVertexPS;
            }
        }

        code += gammaCode(options.gamma, chunks);
        code += tonemapCode(options.toneMap, chunks);
        code += fogCode(options.fog, chunks);

        if (options.useRgbm) code += chunks.rgbmPS;
        if (cubemapReflection || options.prefilteredCubemap) {
            code += options.fixSeams ? chunks.fixCubemapSeamsStretchPS : chunks.fixCubemapSeamsNonePS;
        }

        if (options.useCubeMapRotation) {
            code += "#define CUBEMAP_ROTATION\n";
        }

        if (options.useRightHandedCubeMap) {
            code += "#define RIGHT_HANDED_CUBEMAP\n";
        }

        if (needsNormal) {
            code += chunks.cubeMapRotatePS;

            code += options.cubeMapProjection > 0 ? chunks.cubeMapProjectBoxPS : chunks.cubeMapProjectNonePS;
            code += options.skyboxIntensity ? chunks.envMultiplyPS : chunks.envConstPS;
        }

        if (options.diffuseDetail) {
            code += this._addMap("diffuseDetail", "diffuseDetailMapPS", options, chunks);
        }

        code += this._addMap("diffuse", "diffusePS", options, chunks);

        if (options.blendType !== BLEND_NONE || options.alphaTest || options.alphaToCoverage) {
            code += this._addMap("opacity", "opacityPS", options, chunks);
        }
        code += this._addMap("emissive", "emissivePS", options, chunks, options.emissiveFormat);

        if ((lighting && options.useSpecular) || reflections) {
            if (options.specularAntialias && options.normalMap) {
                if (options.normalizeNormalMap && needsNormal) {
                    code += chunks.specularAaToksvigPS;
                } else {
                    code += chunks.specularAaToksvigFastPS;
                }
            } else {
                code += chunks.specularAaNonePS;
            }

            var specularPropName = options.useMetalness ? "metalness" : "specular";
            code += this._addMap(specularPropName, specularPropName + "PS", options, chunks);
            code += this._addMap("gloss", "glossPS", options, chunks);
            if (options.fresnelModel === FRESNEL_SCHLICK) {
                code += chunks.fresnelSchlickPS;
            }
        }

        if (options.clearCoat > 0) {
            code += this._addMap("clearCoat", "clearCoatPS", options, chunks);
            code += this._addMap("clearCoatGloss", "clearCoatGlossPS", options, chunks);
            code += this._addMap("clearCoatNormal", "clearCoatNormalPS", options, chunks);
        }

        if (options.heightMap) {
            if (!options.normalMap) {
                var transformedHeightMapUv = this._getUvSourceExpression("heightMapTransform", "heightMapUv", options);
                if (!options.hasTangents) tbn = tbn.replace(/\$UV/g, transformedHeightMapUv);
                code += tbn;
            }
            code += this._addMap("height", "parallaxPS", options, chunks);
        }

        var useAo = options.aoMap || options.aoVertexColor;
        if (useAo) {
            code += this._addMap("ao", "aoPS", options, chunks);
            if (options.occludeSpecular) {
                if (options.occludeSpecular === SPECOCC_AO) {
                    code += options.occludeSpecularFloat ? chunks.aoSpecOccSimplePS : chunks.aoSpecOccConstSimplePS;
                } else {
                    code += options.occludeSpecularFloat ? chunks.aoSpecOccPS : chunks.aoSpecOccConstPS;
                }
            }
        }

        var reflectionDecode = options.rgbmReflection ? "decodeRGBM" : (options.hdrReflection ? "" : "gammaCorrectInput");

        if (options.sphereMap) {
            var scode = device.fragmentUniformsCount > 16 ? chunks.reflectionSpherePS : chunks.reflectionSphereLowPS;
            scode = scode.replace(/\$texture2DSAMPLE/g, options.rgbmReflection ? "texture2DRGBM" : (options.hdrReflection ? "texture2D" : "texture2DSRGB"));
            code += scode;
        } else if (cubemapReflection) {
            if (options.prefilteredCubemap) {
                if (useTexCubeLod) {
                    code += chunks.reflectionPrefilteredCubeLodPS.replace(/\$DECODE/g, reflectionDecode);

                } else {
                    code += chunks.reflectionPrefilteredCubePS.replace(/\$DECODE/g, reflectionDecode);
                }
            } else {
                code += chunks.reflectionCubePS.replace(/\$textureCubeSAMPLE/g,
                                                        options.rgbmReflection ? "textureCubeRGBM" : (options.hdrReflection ? "textureCube" : "textureCubeSRGB"));
            }
        } else if (options.dpAtlas) {
            code += chunks.reflectionDpAtlasPS.replace(/\$texture2DSAMPLE/g, options.rgbmReflection ? "texture2DRGBM" : (options.hdrReflection ? "texture2D" : "texture2DSRGB"));
        }

        if (cubemapReflection || options.sphereMap || options.dpAtlas) {
            if (options.clearCoat > 0) {
                code += chunks.reflectionCCPS;
            }
            if (options.refraction) {
                code += chunks.refractionPS;
            }
        }

        if (numShadowLights > 0) {
            if (shadowedDirectionalLightUsed) {
                code += shaderChunks.shadowCascadesPS;
            }
            if (shadowTypeUsed[SHADOW_PCF3]) {
                code += chunks.shadowStandardPS;
            }
            if (shadowTypeUsed[SHADOW_PCF5]) {
                code += chunks.shadowStandardGL2PS;
            }
            if (useVsm) {
                code += chunks.shadowVSM_commonPS;
                if (shadowTypeUsed[SHADOW_VSM8]) {
                    code += chunks.shadowVSM8PS;
                }
                if (shadowTypeUsed[SHADOW_VSM16]) {
                    code += device.extTextureHalfFloatLinear ? chunks.shadowEVSMPS.replace(/\$/g, "16") : chunks.shadowEVSMnPS.replace(/\$/g, "16");
                }
                if (shadowTypeUsed[SHADOW_VSM32]) {
                    code += device.extTextureFloatLinear ? chunks.shadowEVSMPS.replace(/\$/g, "32") : chunks.shadowEVSMnPS.replace(/\$/g, "32");
                }
            }

            if (!(device.webgl2 || device.extStandardDerivatives)) {
                code += chunks.biasConstPS;
            }
            // otherwise bias is applied on render

            code += chunks.shadowCoordPS + chunks.shadowCommonPS;
            if (usePerspZbufferShadow) code += chunks.shadowCoordPerspZbufferPS;
        }

        if (options.enableGGXSpecular) code += "uniform float material_anisotropy;\n";

        if (lighting) {
            code += chunks.lightDiffuseLambertPS;
            if (hasAreaLights) code += chunks.ltc;
        }
        var useOldAmbient = false;
        if (options.useSpecular) {
            if (lighting) code += options.shadingModel === SPECULAR_PHONG ? chunks.lightSpecularPhongPS : (options.enableGGXSpecular) ? chunks.lightSpecularAnisoGGXPS : chunks.lightSpecularBlinnPS;
            if (options.sphereMap || cubemapReflection || options.dpAtlas || (options.fresnelModel > 0)) {
                if (options.fresnelModel > 0) {
                    if (options.conserveEnergy && !hasAreaLights) {
                        // NB if there are area lights, energy conservation is done differently
                        code += chunks.combineDiffuseSpecularPS; // this one is correct, others are old stuff
                    } else {
                        code += chunks.combineDiffuseSpecularNoConservePS; // if you don't use environment cubemaps, you may consider this
                    }
                } else {
                    code += chunks.combineDiffuseSpecularOldPS;
                }
            } else {
                if (options.diffuseMap) {
                    code += chunks.combineDiffuseSpecularNoReflPS;
                } else {
                    code += chunks.combineDiffuseSpecularNoReflSeparateAmbientPS;
                    useOldAmbient = true;
                }
            }
        } else {
            code += chunks.combineDiffusePS;
        }

        if (options.clearCoat > 0) {
            code += chunks.combineClearCoatPS;
        }

        var addAmbient = true;
        if (options.lightMap || options.lightVertexColor) {
            var lightmapChunkPropName = (options.dirLightMap && options.useSpecular) ? 'lightmapDirPS' : 'lightmapSinglePS';
            code += this._addMap("light", lightmapChunkPropName, options, chunks, options.lightMapFormat);
            addAmbient = options.lightMapWithoutAmbient;
        }

        if (addAmbient) {

            var ambientDecode = options.rgbmAmbient ? "decodeRGBM" : (options.hdrAmbient ? "" : "gammaCorrectInput");

            if (options.ambientSH) {
                code += chunks.ambientSHPS;
            } else if (options.prefilteredCubemap) {
                if (useTexCubeLod) {
                    code += chunks.ambientPrefilteredCubeLodPS.replace(/\$DECODE/g, ambientDecode);
                } else {
                    code += chunks.ambientPrefilteredCubePS.replace(/\$DECODE/g, ambientDecode);
                }
            } else {
                code += chunks.ambientConstantPS;
            }
        }

        if (options.ambientTint && !useOldAmbient) {
            code += "uniform vec3 material_ambient;\n";
        }

        if (options.alphaTest) {
            code += chunks.alphaTestPS;
        }

        if (options.msdf) {
            code += chunks.msdfPS;
        }

        if (needsNormal) {
            code += chunks.viewDirPS;
            if (options.useSpecular) {
                code += (options.enableGGXSpecular) ? chunks.reflDirAnisoPS : chunks.reflDirPS;
            }
        }

        var hasPointLights = false;
        var usesLinearFalloff = false;
        var usesInvSquaredFalloff = false;
        var usesSpot = false;
        var usesCookie = false;
        var usesCookieNow;

        // clustered lighting
        if (LayerComposition.clusteredLightingEnabled) {

            usesSpot = true;
            hasPointLights = true;
            usesLinearFalloff = true;

            const clusterTextureFormat = WorldClusters.lightTextureFormat === WorldClusters.FORMAT_FLOAT ? "FLOAT" : "8BIT";
            code += `\n#define CLUSTER_TEXTURE_${clusterTextureFormat}\n`;
            code += chunks.clusteredLightPS;
        }

        if (options.twoSidedLighting) code += "uniform float twoSidedLightingNegScaleFactor;\n";

        // FRAGMENT SHADER BODY

        code = this._fsAddStartCode(code, device, chunks, options);

        if (needsNormal) {
            if (!options.hasTangents && device.extStandardDerivatives && !options.fastTbn) {
                if (options.twoSidedLighting) {
                    code += "   dVertexNormalW = normalize(gl_FrontFacing ? vNormalW * twoSidedLightingNegScaleFactor : -vNormalW * twoSidedLightingNegScaleFactor);\n";
                } else {
                    code += "   dVertexNormalW = normalize(vNormalW);\n";
                }
            } else {
                if (options.twoSidedLighting) {
                    code += "   dVertexNormalW = gl_FrontFacing ? vNormalW * twoSidedLightingNegScaleFactor : -vNormalW * twoSidedLightingNegScaleFactor;\n";
                } else {
                    code += "   dVertexNormalW = vNormalW;\n";
                }
            }

            if ((options.heightMap || options.normalMap) && options.hasTangents) {
                if (options.twoSidedLighting) {
                    code += "   dTangentW = gl_FrontFacing ? vTangentW * twoSidedLightingNegScaleFactor : -vTangentW * twoSidedLightingNegScaleFactor;\n";
                    code += "   dBinormalW = gl_FrontFacing ? vBinormalW * twoSidedLightingNegScaleFactor : -vBinormalW * twoSidedLightingNegScaleFactor;\n";
                } else {
                    code += "   dTangentW = vTangentW;\n";
                    code += "   dBinormalW = vBinormalW;\n";
                }
            }
        }

        var opacityParallax = false;
        if (options.blendType === BLEND_NONE && !options.alphaTest && !options.alphaToCoverage) {
            code += "   dAlpha = 1.0;\n";
        } else {
            if (options.heightMap && options.opacityMap) {
                opacityParallax = true;
            } else {
                code += "   getOpacity();\n"; // calculate opacity first if there's no parallax+opacityMap, to allow early out
                if (options.alphaTest) {
                    code += "   alphaTest(dAlpha);\n";
                }
            }
        }

        var getGlossinessCalled = false;

        if (needsNormal) {
            code += "   getViewDir();\n";
            if (options.heightMap || options.normalMap || options.clearCoatNormalMap || options.enableGGXSpecular) {
                code += "   getTBN();\n";
            }
            if (options.heightMap) {
                code += "   getParallax();\n";
            }

            if (opacityParallax) {
                code += "   getOpacity();\n"; // if there's parallax, calculate opacity after it, to properly distort
                if (options.alphaTest) {
                    code += "   alphaTest(dAlpha);\n";
                }
            }

            code += "   getNormal();\n";
            if (options.useSpecular) {
                if (options.enableGGXSpecular) {
                    code += "   getGlossiness();\n";
                    getGlossinessCalled = true;
                }
                code += "   getReflDir();\n";
            }
        }

        code += "   getAlbedo();\n";

        if (options.clearCoat > 0) {
            code += "   getClearCoat();\n";
            code += "   getClearCoatGlossiness();\n";
            code += "   getClearCoatNormal();\n";
        }

        if ((lighting && options.useSpecular) || reflections) {
            code += "   getSpecularity();\n";
            if (!getGlossinessCalled) code += "   getGlossiness();\n";

            // this is needed to allow custom area light fresnel calculations
            if (hasAreaLights) {
                code += "   #ifdef AREA_LIGHTS\n";
                code += "   dSpecularityNoFres = dSpecularity;\n";
                code += "   #ifdef CLEARCOAT\n";
                code += "   ccSpecularityNoFres = ccSpecularity;\n";
                code += "   #endif\n";
                code += "   #endif\n";
            }

            if (options.fresnelModel > 0) code += "   getFresnel();\n";
        }

        if (addAmbient) {
            code += "   addAmbient();\n";
        }
        if (options.ambientTint && !useOldAmbient) {
            code += "   dDiffuseLight *= material_ambient;\n";
        }
        if (useAo && !options.occludeDirect) {
            code += "    applyAO();\n";
        }
        if (options.lightMap || options.lightVertexColor) {
            code += "   addLightMap();\n";
        }

        if (lighting || reflections) {
            if (cubemapReflection || options.sphereMap || options.dpAtlas) {
                if (options.clearCoat > 0) {
                    code += "   addReflectionCC();\n";
                }
                code += "   addReflection();\n";
            }

            if (hasAreaLights) {
                // specular has to be accumulated differently if we want area lights to look correct
                code += "   ccReflection.rgb *= ccSpecularity;\n";
                code += "   dReflection.rgb *= dSpecularity;\n";
                code += "   dSpecularLight *= dSpecularity;\n";

                code += "   float roughness = max((1.0 - dGlossiness) * (1.0 - dGlossiness), 0.001);\n";
            }

            // light source shape support
            var shapeString = '';

            // clustered lighting
            if (LayerComposition.clusteredLightingEnabled) {

                usesLinearFalloff = true;
                hasPointLights = true;
                code += chunks.clusteredLightLoopPS;
            }

            for (i = 0; i < options.lights.length; i++) {

                light = options.lights[i];
                lightType = light._type;

                // if clustered lights are used, skip normal lights other than directional
                if (LayerComposition.clusteredLightingEnabled && lightType !== LIGHTTYPE_DIRECTIONAL) {
                    continue;
                }

                // The following code is not decoupled to separate shader files, because most of it can be actually changed to achieve different behaviors like:
                // - different falloffs
                // - different shadow coords (omni shadows will use drastically different genShadowCoord)
                // - different shadow filter modes
                // - different light source shapes

                // getLightDiffuse and getLightSpecular is BRDF itself.

                usesCookieNow = false;

                if (hasAreaLights && light._shape) {
                    lightShape = light._shape;
                    shapeString = this._getLightSourceShapeString(lightShape);
                } else {
                    lightShape = LIGHTSHAPE_PUNCTUAL;
                    shapeString = '';
                }

                if (lightShape !== LIGHTSHAPE_PUNCTUAL) {
                    code += "   calc" + shapeString + "LightValues(light" + i + "_position, light" + i + "_halfWidth, light" + i + "_halfHeight);\n";
                }

                if (lightType === LIGHTTYPE_DIRECTIONAL) {
                    // directional
                    code += "   dLightDirNormW = light" + i + "_direction;\n";
                    code += "   dAtten = 1.0;\n";
                } else {

                    if (light._cookie) {
                        if (lightType === LIGHTTYPE_SPOT && !light._cookie._cubemap) {
                            usesCookie = true;
                            usesCookieNow = true;
                        } else if (lightType === LIGHTTYPE_OMNI && light._cookie._cubemap) {
                            usesCookie = true;
                            usesCookieNow = true;
                        }
                    }

                    code += "   getLightDirPoint(light" + i + "_position);\n";
                    hasPointLights = true;

                    if (usesCookieNow) {
                        if (lightType === LIGHTTYPE_SPOT) {
                            code += "   dAtten3 = getCookie2D" + (light._cookieFalloff ? "" : "Clip") + (light._cookieTransform ? "Xform" : "") + "(light" + i + "_cookie, light" + i + "_shadowMatrix, light" + i + "_cookieIntensity" + (light._cookieTransform ? ", light" + i + "_cookieMatrix, light" + i + "_cookieOffset" : "") + ")." + light._cookieChannel + ";\n";
                        } else {
                            code += "   dAtten3 = getCookieCube(light" + i + "_cookie, light" + i + "_shadowMatrix, light" + i + "_cookieIntensity)." + light._cookieChannel + ";\n";
                        }
                    }

                    if (lightShape === LIGHTSHAPE_PUNCTUAL) {
                        if (light._falloffMode === LIGHTFALLOFF_LINEAR) {
                            code += "   dAtten = getFalloffLinear(light" + i + "_radius);\n";
                            usesLinearFalloff = true;
                        } else {
                            code += "   dAtten = getFalloffInvSquared(light" + i + "_radius);\n";
                            usesInvSquaredFalloff = true;
                        }
                    } else {
                        // non punctual lights only gets the range window here
                        code += "   dAtten = getFalloffWindow(light" + i + "_radius);\n";
                        usesInvSquaredFalloff = true;
                    }

                    code += "   if (dAtten > 0.00001) {\n"; // BRANCH START

                    if (lightType === LIGHTTYPE_SPOT) {
                        if (!(usesCookieNow && !light._cookieFalloff)) {
                            code += "       dAtten *= getSpotEffect(light" + i + "_direction, light" + i + "_innerConeAngle, light" + i + "_outerConeAngle);\n";
                            usesSpot = true;
                        }
                    }
                }

                // diffuse lighting - LTC lights do not mix diffuse lighting into attenuation that affects specular
                if (lightShape !== LIGHTSHAPE_PUNCTUAL) {
                    if (lightType === LIGHTTYPE_DIRECTIONAL) {
                        // NB: A better aproximation perhaps using wrap lighting could be implemented here
                        code += "       dAttenD = getLightDiffuse();\n";
                    } else {
                        // 16.0 is a constant that is in getFalloffInvSquared()
                        code += "       dAttenD = get" + shapeString + "LightDiffuse() * 16.0;\n";
                    }
                } else {
                    code += "       dAtten *= getLightDiffuse();\n";
                }

                if (light.castShadows && !options.noShadow) {
                    var shadowReadMode = null;
                    var evsmExp;
                    if (light._shadowType === SHADOW_VSM8) {
                        shadowReadMode = "VSM8";
                        evsmExp = "0.0";
                    } else if (light._shadowType === SHADOW_VSM16) {
                        shadowReadMode = "VSM16";
                        evsmExp = "5.54";
                    } else if (light._shadowType === SHADOW_VSM32) {
                        shadowReadMode = "VSM32";
                        if (device.textureFloatHighPrecision) {
                            evsmExp = "15.0";
                        } else {
                            evsmExp = "5.54";
                        }
                    } else if (light._shadowType === SHADOW_PCF5) {
                        shadowReadMode = "PCF5x5";
                    } else {
                        shadowReadMode = "PCF3x3";
                    }

                    if (shadowReadMode !== null) {
                        if (lightType === LIGHTTYPE_OMNI) {
                            shadowCoordArgs = "(light" + i + "_shadowMap, light" + i + "_shadowParams);\n";
                            if (light._normalOffsetBias) {
                                code += "       normalOffsetPointShadow(light" + i + "_shadowParams);\n";
                            }
                            code += "       dAtten *= getShadowPoint" + shadowReadMode + shadowCoordArgs;
                        } else {
                            const shadowMatArg = `light${i}_shadowMatrix`;
                            const shadowParamArg = `light${i}_shadowParams`;
                            code += this._nonPointShadowMapProjection(device, options.lights[i], shadowMatArg, shadowParamArg, i);

                            if (lightType === LIGHTTYPE_SPOT) shadowReadMode = "Spot" + shadowReadMode;
                            code += "       dAtten *= getShadow" + shadowReadMode + "(light" + i + "_shadowMap, light" + i + "_shadowParams" + (light._isVsm ? ", " + evsmExp : "") + ");\n";
                        }
                    }
                }

                // non-punctual lights do not mix diffuse lighting into specular attenuation
                if (lightShape !== LIGHTSHAPE_PUNCTUAL) {
                    if (options.conserveEnergy && options.useSpecular) {
                        code += "       dDiffuseLight += mix((dAttenD * dAtten) * light" + i + "_color" + (usesCookieNow ? " * dAtten3" : "") + ", vec3(0), dLTCSpecFres);\n";
                    } else {
                        code += "       dDiffuseLight += (dAttenD * dAtten) * light" + i + "_color" + (usesCookieNow ? " * dAtten3" : "") + ";\n";
                    }
                } else {
                    if (hasAreaLights && options.conserveEnergy && options.useSpecular) {
                        code += "       dDiffuseLight += mix(dAtten * light" + i + "_color" + (usesCookieNow ? " * dAtten3" : "") + ", vec3(0), dSpecularity);\n";
                    } else {
                        code += "       dDiffuseLight += dAtten * light" + i + "_color" + (usesCookieNow ? " * dAtten3" : "") + ";\n";
                    }
                }

                if (lightShape !== LIGHTSHAPE_PUNCTUAL) {
                    if (options.clearCoat > 0) code += "       ccSpecularLight += ccLTCSpecFres * get" + shapeString + "LightSpecularCC() * dAtten * light" + i + "_color" + (usesCookieNow ? " * dAtten3" : "") + ";\n";
                    if (options.useSpecular) code += "       dSpecularLight += dLTCSpecFres * get" + shapeString + "LightSpecular() * dAtten * light" + i + "_color" + (usesCookieNow ? " * dAtten3" : "") + ";\n";
                } else {
                    if (hasAreaLights) {
                        // if LTC lights are present, specular must be accumulated with specularity (specularity is pre multiplied by punctual light fresnel)
                        if (options.clearCoat > 0) code += "       ccSpecularLight += ccSpecularity * getLightSpecularCC() * dAtten * light" + i + "_color" + (usesCookieNow ? " * dAtten3" : "") + ";\n";
                        if (options.useSpecular) code += "       dSpecularLight += dSpecularity * getLightSpecular() * dAtten * light" + i + "_color" + (usesCookieNow ? " * dAtten3" : "") + ";\n";
                    } else {
                        if (options.clearCoat > 0) code += "       ccSpecularLight += getLightSpecularCC() * dAtten * light" + i + "_color" + (usesCookieNow ? " * dAtten3" : "") + ";\n";
                        if (options.useSpecular) code += "       dSpecularLight += getLightSpecular() * dAtten * light" + i + "_color" + (usesCookieNow ? " * dAtten3" : "") + ";\n";
                    }
                }

                if (lightType !== LIGHTTYPE_DIRECTIONAL) {
                    code += "   }\n"; // BRANCH END
                }

                code += "\n";
            }

            if (hasAreaLights) {
                // specular has to be accumulated differently if we want area lights to look correct
                if (options.clearCoat > 0) {
                    code += "   ccSpecularity = 1.0;\n";
                }
                if (options.useSpecular) {
                    code += "   dSpecularity = vec3(1);\n";
                }
            }

            if ((cubemapReflection || options.sphereMap || options.dpAtlas) && options.refraction) {
                code += "   addRefraction();\n";
            }
        }
        code += "\n";

        if (useAo) {
            if (options.occludeDirect) {
                code += "    applyAO();\n";
            }
            if (options.occludeSpecular) {
                code += "    occludeSpecular();\n";
            }
        }

        if (options.opacityFadesSpecular === false) {
            if (options.blendType === BLEND_NORMAL || options.blendType === BLEND_PREMULTIPLIED) {
                code += "float specLum = dot((dSpecularLight + dReflection.rgb * dReflection.a) * dSpecularity, vec3( 0.2126, 0.7152, 0.0722 ));\n";
                code += "#ifdef CLEARCOAT\n specLum += dot(ccSpecularLight * ccSpecularity + ccReflection.rgb * ccReflection.a * ccSpecularity, vec3( 0.2126, 0.7152, 0.0722 ));\n#endif\n";
                code += "dAlpha = clamp(dAlpha + gammaCorrectInput(specLum), 0.0, 1.0);\n";
            }
            code += "dAlpha *= material_alphaFade;\n";
        }

        code += chunks.endPS;
        if (options.blendType === BLEND_NORMAL || options.blendType === BLEND_ADDITIVEALPHA || options.alphaToCoverage) {
            code += chunks.outputAlphaPS;
        } else if (options.blendType === BLEND_PREMULTIPLIED) {
            code += chunks.outputAlphaPremulPS;
        } else {
            code += chunks.outputAlphaOpaquePS;
        }

        if (options.msdf) {
            code += "   gl_FragColor = applyMsdf(gl_FragColor);\n";
        }

        code += "\n";
        code += end();

        if (hasPointLights) {
            code = chunks.lightDirPointPS + code;
        }
        if (usesLinearFalloff) {
            code = chunks.falloffLinearPS + code;
        }
        if (usesInvSquaredFalloff) {
            code = chunks.falloffInvSquaredPS + code;
        }
        if (usesSpot) {
            code = chunks.spotPS + code;
        }
        if (usesCookie) {
            code = chunks.cookiePS + code;
        }
        var structCode = "";
        if (code.includes("dReflection")) structCode += "vec4 dReflection;\n";
        if (code.includes("dTBN")) structCode += "mat3 dTBN;\n";
        if (code.includes("dAlbedo")) structCode += "vec3 dAlbedo;\n";
        if (code.includes("dEmission")) structCode += "vec3 dEmission;\n";
        if (code.includes("dNormalW")) structCode += "vec3 dNormalW;\n";
        if (code.includes("dVertexNormalW")) structCode += "vec3 dVertexNormalW;\n";
        if (code.includes("dTangentW")) structCode += "vec3 dTangentW;\n";
        if (code.includes("dBinormalW")) structCode += "vec3 dBinormalW;\n";
        if (code.includes("dViewDirW")) structCode += "vec3 dViewDirW;\n";
        if (code.includes("dReflDirW")) structCode += "vec3 dReflDirW;\n";
        if (code.includes("dDiffuseLight")) structCode += "vec3 dDiffuseLight;\n";
        if (code.includes("dSpecularLight")) structCode += "vec3 dSpecularLight;\n";
        if (code.includes("dLightDirNormW")) structCode += "vec3 dLightDirNormW;\n";
        if (code.includes("dLightDirW")) structCode += "vec3 dLightDirW;\n";
        if (code.includes("dLightPosW")) structCode += "vec3 dLightPosW;\n";
        if (code.includes("dShadowCoord")) structCode += "vec3 dShadowCoord;\n";
        if (code.includes("dNormalMap")) structCode += "vec3 dNormalMap;\n";
        if (code.includes("dSpecularity")) structCode += "vec3 dSpecularity;\n";
        if (code.includes("dSpecularityNoFres")) structCode += "vec3 dSpecularityNoFres;\n";
        if (code.includes("dUvOffset")) structCode += "vec2 dUvOffset;\n";
        if (code.includes("dGlossiness")) structCode += "float dGlossiness;\n";
        if (code.includes("dAlpha")) structCode += "float dAlpha;\n";
        if (code.includes("dAtten")) structCode += "float dAtten;\n";
        if (code.includes("dAttenD")) structCode += "float dAttenD;\n"; // separate diffuse attenuation for non-punctual light sources
        if (code.includes("dAtten3")) structCode += "vec3 dAtten3;\n";
        if (code.includes("dAo")) structCode += "float dAo;\n";
        if (code.includes("dMsdf")) structCode += "vec4 dMsdf;\n";
        if (code.includes("ccReflection")) structCode += "vec4 ccReflection;\n";
        if (code.includes("ccNormalW")) structCode += "vec3 ccNormalW;\n";
        if (code.includes("ccReflDirW")) structCode += "vec3 ccReflDirW;\n";
        if (code.includes("ccSpecularLight")) structCode += "vec3 ccSpecularLight;\n";
        if (code.includes("ccSpecularity")) structCode += "float ccSpecularity;\n";
        if (code.includes("ccSpecularityNoFres")) structCode += "float ccSpecularityNoFres;\n";
        if (code.includes("ccGlossiness")) structCode += "float ccGlossiness;\n";

        code = codeBegin + structCode + code;

        fshader = code;

        return {
            attributes: attributes,
            vshader: vshader,
            fshader: fshader,
            tag: SHADERTAG_MATERIAL
        };
    }
};

export { _matTex2D, standard };
