import { hashCode } from '../../../core/hash.js';

import {
    SEMANTIC_ATTR8, SEMANTIC_ATTR9, SEMANTIC_ATTR10, SEMANTIC_ATTR11, SEMANTIC_ATTR12, SEMANTIC_ATTR13, SEMANTIC_ATTR14, SEMANTIC_ATTR15,
    SEMANTIC_BLENDINDICES, SEMANTIC_BLENDWEIGHT, SEMANTIC_COLOR, SEMANTIC_NORMAL, SEMANTIC_POSITION, SEMANTIC_TANGENT,
    SEMANTIC_TEXCOORD0, SEMANTIC_TEXCOORD1,
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
    SPRITE_RENDERMODE_SLICED, SPRITE_RENDERMODE_TILED, shadowTypeToString
} from '../../../scene/constants.js';
import { LightsBuffer } from '../../../scene/lighting/lights-buffer.js';

import { begin, end, fogCode, gammaCode, precisionCode, skinCode, tonemapCode, versionCode } from './common.js';

/** @typedef {import('../../graphics-device.js').GraphicsDevice} GraphicsDevice */

const _matTex2D = [];

const decodeTable = {
    'rgbm': 'decodeRGBM',
    'rgbe': 'decodeRGBE',
    'linear': 'decodeLinear'
};

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

    _correctChannel: function (p, chan) {
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

    _setMapTransform: function (codes, name, id, uv) {
        const varName = `texture_${name}MapTransform`;
        const checkId = id + uv * 100;

        // upload a 3x2 matrix and manually perform the multiplication
        codes[0] += `uniform vec3 ${varName}0;\n`;
        codes[0] += `uniform vec3 ${varName}1;\n`;
        if (!codes[3][checkId]) {
            codes[1] += `varying vec2 vUV${uv}_${id};\n`;
            codes[2] += `   vUV${uv}_${id} = vec2(dot(vec3(uv${uv}, 1), ${varName}0), dot(vec3(uv${uv}, 1), ${varName}1));\n`;
            codes[3][checkId] = true;
        }
        return codes;
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
        let s = "\n#undef " + name + "\n";
        if (enabled) s += " #define " + name + "\n";
        return s;
    },

    _addMapDefs: function (float, color, vertex, map) {
        let s = "";
        s += this._addMapDef("MAPFLOAT", float);
        s += this._addMapDef("MAPCOLOR", color);
        s += this._addMapDef("MAPVERTEX", vertex);
        s += this._addMapDef("MAPTEXTURE", map);
        return s;
    },

    /**
     * Add chunk for Map Types (used for all maps except Normal).
     *
     * @param {string} propName - The base name of the map: diffuse | emissive | opacity | light | height | metalness | specular | gloss | ao.
     * @param {string} chunkName - The name of the chunk to use. Usually "basenamePS".
     * @param {object} options - The options passed into to createShaderDefinition.
     * @param {object} chunks - The set of shader chunks to choose from.
     * @param {string} samplerFormat - Format of texture sampler to use - 0: "texture2DSRGB", 1: "texture2DRGBM", 2: "texture2D".
     * @returns {string} The shader code to support this map.
     * @private
     */
    _addMap: function (propName, chunkName, options, chunks, samplerFormat) {
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

            if (samplerFormat !== undefined) {
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

    // handles directional map shadow coordinate generation, including cascaded shadows
    _directionalShadowMapProjection: function (light, shadowCoordArgs, shadowParamArg, lightIndex, coordsFunctionName) {

        // for shadow cascades
        let code = "";
        if (light.numCascades > 1) {
            // compute which cascade matrix needs to be used
            code += `getShadowCascadeMatrix(light${lightIndex}_shadowMatrixPalette, light${lightIndex}_shadowCascadeDistances, light${lightIndex}_shadowCascadeCount);\n`;
            shadowCoordArgs = `(cascadeShadowMat, ${shadowParamArg});\n`;
        }

        // shadow coordinate generation
        code += coordsFunctionName + shadowCoordArgs;

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

    _getPassDefineString: function (pass) {
        if (pass === SHADER_PICK) {
            return '#define PICK_PASS\n';
        } else if (pass === SHADER_DEPTH) {
            return '#define DEPTH_PASS\n';
        } else if (pass >= SHADER_SHADOW && pass <= 17) {
            return '#define SHADOW_PASS\n';
        }
        return '';
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
     * Add "Base" Code section to fragment shader.
     *
     * @param {string} code - Current fragment shader code.
     * @param {GraphicsDevice} device - The graphics device.
     * @param {object} chunks - All available shader chunks.
     * @param {object} options - The Shader Definition options.
     * @returns {string} The new fragment shader code (old+new).
     * @private
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

    _decodeFunc: function (textureFormat) {
        return decodeTable[textureFormat] || 'decodeGamma';
    },

    /**
     * Add "Start" Code section to fragment shader.
     *
     * @param {string} code -  Current fragment shader code.
     * @param {GraphicsDevice} device - The graphics device.
     * @param {object} chunks - All available shader chunks.
     * @param {object} options - The Shader Definition options.
     * @returns {string} The new fragment shader code (old+new).
     * @private
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

    _buildShadowPassFragmentCode: function (code, device, chunks, options, varyings) {

        const smode = options.pass - SHADER_SHADOW;
        const numShadowModes = SHADOW_COUNT;
        const lightType = Math.floor(smode / numShadowModes);
        const shadowType = smode - lightType * numShadowModes;

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

        const isVsm = shadowType === SHADOW_VSM8 || shadowType === SHADOW_VSM16 || shadowType === SHADOW_VSM32;

        if (lightType === LIGHTTYPE_OMNI || (isVsm && lightType !== LIGHTTYPE_DIRECTIONAL)) {
            code += "   float depth = min(distance(view_position, vPositionW) / light_radius, 0.99999);\n";
        } else {
            code += "   float depth = gl_FragCoord.z;\n";
        }

        if (shadowType === SHADOW_PCF3 && (!device.webgl2 || (lightType === LIGHTTYPE_OMNI && !options.clusteredLightingEnabled))) {
            if (device.extStandardDerivatives && !device.webgl2) {
                code += "   float minValue = 2.3374370500153186e-10; //(1.0 / 255.0) / (256.0 * 256.0 * 256.0);\n";
                code += "   depth += polygonOffset.x * max(abs(dFdx(depth)), abs(dFdy(depth))) + minValue * polygonOffset.y;\n";
                code += "   gl_FragColor = packFloat(depth);\n";
            } else {
                code += "   gl_FragColor = packFloat(depth);\n";
            }
        } else if (shadowType === SHADOW_PCF3 || shadowType === SHADOW_PCF5) {
            code += "   gl_FragColor = vec4(1.0);\n"; // just the simplest code, color is not written anyway

            // clustered omni light is using shadow sampler and needs to write custom depth
            if (options.clusteredLightingEnabled && lightType === LIGHTTYPE_OMNI && device.webgl2) {
                code += "   gl_FragDepth = depth;\n";
            }
        } else if (shadowType === SHADOW_VSM8) {
            code += "   gl_FragColor = vec4(encodeFloatRG(depth), encodeFloatRG(depth*depth));\n";
        } else {
            code += chunks.storeEVSMPS;
        }

        code += end();

        return code;
    },

    /** @type { Function } */
    createShaderDefinition: function (device, options) {
        let lighting = options.lights.length > 0;

        if (options.dirLightMap) {
            lighting = true;
        }

        if (options.clusteredLightingEnabled) {
            lighting = true;
        }

        if (options.shadingModel === SPECULAR_PHONG) {
            options.fresnelModel = 0;
            options.specularAntialias = false;
            options.ambientSH = false;
        } else {
            options.fresnelModel = (options.fresnelModel === 0) ? FRESNEL_SCHLICK : options.fresnelModel;
        }

        const reflections = !!options.reflectionSource;
        if (!options.useSpecular) options.specularMap = options.glossMap = null;
        const shadowPass = options.pass >= SHADER_SHADOW && options.pass <= 17;
        const needsNormal = lighting || reflections || options.ambientSH || options.heightMap || options.enableGGXSpecular ||
                            (options.clusteredLightingEnabled && !shadowPass) || options.clearCoatNormalMap;

        this.options = options;

        // GENERATE VERTEX SHADER
        let code = '';
        let codeBody = '';

        let varyings = ""; // additional varyings for map transforms

        let chunks = shaderChunks;

        let shadowCoordArgs;
        let chunk;

        const attributes = {
            vertex_position: SEMANTIC_POSITION
        };

        if (options.chunks) {
            const customChunks = {};

            for (const p in chunks) {
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

            chunks = customChunks;
        }

        code += this._getPassDefineString(options.pass);

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
            attributes.instance_line1 = SEMANTIC_ATTR12;
            attributes.instance_line2 = SEMANTIC_ATTR13;
            attributes.instance_line3 = SEMANTIC_ATTR14;
            attributes.instance_line4 = SEMANTIC_ATTR15;
            code += chunks.instancingVS;
        }

        if (needsNormal) {
            attributes.vertex_normal = SEMANTIC_NORMAL;
            codeBody += "   vNormalW = getNormal();\n";

            if (options.reflectionSource === 'sphereMap' && device.fragmentUniformsCount <= 16) {
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

        const useUv = [];
        const useUnmodifiedUv = [];
        const maxUvSets = 2;

        for (const p in _matTex2D) {
            const mname = p + "Map";
            if (options[p + "VertexColor"]) {
                const cname = p + "VertexColorChannel";
                options[cname] = this._correctChannel(p, options[cname]);
            }
            if (options[mname]) {
                const cname = mname + "Channel";
                const tname = mname + "Transform";
                const uname = mname + "Uv";
                options[uname] = Math.min(options[uname], maxUvSets - 1);
                options[cname] = this._correctChannel(p, options[cname]);
                const uvSet = options[uname];
                useUv[uvSet] = true;
                useUnmodifiedUv[uvSet] = useUnmodifiedUv[uvSet] || (options[mname] && !options[tname]);
            }
        }

        if (options.forceUv1) {
            useUv[1] = true;
            useUnmodifiedUv[1] = (useUnmodifiedUv[1] !== undefined) ? useUnmodifiedUv[1] : true;
        }

        for (let i = 0; i < maxUvSets; i++) {
            if (useUv[i]) {
                attributes["vertex_texCoord" + i] = "TEXCOORD" + i;
                code += chunks["uv" + i + "VS"];
                codeBody += "   vec2 uv" + i + " = getUv" + i + "();\n";
            }
            if (useUnmodifiedUv[i]) {
                codeBody += "   vUv" + i + " = uv" + i + ";\n";
            }
        }

        const codes = [code, varyings, codeBody, []];

        for (const p in _matTex2D) {
            const mname = p + "Map";
            if (options[mname]) {
                const tname = mname + "Transform";
                if (options[tname]) {
                    const uname = mname + "Uv";
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

        let vshader = code;

        const oldVars = varyings;
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

        let startCode = "";
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

        let fshader;
        code = '';

        if (device.webgl2) {
            code += versionCode(device);
        }

        if (!device.webgl2) {
            if (device.extStandardDerivatives) {
                code += "#extension GL_OES_standard_derivatives : enable\n";
            }
            if (device.extTextureLod) {
                code += "#extension GL_EXT_shader_texture_lod : enable\n";
                code += "#define SUPPORTS_TEXLOD\n";
            }
        }
        if (chunks.extensionPS) {
            code += chunks.extensionPS + "\n";
        }

        if (device.webgl2) {
            code += chunks.gles3PS;
        }

        code += options.forceFragmentPrecision ? "precision " + options.forceFragmentPrecision + " float;\n\n" : precisionCode(device);

        code += this._getPassDefineString(options.pass);

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
            return {
                attributes: attributes,
                vshader: vshader,
                fshader: this._buildShadowPassFragmentCode(code, device, chunks, options, varyings)
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

        const codeBegin = code;
        code = "";

        if (options.clearCoat > 0) {
            code += '#define CLEARCOAT\n';

            // enable clear-coat path in clustered chunk
            code += "#define CLUSTER_CLEAR_COAT\n";
        }

        if (options.opacityFadesSpecular === false) {
            code += 'uniform float material_alphaFade;\n';
        }

        // FRAGMENT SHADER INPUTS: UNIFORMS
        let numShadowLights = 0;
        const shadowTypeUsed = [];
        let shadowedDirectionalLightUsed = false;
        let useVsm = false;
        let usePerspZbufferShadow = false;

        let hasAreaLights = options.lights.some(function (light) {
            return light._shape && light._shape !== LIGHTSHAPE_PUNCTUAL;
        });

        // if clustered lighting has area lights enabled, it always runs in 'area lights mode'
        // TODO: maybe we should always use it and remove the other way?
        if (options.clusteredLightingEnabled && options.clusteredLightingAreaLightsEnabled) {
            hasAreaLights = true;
        }

        if (device.areaLightLutFormat === PIXELFORMAT_R8_G8_B8_A8) {
            // use offset and scale for rgb8 format luts
            code += "#define AREA_R8_G8_B8_A8_LUTS\n";
            code += "#define AREA_LUTS_PRECISION lowp\n";
        } else {
            code += "#define AREA_LUTS_PRECISION highp\n";
        }

        if (hasAreaLights || options.clusteredLightingEnabled) {
            code += "#define AREA_LIGHTS\n";
            code += "uniform AREA_LUTS_PRECISION sampler2D areaLightsLutTex1;\n";
            code += "uniform AREA_LUTS_PRECISION sampler2D areaLightsLutTex2;\n";
        }

        for (let i = 0; i < options.lights.length; i++) {
            const light = options.lights[i];
            const lightType = light._type;

            // skip uniform generation for local lights if clustered lighting is enabled
            if (options.clusteredLightingEnabled && lightType !== LIGHTTYPE_DIRECTIONAL)
                continue;

            const lightShape = (hasAreaLights && light._shape) ? light._shape : LIGHTSHAPE_PUNCTUAL;

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


        let tbn;
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
                // TODO: let each normalmap input (normalMap, normalDetailMap, clearCoatNormalMap) independently decide which unpackNormal to use.
                code += options.packedNormal ? chunks.normalXYPS : chunks.normalXYZPS;

                if (!options.hasTangents) {
                    // TODO: generalize to support each normalmap input (normalMap, normalDetailMap, clearCoatNormalMap) independently
                    const baseName = options.normalMap ? "normalMap" : "clearCoatNormalMap";
                    const uv = this._getUvSourceExpression(`${baseName}Transform`, `${baseName}Uv`, options);
                    tbn = tbn.replace(/\$UV/g, uv);
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

                const transformedNormalMapUv = this._getUvSourceExpression("normalMapTransform", "normalMapUv", options);
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

        // FIXME: only add decode when needed
        code += chunks.decodePS;

        if (options.useRgbm) code += chunks.rgbmPS;

        if (options.useCubeMapRotation) {
            code += "#define CUBEMAP_ROTATION\n";
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

            const specularPropName = options.useMetalness ? "metalness" : "specular";
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
                const transformedHeightMapUv = this._getUvSourceExpression("heightMapTransform", "heightMapUv", options);
                if (!options.hasTangents) tbn = tbn.replace(/\$UV/g, transformedHeightMapUv);
                code += tbn;
            }
            code += this._addMap("height", "parallaxPS", options, chunks);
        }

        const useAo = options.aoMap || options.aoVertexColor;
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

        if (options.reflectionSource === 'envAtlas') {
            code += chunks.reflectionEnvPS.replace(/\$DECODE/g, this._decodeFunc(options.reflectionEncoding));
        } else if (options.reflectionSource === 'cubeMap') {
            code += options.fixSeams ? chunks.fixCubemapSeamsStretchPS : chunks.fixCubemapSeamsNonePS;
            code += chunks.reflectionCubePS.replace(/\$DECODE/g, this._decodeFunc(options.reflectionEncoding));
        } else if (options.reflectionSource === 'sphereMap') {
            const scode = device.fragmentUniformsCount > 16 ? chunks.reflectionSpherePS : chunks.reflectionSphereLowPS;
            code += scode.replace(/\$DECODE/g, this._decodeFunc(options.reflectionEncoding));
        }

        if (reflections) {
            if (options.clearCoat > 0) {
                code += chunks.reflectionCCPS;
            }
            if (options.refraction) {
                code += chunks.refractionPS;
            }
        }

        // clustered lighting
        if (options.clusteredLightingEnabled) {

            // include this before shadow / cookie code
            code += chunks.clusteredLightUtilsPS;
            code += chunks.clusteredLightCookiesPS;

            // always include shadow chunks clustered lights support
            shadowTypeUsed[SHADOW_PCF3] = true;
            shadowTypeUsed[SHADOW_PCF5] = true;
            usePerspZbufferShadow = true;
        }

        if (numShadowLights > 0 || options.clusteredLightingEnabled) {
            if (shadowedDirectionalLightUsed) {
                code += chunks.shadowCascadesPS;
            }
            if (shadowTypeUsed[SHADOW_PCF3]) {
                code += chunks.shadowStandardPS;
            }
            if (shadowTypeUsed[SHADOW_PCF5] && device.webgl2) {
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
            if (hasAreaLights || options.clusteredLightingEnabled) code += chunks.ltc;
        }

        code += '\n';

        let useOldAmbient = false;
        if (options.useSpecular) {

            // enable specular path in clustered chunk
            code += "#define CLUSTER_SPECULAR\n";

            // enable conserve energy path in clustered chunk
            if (options.conserveEnergy) {
                code += "#define CLUSTER_CONSERVE_ENERGY\n";
            }

            if (lighting) {
                code += options.shadingModel === SPECULAR_PHONG ? chunks.lightSpecularPhongPS : (options.enableGGXSpecular ? chunks.lightSpecularAnisoGGXPS : chunks.lightSpecularBlinnPS);
            }

            if (options.fresnelModel > 0) {
                if (options.conserveEnergy && !hasAreaLights) {
                    // NB if there are area lights, energy conservation is done differently
                    code += chunks.combineDiffuseSpecularPS; // this one is correct, others are old stuff
                } else {
                    code += chunks.combineDiffuseSpecularNoConservePS; // if you don't use environment cubemaps, you may consider this
                }
            } else if (reflections) {
                code += chunks.combineDiffuseSpecularOldPS;
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

        let addAmbient = true;
        if (options.lightMap || options.lightVertexColor) {
            const lightmapChunkPropName = (options.dirLightMap && options.useSpecular) ? 'lightmapDirPS' : 'lightmapSinglePS';
            code += this._addMap("light", lightmapChunkPropName, options, chunks, options.lightMapFormat);
            addAmbient = options.lightMapWithoutAmbient;
        }

        if (addAmbient) {
            if (options.ambientSource === 'ambientSH') {
                code += chunks.ambientSHPS;
            } else if (options.ambientSource === 'envAtlas') {
                code += chunks.ambientEnvPS.replace(/\$DECODE/g, this._decodeFunc(options.ambientEncoding));
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

        let hasPointLights = false;
        let usesLinearFalloff = false;
        let usesInvSquaredFalloff = false;
        let usesSpot = false;
        let usesCookie = false;
        let usesCookieNow;

        // clustered lighting
        if (options.clusteredLightingEnabled && lighting) {

            usesSpot = true;
            hasPointLights = true;
            usesLinearFalloff = true;
            usesCookie = true;

            code += chunks.floatUnpackingPS;

            if (options.lightMaskDynamic)
                code += "\n#define CLUSTER_MESH_DYNAMIC_LIGHTS";

            if (options.clusteredLightingCookiesEnabled)
                code += "\n#define CLUSTER_COOKIES";
            if (options.clusteredLightingShadowsEnabled && !options.noShadow) {
                code += "\n#define CLUSTER_SHADOWS";
                code += "\n#define CLUSTER_SHADOW_TYPE_" + shadowTypeToString[options.clusteredLightingShadowType];
            }

            if (options.clusteredLightingAreaLightsEnabled)
                code += "\n#define CLUSTER_AREALIGHTS";

            code += LightsBuffer.shaderDefines;
            code += chunks.clusteredLightShadowsPS;
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

        let opacityParallax = false;
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

        let getGlossinessCalled = false;

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
                if (lighting && options.enableGGXSpecular) {
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

            // move ambient color out of diffuse (used by Lightmapper, to multiply ambient color by accumulated AO)
            if (options.separateAmbient) {
                code += `
                    vec3 dAmbientLight = dDiffuseLight;
                    dDiffuseLight = vec3(0);
                `;
            }
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
            if (reflections) {
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

                // evaluate material based area lights data, shared by all area lights
                code += "   calcLTCLightValues();\n";
            }

            for (let i = 0; i < options.lights.length; i++) {
                const light = options.lights[i];
                const lightType = light._type;

                // if clustered lights are used, skip normal lights other than directional
                if (options.clusteredLightingEnabled && lightType !== LIGHTTYPE_DIRECTIONAL) {
                    continue;
                }

                // The following code is not decoupled to separate shader files, because most of it can be actually changed to achieve different behaviors like:
                // - different falloffs
                // - different shadow coords (omni shadows will use drastically different genShadowCoord)
                // - different shadow filter modes
                // - different light source shapes

                // getLightDiffuse and getLightSpecular is BRDF itself.

                usesCookieNow = false;

                const lightShape = (hasAreaLights && light._shape) ? light.shape : LIGHTSHAPE_PUNCTUAL;
                const shapeString = (hasAreaLights && light._shape) ? this._getLightSourceShapeString(lightShape) : '';

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
                    let shadowReadMode = null;
                    let evsmExp;
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

                if (lightShape !== LIGHTSHAPE_PUNCTUAL) {

                    // area light - they do not mix diffuse lighting into specular attenuation
                    if (options.conserveEnergy && options.useSpecular) {
                        code += "       dDiffuseLight += mix((dAttenD * dAtten) * light" + i + "_color" + (usesCookieNow ? " * dAtten3" : "") + ", vec3(0), dLTCSpecFres);\n";
                    } else {
                        code += "       dDiffuseLight += (dAttenD * dAtten) * light" + i + "_color" + (usesCookieNow ? " * dAtten3" : "") + ";\n";
                    }
                } else {

                    // punctual light
                    if (hasAreaLights && options.conserveEnergy && options.useSpecular) {
                        code += "       dDiffuseLight += mix(dAtten * light" + i + "_color" + (usesCookieNow ? " * dAtten3" : "") + ", vec3(0), dSpecularity);\n";
                    } else {
                        code += "       dDiffuseLight += dAtten * light" + i + "_color" + (usesCookieNow ? " * dAtten3" : "") + ";\n";
                    }
                }

                // specular / clear coat
                if (lightShape !== LIGHTSHAPE_PUNCTUAL) {

                    // area light
                    if (options.clearCoat > 0) code += "       ccSpecularLight += ccLTCSpecFres * get" + shapeString + "LightSpecularCC() * dAtten * light" + i + "_color" + (usesCookieNow ? " * dAtten3" : "") + ";\n";
                    if (options.useSpecular) code += "       dSpecularLight += dLTCSpecFres * get" + shapeString + "LightSpecular() * dAtten * light" + i + "_color" + (usesCookieNow ? " * dAtten3" : "") + ";\n";

                } else {

                    // punctual light
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

            // clustered lighting
            if (options.clusteredLightingEnabled && lighting) {
                usesLinearFalloff = true;
                usesInvSquaredFalloff = true;
                hasPointLights = true;
                code += '   addClusteredLights();\n';
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

            if (reflections && options.refraction) {
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
        let structCode = "";
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
