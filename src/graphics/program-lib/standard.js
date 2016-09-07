pc.programlib.standard = {
    hashCode: function(str){
        var hash = 0;
        if (str.length === 0) return hash;
        for (var i = 0; i < str.length; i++) {
            var char = str.charCodeAt(i);
            hash = ((hash<<5)-hash)+char;
            hash = hash & hash;
        }
        return hash;
    },

    generateKey: function (device, options) {
        var props = [];
        var key = "standard";
        var light;
        for (var prop in options) {
            if (options.hasOwnProperty(prop)) {
                if (prop==="chunks") {
                    for (var p in options[prop]) {
                        if (options[prop].hasOwnProperty(p)) {
                            props.push(p + options.chunks[p]);
                        }
                    }
                } else {
                    if (options[prop]) props.push(prop);
                }
            }
        }
        props.sort();
        for (prop in props) {
            if (props.hasOwnProperty(prop)) {
                key += props[prop] + options[props[prop]];
            }
        }

        if (options.lights) {
            for (var i=0; i<options.lights.length; i++) {
                light = options.lights[i];
                key += light.key;
            }
        }

        return this.hashCode(key);
    },

    _correctChannel: function(p, chan) {
        if (pc._matTex2D[p] > 0) {
            if (pc._matTex2D[p] < chan.length) {
                return chan.substring(0, pc._matTex2D[p]);
            } else if (pc._matTex2D[p] > chan.length) {
                var str = chan;
                var chr = str.charAt(str.length - 1);
                var addLen = pc._matTex2D[p] - str.length;
                for (var i = 0; i < addLen; i++) str += chr;
                return str;
            }
            return chan;
        }
    },

    _setMapTransform: function (codes, name, id, uv) {
        codes[0] += "uniform vec4 texture_"+name+"MapTransform;\n";

        var checkId = id + uv * 100;
        if (!codes[3][checkId]) {
            codes[1] += "varying vec2 vUV"+uv+"_"+id+";\n";
            codes[2] += "   vUV"+uv+"_"+id+" = uv"+uv+" * texture_"+name+"MapTransform.xy + texture_"+name+"MapTransform.zw;\n";
            codes[3][checkId] = true;
        }
        return codes;
    },

    _uvSource: function(id, uv) {
        return (id === 0) ? "vUv" + uv : ("vUV"+uv+"_" + id);
    },

    _addMap: function(p, options, chunks, uvOffset, subCode, format) {
        var cname, tname, uname;
        var mname = p + "Map";
        var tint;
        if (options[mname + "VertexColor"]) {
            cname = mname + "Channel";
            if (!subCode) {
                tint = options[p + "Tint"];
                if (tint) {
                    if (tint===1) {
                        subCode = chunks[p + "VertConstFloatPS"];
                    } else {
                        subCode = chunks[p + "VertConstPS"];
                    }
                } else {
                    subCode = chunks[p + "VertPS"];
                }
            }
            return subCode.replace(/\$CH/g, options[cname]);
        } else if (options[mname]) {
            tname = mname + "Transform";
            cname = mname + "Channel";
            uname = mname + "Uv";
            var uv = this._uvSource(options[tname], options[uname]) + uvOffset;
            if (!subCode) {
                tint = options[p + "Tint"];
                if (tint) {
                    if (tint===1) {
                        subCode = chunks[p + "TexConstFloatPS"];
                    } else {
                        subCode = chunks[p + "TexConstPS"];
                    }
                } else {
                    subCode = chunks[p + "TexPS"];
                }
            }
            if (format!==undefined) {
                var fmt = format===0? "texture2DSRGB" : (format===1? "texture2DRGBM" : "texture2D");
                subCode = subCode.replace(/\$texture2DSAMPLE/g, fmt);
            }
            return subCode.replace(/\$UV/g, uv).replace(/\$CH/g, options[cname]);
        } else {
            return chunks[p + "ConstPS"];
        }
    },

    _nonPointShadowMapProjection: function(light, shadowCoordArgs) {
        if (!light.getNormalOffsetBias() || light._shadowType > pc.SHADOW_DEPTH) {
            if (light.getType()===pc.LIGHTTYPE_SPOT) {
                return "    getShadowCoordPersp" + shadowCoordArgs;
            } else {
                return "    getShadowCoordOrtho" + shadowCoordArgs;
            }
        } else {
            if (light.getType()==pc.LIGHTTYPE_SPOT) {
                return "    getShadowCoordPerspNormalOffset" + shadowCoordArgs;
            } else {
                return "    getShadowCoordOrthoNormalOffset" + shadowCoordArgs;
            }
        }
    },

    _addVaryingIfNeeded: function(code, type, name) {
        return code.indexOf(name)>=0? ("varying " + type + " " + name + ";\n") : "";
    },

    createShaderDefinition: function (device, options) {
        var i, p;
        var lighting = options.lights.length > 0;

        if (options.dirLightMap) {
            lighting = true;
            options.useSpecular = true;
        }

        if (options.shadingModel===pc.SPECULAR_PHONG) {
            options.fresnelModel = 0;
            options.specularAA = false;
            options.prefilteredCubemap = false;
            options.dpAtlas = false;
            options.ambientSH = false;
        } else {
            options.fresnelModel = (options.fresnelModel===0)? pc.FRESNEL_SCHLICK : options.fresnelModel;
        }

        var cubemapReflection = options.cubeMap || (options.prefilteredCubemap && options.useSpecular);
        var reflections = options.sphereMap || cubemapReflection || options.dpAtlas;
        var useTangents = pc.precalculatedTangents;
        var useTexCubeLod = options.useTexCubeLod;
        if (options.cubeMap || options.prefilteredCubemap) options.sphereMap = null; // cubeMaps have higher priority
        if (options.dpAtlas) options.sphereMap = options.cubeMap = options.prefilteredCubemap = cubemapReflection = null; // dp has even higher priority
        if (!options.useSpecular) options.specularMap = options.glossMap = null;
        var needsNormal = lighting || reflections || options.ambientSH || options.prefilteredCubemap;

        this.options = options;

        ////////////////////////////
        // GENERATE VERTEX SHADER //
        ////////////////////////////
        var code = '';
        var codeBody = '';

        var varyings = ""; // additional varyings for map transforms

        var chunks = pc.shaderChunks;

        var lightType;
        var shadowCoordArgs;

        if (options.chunks) {
            var customChunks = [];
            for (p in chunks) {
                if (chunks.hasOwnProperty(p)) {
                    if (!options.chunks[p]) {
                        customChunks[p] = chunks[p];
                    } else {
                        customChunks[p] = options.chunks[p];
                        if (!needsNormal) {
                            // user might use vertex normal/tangent in shader
                            // but those aren't used when lighting/reflections are off
                            // so this is a workaround
                            customChunks[p] = customChunks[p].replace(/vertex_normal/g, "vec3(0)").replace(/vertex_tangent/g, "vec4(0)");
                        }
                    }
                }
            }
            chunks = customChunks;
        }

        if (chunks.extensionVS) {
        	code += chunks.extensionVS + "\n";
        }

        code += chunks.baseVS;

        // Allow first shadow coords to be computed in VS
        var mainShadowLight = -1;
        if (!options.noShadow) {
            for (i = 0; i < options.lights.length; i++) {
                lightType = options.lights[i].getType();
                if (options.lights[i].getCastShadows()) {
                    if (lightType===pc.LIGHTTYPE_DIRECTIONAL) {
                        code += "uniform mat4 light" + i + "_shadowMatrixVS;\n";
                        code += "uniform vec3 light" + i + "_shadowParamsVS;\n";
                        code += "uniform vec3 light" + i + (lightType===pc.LIGHTTYPE_DIRECTIONAL? "_directionVS" : "_positionVS") + ";\n";
                        mainShadowLight = i;
                        break;
                    }
                }
            }
            if (mainShadowLight >= 0) {
                code += chunks.shadowCoordVS;
            }
        }

        var attributes = {
            vertex_position: pc.SEMANTIC_POSITION
        };
        codeBody += "   vPositionW    = getWorldPosition();\n";

        if (options.useInstancing) {
            attributes.instance_line1 = pc.SEMANTIC_TEXCOORD2;
            attributes.instance_line2 = pc.SEMANTIC_TEXCOORD3;
            attributes.instance_line3 = pc.SEMANTIC_TEXCOORD4;
            attributes.instance_line4 = pc.SEMANTIC_TEXCOORD5;
            code += chunks.instancingVS;
        }

        if (needsNormal) {
            attributes.vertex_normal = pc.SEMANTIC_NORMAL;
            codeBody += "   vNormalW    = dNormalW = getNormal();\n";

            if ((options.sphereMap) && (device.fragmentUniformsCount <= 16)) {
                code += chunks.viewNormalVS;
                codeBody += "   vNormalV    = getViewNormal();\n";
            }

            if ((options.heightMap || options.normalMap) && useTangents) {
                attributes.vertex_tangent = pc.SEMANTIC_TANGENT;
                code += chunks.tangentBinormalVS;
                codeBody += "   vTangentW   = getTangent();\n";
                codeBody += "   vBinormalW  = getBinormal();\n";
            }

            if (mainShadowLight >= 0) {
                lightType = options.lights[mainShadowLight].getType();
                if (lightType===pc.LIGHTTYPE_DIRECTIONAL) {
                    codeBody += "   dLightDirNormW = light"+mainShadowLight+"_directionVS;\n";
                } else {
                    codeBody += "   getLightDirPoint(light"+mainShadowLight+"_positionVS);\n";
                }
                shadowCoordArgs = "(light"+mainShadowLight+"_shadowMatrixVS, light"+mainShadowLight+"_shadowParamsVS);\n";
                codeBody += this._nonPointShadowMapProjection(options.lights[mainShadowLight], shadowCoordArgs);
            }
        }

        var useUv = [];
        var useUnmodifiedUv = [];
        var maxUvSets = 2;
        var cname, mname, tname, uname;

        for (p in pc._matTex2D) {
            mname = p + "Map";
            if (options[mname + "VertexColor"]) {
                cname = mname + "Channel";
                options[cname] = this._correctChannel(p, options[cname]);
            } else if (options[mname]) {
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

        if (options.forceUv1) useUv[1] = true;

        for (i = 0; i < maxUvSets; i++) {
            if (useUv[i]) {
                attributes["vertex_texCoord" + i] = pc["SEMANTIC_TEXCOORD" + i];
                code += chunks["uv" + i + "VS"];
                codeBody += "   vec2 uv" + i + " = getUv" + i + "();\n";
            }
            if (useUnmodifiedUv[i]) {
                codeBody += "   vUv" + i + " = uv" + i + ";\n";
            }
        }

        var codes = [code, varyings, codeBody, []];

        for (p in pc._matTex2D) {
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
            attributes.vertex_color = pc.SEMANTIC_COLOR;
            codeBody += "   vVertexColor = vertex_color;\n";
        }

        if (options.screenSpace) {
            code += chunks.transformScreenSpaceVS;
            if (needsNormal) code += chunks.normalVS;
        } else if (options.skin) {
            attributes.vertex_boneWeights = pc.SEMANTIC_BLENDWEIGHT;
            attributes.vertex_boneIndices = pc.SEMANTIC_BLENDINDICES;
            code += pc.programlib.skinCode(device);
            code += chunks.transformSkinnedVS;
            if (needsNormal) code += chunks.normalSkinnedVS;
        } else if (options.useInstancing) {
            code += chunks.transformInstancedVS;
            if (needsNormal) code += chunks.normalInstancedVS;
        } else {
            code += chunks.transformVS;
            if (needsNormal) code += chunks.normalVS;
        }

        code += "\n";

        code += chunks.startVS;
        code += codeBody;
        code += "}";

        var vshader = code;

        var oldVars = varyings;
        varyings = "";
        varyings += this._addVaryingIfNeeded(code, "vec4", "vMainShadowUv");
        varyings += this._addVaryingIfNeeded(code, "vec4", "vVertexColor");
        varyings += this._addVaryingIfNeeded(code, "vec3", "vPositionW");
        varyings += this._addVaryingIfNeeded(code, "vec3", "vNormalV");
        varyings += this._addVaryingIfNeeded(code, "vec3", "vNormalW");
        varyings += this._addVaryingIfNeeded(code, "vec3", "vTangentW");
        varyings += this._addVaryingIfNeeded(code, "vec3", "vBinormalW");
        varyings += this._addVaryingIfNeeded(code, "vec2", "vUv0");
        varyings += this._addVaryingIfNeeded(code, "vec2", "vUv1");
        varyings += oldVars;
        vshader = varyings + vshader;

        //////////////////////////////
        // GENERATE FRAGMENT SHADER //
        //////////////////////////////
        if (options.forceFragmentPrecision && options.forceFragmentPrecision!="highp" &&
            options.forceFragmentPrecision !== "mediump" && options.forceFragmentPrecision !== "lowp")
            options.forceFragmentPrecision = null;

        if (options.forceFragmentPrecision) {
            if (options.forceFragmentPrecision === "highp" && device.maxPrecision !== "highp") options.forceFragmentPrecision = "mediump";
            if (options.forceFragmentPrecision === "mediump" && device.maxPrecision === "lowp") options.forceFragmentPrecision = "lowp";
        }

        var fshader;
        code = '';
        if (device.extStandardDerivatives) {
            code += "#extension GL_OES_standard_derivatives : enable\n\n";
        }
        if (chunks.extensionPS) {
        	code += chunks.extensionPS + "\n";
        }
        code += options.forceFragmentPrecision? "precision " + options.forceFragmentPrecision + " float;\n\n" : pc.programlib.precisionCode(device);

        if (options.customFragmentShader) {
            fshader = code + options.customFragmentShader;
            return {
                attributes: attributes,
                vshader: vshader,
                fshader: fshader,
                tag: pc.SHADERTAG_MATERIAL
            };
        }

        code += varyings;
        code += chunks.basePS;

        var codeBegin = code;
        code = "";

        // FRAGMENT SHADER INPUTS: UNIFORMS
        var numShadowLights = 0;
        var shadowTypeUsed = [];
        var useVsm = false;
        var light;
        for (i = 0; i < options.lights.length; i++) {
            light = options.lights[i];
            lightType = light.getType();
            code += "uniform vec3 light" + i + "_color;\n";
            if (lightType===pc.LIGHTTYPE_DIRECTIONAL) {
                code += "uniform vec3 light" + i + "_direction;\n";
            } else {
                code += "uniform vec3 light" + i + "_position;\n";
                code += "uniform float light" + i + "_radius;\n";
                if (lightType===pc.LIGHTTYPE_SPOT) {
                    code += "uniform vec3 light" + i + "_direction;\n";
                    code += "uniform float light" + i + "_innerConeAngle;\n";
                    code += "uniform float light" + i + "_outerConeAngle;\n";
                }
            }
            if (light.getCastShadows() && !options.noShadow) {
                code += "uniform mat4 light" + i + "_shadowMatrix;\n";
                if (lightType!==pc.LIGHTTYPE_DIRECTIONAL) {
                    code += "uniform vec4 light" + i + "_shadowParams;\n"; // Width, height, bias, radius
                } else {
                    code += "uniform vec3 light" + i + "_shadowParams;\n"; // Width, height, bias
                }
                if (lightType===pc.LIGHTTYPE_POINT) {
                    code += "uniform samplerCube light" + i + "_shadowMap;\n";
                } else {
                    code += "uniform sampler2D light" + i + "_shadowMap;\n";
                }
                numShadowLights++;
                shadowTypeUsed[light._shadowType] = true;
                if (light._shadowType > pc.SHADOW_DEPTH) useVsm = true;
            }
            if (light._cookie) {
                if (light._cookie._cubemap) {
                    if (lightType===pc.LIGHTTYPE_POINT) {
                        code += "uniform samplerCube light" + i + "_cookie;\n";
                        code += "uniform float light" + i + "_cookieIntensity;\n";
                        if (!light.getCastShadows() || options.noShadow) code += "uniform mat4 light" + i + "_shadowMatrix;\n";
                    }
                } else {
                    if (lightType===pc.LIGHTTYPE_SPOT) {
                        code += "uniform sampler2D light" + i + "_cookie;\n";
                        code += "uniform float light" + i + "_cookieIntensity;\n";
                        if (!light.getCastShadows() || options.noShadow) code += "uniform mat4 light" + i + "_shadowMatrix;\n";
                        if (light._cookieTransform) {
                            code += "uniform vec4 light" + i + "_cookieMatrix;\n";
                            code += "uniform vec2 light" + i + "_cookieOffset;\n";
                        }
                    }
                }
            }
        }

        code += "\n"; // End of uniform declarations


        var uvOffset = options.heightMap ? " + dUvOffset" : "";
        var tbn = options.fastTbn? chunks.TBNfastPS : chunks.TBNPS;

        if (needsNormal) {
            if (options.normalMap && useTangents) {
                code += options.packedNormal? chunks.normalXYPS : chunks.normalXYZPS;

                var uv = this._uvSource(options.normalMapTransform, options.normalMapUv) + uvOffset;
                if (options.needsNormalFloat) {
                    code += (options.fastTbn? chunks.normalMapFloatTBNfastPS : chunks.normalMapFloatPS).replace(/\$UV/g, uv);
                } else {
                    code += chunks.normalMapPS.replace(/\$UV/g, uv);
                }
                code += tbn;
            } else {
                code += chunks.normalVertexPS;
            }
        }

        code += pc.programlib.gammaCode(options.gamma);
        code += pc.programlib.tonemapCode(options.toneMap);
        code += pc.programlib.fogCode(options.fog);

        if (options.useRgbm) code += chunks.rgbmPS;
        if (cubemapReflection || options.prefilteredCubemap) {
            code += options.fixSeams? chunks.fixCubemapSeamsStretchPS : chunks.fixCubemapSeamsNonePS;
        }

        if (needsNormal) {
            code += options.cubeMapProjection>0? chunks.cubeMapProjectBoxPS : chunks.cubeMapProjectNonePS;
            code += options.skyboxIntensity? chunks.envMultiplyPS : chunks.envConstPS;
        }

        code += this._addMap("diffuse", options, chunks, uvOffset);
        if (options.blendType!==pc.BLEND_NONE || options.alphaTest) {
            code += this._addMap("opacity", options, chunks, uvOffset);
        }
        code += this._addMap("emissive", options, chunks, uvOffset, null, options.emissiveFormat);

        if (options.useSpecular) {
            if (options.specularAA && options.normalMap) {
                if (options.needsNormalFloat && needsNormal) {
                    code += chunks.specularAaToksvigFloatPS;
                } else {
                    code += chunks.specularAaToksvigPS;
                }
            } else {
                code += chunks.specularAaNonePS;
            }
            if (options.useMetalness) {
                code += chunks.metalnessPS;
            }
            code += this._addMap(options.useMetalness? "metalness" : "specular", options, chunks, uvOffset);
            code += this._addMap("gloss", options, chunks, uvOffset);
            if (options.fresnelModel > 0) {
                if (options.fresnelModel === pc.FRESNEL_SIMPLE) {
                    code += chunks.fresnelSimplePS;
                } else if (options.fresnelModel === pc.FRESNEL_SCHLICK) {
                    code += chunks.fresnelSchlickPS;
                } else if (options.fresnelModel === pc.FRESNEL_COMPLEX) {
                    code += chunks.fresnelComplexPS;
                }
            }
        }

        if (options.heightMap) {
            if (!options.normalMap) code += tbn;
            code += this._addMap("height", options, chunks, "", chunks.parallaxPS);
        }

        var useAo = options.aoMap || options.aoMapVertexColor;
        if (useAo) {
            code += this._addMap("ao", options, chunks, uvOffset, options.aoMapVertexColor? chunks.aoVertPS : chunks.aoTexPS);
            if (options.occludeSpecular) {
                if (options.occludeSpecular===pc.SPECOCC_AO) {
                    code += options.occludeSpecularFloat? chunks.aoSpecOccSimplePS : chunks.aoSpecOccConstSimplePS;
                } else {
                    code += options.occludeSpecularFloat? chunks.aoSpecOccPS : chunks.aoSpecOccConstPS;
                }
            }
        }

        var reflectionDecode = options.rgbmReflection? "decodeRGBM" : (options.hdrReflection? "" : "gammaCorrectInput");

        if (cubemapReflection || options.prefilteredCubemap) {
            if (options.prefilteredCubemap) {
                if (useTexCubeLod) {
                    code += chunks.reflectionPrefilteredCubeLodPS.replace(/\$DECODE/g, reflectionDecode);

                } else {
                    code += chunks.reflectionPrefilteredCubePS.replace(/\$DECODE/g, reflectionDecode);
                }
            } else {
                code += chunks.reflectionCubePS.replace(/\$textureCubeSAMPLE/g,
                    options.rgbmReflection? "textureCubeRGBM" : (options.hdrReflection? "textureCube" : "textureCubeSRGB"));
            }
        }

        if (options.sphereMap) {
            var scode = device.fragmentUniformsCount>16? chunks.reflectionSpherePS : chunks.reflectionSphereLowPS;
            scode = scode.replace(/\$texture2DSAMPLE/g, options.rgbmReflection? "texture2DRGBM" : (options.hdrReflection? "texture2D" : "texture2DSRGB"));
            code += scode;
        }

        if (options.dpAtlas) {
            code += chunks.reflectionDpAtlasPS.replace(/\$texture2DSAMPLE/g, options.rgbmReflection? "texture2DRGBM" : (options.hdrReflection? "texture2D" : "texture2DSRGB"));
        }

        if ((cubemapReflection || options.sphereMap || options.dpAtlas) && options.refraction) {
            code += chunks.refractionPS;
        }

        if (numShadowLights > 0) {
            if (shadowTypeUsed[pc.SHADOW_DEPTH]) {
                code += chunks.shadowStandardPS;
            }
            if (useVsm) {
                code += chunks.shadowVSM_commonPS;
                if (shadowTypeUsed[pc.SHADOW_VSM8]) {
                    code += chunks.shadowVSM8PS;
                }
                if (shadowTypeUsed[pc.SHADOW_VSM16]) {
                    code += device.extTextureHalfFloatLinear? chunks.shadowEVSMPS.replace(/\$/g, "16") : chunks.shadowEVSMnPS.replace(/\$/g, "16");
                }
                if (shadowTypeUsed[pc.SHADOW_VSM32]) {
                    code += device.extTextureFloatLinear? chunks.shadowEVSMPS.replace(/\$/g, "32") : chunks.shadowEVSMnPS.replace(/\$/g, "32");
                }
            }

            code += device.extStandardDerivatives? chunks.biasRcvPlanePS : chunks.biasConstPS;
            code += chunks.shadowCoordPS + chunks.shadowCommonPS;

            if (mainShadowLight>=0) {
                if (shadowTypeUsed[pc.SHADOW_DEPTH]) {
                    code += chunks.shadowStandardVSPS;
                }
                if (useVsm) {
                    if (shadowTypeUsed[pc.SHADOW_VSM8]) {
                        code += chunks.shadowVSMVSPS.replace(/\$VSM/g, "VSM8").replace(/\$/g, "8");
                    }
                    if (shadowTypeUsed[pc.SHADOW_VSM16]) {
                        code += chunks.shadowVSMVSPS.replace(/\$VSM/g, "VSM16").replace(/\$/g, "16");
                    }
                    if (shadowTypeUsed[pc.SHADOW_VSM32]) {
                        code += chunks.shadowVSMVSPS.replace(/\$VSM/g, "VSM32").replace(/\$/g, "32");
                    }
                }
            }
        }

        if (lighting) code += chunks.lightDiffuseLambertPS;
        var useOldAmbient = false;
        if (options.useSpecular) {
            code += options.shadingModel===pc.SPECULAR_PHONG? chunks.lightSpecularPhongPS : chunks.lightSpecularBlinnPS;
            if (options.sphereMap || cubemapReflection || options.dpAtlas || (options.fresnelModel > 0)) {
                if (options.fresnelModel > 0) {
                    if (options.conserveEnergy) {
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

        var addAmbient = true;
        if (options.lightMap || options.lightMapVertexColor) {
            code += this._addMap("light", options, chunks, uvOffset,
                options.lightMapVertexColor? chunks.lightmapSingleVertPS :
                (options.dirLightMap? chunks.lightmapDirPS : chunks.lightmapSinglePS), options.lightMapFormat);
            addAmbient = options.lightMapWithoutAmbient;
        }

        if (addAmbient) {
            if (options.ambientSH) {
                code += chunks.ambientSHPS;
            }
            else if (options.prefilteredCubemap) {
                if (useTexCubeLod) {
                    code += chunks.ambientPrefilteredCubeLodPS.replace(/\$DECODE/g, reflectionDecode);
                } else {
                    code += chunks.ambientPrefilteredCubePS.replace(/\$DECODE/g, reflectionDecode);
                }
            } else {
                code += chunks.ambientConstantPS;
            }
        }

        if (options.modulateAmbient && !useOldAmbient) {
            code += "uniform vec3 material_ambient;\n";
        }

        if (options.alphaTest) {
            code += chunks.alphaTestPS;
        }

        if (options.msdf) {
            code += chunks.msdfPS
        }

        if (needsNormal) {
            code += chunks.viewDirPS;
            if (options.useSpecular) {
                code += chunks.reflDirPS;
            }
        }
        var hasPointLights = false;
        var usesLinearFalloff = false;
        var usesInvSquaredFalloff = false;
        var usesSpot = false;
        var usesCookie = false;
        var usesCookieNow;

        // FRAGMENT SHADER BODY
        code += chunks.startPS;

        var opacityParallax = false;
        if (options.blendType===pc.BLEND_NONE && !options.alphaTest) {
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

        if (needsNormal) {
            code += "   getViewDir();\n";
            if (options.heightMap || options.normalMap) {
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
            if (options.useSpecular) code += "   getReflDir();\n";
        }

        code += "   getAlbedo();\n";

        if ((lighting && options.useSpecular) || reflections) {
            code += "   getSpecularity();\n";
            code += "   getGlossiness();\n";
            if (options.fresnelModel > 0) code += "   getFresnel();\n";
        }

        if (addAmbient) {
            code += "   addAmbient();\n";
        }
        if (options.modulateAmbient && !useOldAmbient) {
            code += "   dDiffuseLight *= material_ambient;\n";
        }
        if (useAo && !options.occludeDirect) {
                code += "    applyAO();\n";
        }
        if (options.lightMap || options.lightMapVertexColor) {
            code += "   addLightMap();\n";
        }

        if (lighting || reflections) {
            if (cubemapReflection || options.sphereMap || options.dpAtlas) {
                code += "   addReflection();\n";
            }

            if (options.dirLightMap) {
                code += "   addDirLightMap();\n";
            }

            for (i = 0; i < options.lights.length; i++) {
                // The following code is not decoupled to separate shader files, because most of it can be actually changed to achieve different behaviours like:
                // - different falloffs
                // - different shadow coords (point shadows will use drastically different genShadowCoord)
                // - different shadow filter modes

                // getLightDiffuse and getLightSpecular is BRDF itself.

                light = options.lights[i];
                lightType = light.getType();
                usesCookieNow = false;

                if (lightType===pc.LIGHTTYPE_DIRECTIONAL) {
                    // directional
                    code += "   dLightDirNormW = light"+i+"_direction;\n";
                    code += "   dAtten = 1.0;\n";
                } else {

                    if (light._cookie) {
                        if (lightType===pc.LIGHTTYPE_SPOT && !light._cookie._cubemap) {
                            usesCookie = true;
                            usesCookieNow = true;
                        } else if (lightType===pc.LIGHTTYPE_POINT && light._cookie._cubemap) {
                            usesCookie = true;
                            usesCookieNow = true;
                        }
                    }

                    code += "   getLightDirPoint(light"+i+"_position);\n";
                    hasPointLights = true;

                    if (usesCookieNow) {
                        if (lightType===pc.LIGHTTYPE_SPOT) {
                            code += "   dAtten3 = getCookie2D"+(light._cookieFalloff?"":"Clip")+(light._cookieTransform?"Xform":"")+"(light"+i+"_cookie, light"+i+"_shadowMatrix, light"+i+"_cookieIntensity"+(light._cookieTransform?", light"+i+"_cookieMatrix, light"+i+"_cookieOffset":"")+")."+light.getCookieChannel()+";\n";
                        } else {
                            code += "   dAtten3 = getCookieCube(light"+i+"_cookie, light"+i+"_shadowMatrix, light"+i+"_cookieIntensity)."+light.getCookieChannel()+";\n";
                        }
                    }

                    if (light.getFalloffMode()==pc.LIGHTFALLOFF_LINEAR) {
                        code += "   dAtten = getFalloffLinear(light"+i+"_radius);\n";
                        usesLinearFalloff = true;
                    } else {
                        code += "   dAtten = getFalloffInvSquared(light"+i+"_radius);\n";
                        usesInvSquaredFalloff = true;
                    }

                    code += "   if (dAtten > 0.00001) {\n" // BRANCH START

                    if (lightType===pc.LIGHTTYPE_SPOT) {
                        if (!(usesCookieNow && !light._cookieFalloff)) {
                            code += "       dAtten *= getSpotEffect(light"+i+"_direction, light"+i+"_innerConeAngle, light"+i+"_outerConeAngle);\n";
                            usesSpot = true;
                        }
                    }
                }

                code += "       dAtten *= getLightDiffuse();\n";
                if (light.getCastShadows() && !options.noShadow) {

                    var shadowReadMode = null;
                    var evsmExp;
                    if (light._shadowType===pc.SHADOW_VSM8) {
                        shadowReadMode = "VSM8";
                        evsmExp = "0.0";
                    } else if (light._shadowType===pc.SHADOW_VSM16) {
                        shadowReadMode = "VSM16";
                        evsmExp = "5.54";
                    } else if (light._shadowType===pc.SHADOW_VSM32) {
                        shadowReadMode = "VSM32";
                        if (device.extTextureFloatHighPrecision) {
                            evsmExp = "15.0";
                        } else {
                            evsmExp = "5.54";
                        }
                    } else if (options.shadowSampleType===pc.SHADOWSAMPLE_HARD) {
                        shadowReadMode = "Hard";
                    } else if (options.shadowSampleType===pc.SHADOWSAMPLE_PCF3X3) {
                        shadowReadMode = "PCF3x3";
                    }

                    if (shadowReadMode!==null) {
                        if (lightType===pc.LIGHTTYPE_POINT) {
                            shadowCoordArgs = "(light"+i+"_shadowMap, light"+i+"_shadowParams);\n";
                            if (light.getNormalOffsetBias()) {
                                code += "       normalOffsetPointShadow(light"+i+"_shadowParams);\n";
                            }
                            code += "       dAtten *= getShadowPoint" + shadowReadMode + shadowCoordArgs;
                        } else {
                            if (mainShadowLight===i) {
                                shadowReadMode += "VS";
                            } else {
                                shadowCoordArgs = "(light"+i+"_shadowMatrix, light"+i+"_shadowParams);\n";
                                code += this._nonPointShadowMapProjection(options.lights[i], shadowCoordArgs);
                            }
                            if (lightType===pc.LIGHTTYPE_SPOT) shadowReadMode = "Spot" + shadowReadMode;
                            code += "       dAtten *= getShadow" + shadowReadMode + "(light"+i+"_shadowMap, light"+i+"_shadowParams"
                                + (light._shadowType > pc.SHADOW_DEPTH? ", " + evsmExp : "") + ");\n";
                        }
                    }
                }

                code += "       dDiffuseLight += dAtten * light"+i+"_color" + (usesCookieNow? " * dAtten3" : "") + ";\n";

                if (options.useSpecular) {
                    code += "       dAtten *= getLightSpecular();\n";
                    code += "       dSpecularLight += dAtten * light"+i+"_color" + (usesCookieNow? " * dAtten3" : "") + ";\n";
                }

                if (lightType!==pc.LIGHTTYPE_DIRECTIONAL) {
                    code += "   }\n"; // BRANCH END
                }

                code += "\n";
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

        code += chunks.endPS;
        if (options.blendType===pc.BLEND_NORMAL || options.blendType===pc.BLEND_ADDITIVEALPHA) {
            code += chunks.outputAlphaPS;
        } else if (options.blendType===pc.BLEND_PREMULTIPLIED) {
            code += chunks.outputAlphaPremulPS;
        } else {
            code+= chunks.outputAlphaOpaquePS;
        }

        if (options.msdf) {
            code += "   gl_FragColor = applyMsdf(gl_FragColor);\n";
        }

        code += "\n";
        code += pc.programlib.end();

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
        if (code.includes("dUvOffset")) structCode += "vec2 dUvOffset;\n";
        if (code.includes("dGlossiness")) structCode += "float dGlossiness;\n";
        if (code.includes("dAlpha")) structCode += "float dAlpha;\n";
        if (code.includes("dAtten")) structCode += "float dAtten;\n";
        if (code.includes("dAtten3")) structCode += "vec3 dAtten3;\n";
        if (code.includes("dAo")) structCode += "float dAo;\n";
        if (code.includes("dMsdf")) structCode += "vec4 dMsdf;\n";

        code = codeBegin + structCode + code;

        fshader = code;

        return {
            attributes: attributes,
            vshader: vshader,
            fshader: fshader,
            tag: pc.SHADERTAG_MATERIAL
        };
    }
};
