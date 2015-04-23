var AFFECTS_VS = [
    'chunks',
    'lights',
    'sphereMap',
    'cubeMap',
    'prefilteredCubemap',
    'noShadow',
    'useInstancing',
    'heightMap',
    'normalMap',
    'vertexColors',
    'skin'
];

pc.programlib.phong = {

    hashCode: function(str){
        var hash = 0;
        if (str.length == 0) return hash;
        for (i = 0; i < str.length; i++) {
            char = str.charCodeAt(i);
            hash = ((hash<<5)-hash)+char;
            hash = hash & hash;
        }
        return hash;
    },

    generateKey: function (device, options) {
        var props = [];
        var key = "phong";
        for(prop in options) {
            if (prop==="lights") {
                for(var i=0; i<options.lights.length; i++) {
                    props.push(options.lights[i].getType() + "_"
                        + (options.lights[i].getCastShadows() ? 1 : 0) + "_"
                        + options.lights[i].getFalloffMode() + "_"
                        + !!options.lights[i].getNormalOffsetBias());
                }
            } else if (prop==="chunks") {
                for(var p in options[prop]) {
                    if (options[prop].hasOwnProperty(p)) {
                        props.push(p + options.chunks[p]);
                    }
                }
            } else {
                if (options[prop]) props.push(prop);
            }
        }
        props.sort();
        for(prop in props) key += props[prop] + options[props[prop]];

        return this.hashCode(key);
    },

    generateVsKey: function (device, options) {
        var voptions = {};
        var i;

        for(prop in options) {
            for(i=0; i<AFFECTS_VS.length; i++) {
                if (prop===AFFECTS_VS[i]) {
                    voptions[prop] = options[prop];
                    break;
                }
            }
        }

        for(var p in pc._matTex2D) {
            var map = p + "Map";
            if (options[map]) {
                var mapt = p + "MapTransform";
                var mapuv = p + "MapUv";
                voptions[map] = options[map];
                voptions[mapt] = options[mapt];
                voptions[mapuv] = options[mapuv];
            }
        }

        return this.generateKey(device, voptions);
    },

    _setMapTransform: function (codes, name, id, uv) {
        codes[0] += "uniform vec4 texture_"+name+"MapTransform;\n"

        var checkId = id + uv * 100;
        if (!codes[3][checkId]) {
            codes[1] += "varying vec2 vUV"+uv+"_"+id+";\n"
            codes[2] += "   vUV"+uv+"_"+id+" = uv"+uv+" * texture_"+name+"MapTransform.xy + texture_"+name+"MapTransform.zw;\n";
            codes[3][checkId] = true;
        }
        return codes;
    },

    _uvSource: function(id, uv) {
        return id==0? "vUv" + uv : ("vUV"+uv+"_" + id);
    },

    _addMap: function(p, options, chunks, uvOffset, subCode, format) {
        var mname = p + "Map";
        if (options[mname]) {
            var tname = mname + "Transform";
            var cname = mname + "Channel";
            var uname = mname + "Uv";
            var uv = this._uvSource(options[tname], options[uname]) + uvOffset;
            if (!subCode) {
                if (options[p + "Tint"]) {
                    subCode = chunks[p + "TexConstPS"];
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
        if (!light.getNormalOffsetBias()) {
            if (light.getType()==pc.LIGHTTYPE_SPOT) {
                return "   getShadowCoordPersp" + shadowCoordArgs;
            } else {
                return "   getShadowCoordOrtho" + shadowCoordArgs;
            }
        } else {
            if (light.getType()==pc.LIGHTTYPE_SPOT) {
                return "   getShadowCoordPerspNormalOffset" + shadowCoordArgs;
            } else {
                return "   getShadowCoordOrthoNormalOffset" + shadowCoordArgs;
            }
        }
    },

    _addVaryingIfNeeded: function(code, type, name) {
        return code.indexOf(name)>=0? ("varying " + type + " " + name + ";\n") : "";
    },

    createShaderDefinition: function (device, options) {
        var i;
        var lighting = options.lights.length > 0;

        if (options.shadingModel===pc.SPECULAR_PHONG) {
            options.fresnelModel = 0;
            options.specularAA = false;
            options.prefilteredCubemap = false;
        } else {
            options.fresnelModel = (options.fresnelModel===0)? pc.FRESNEL_SCHLICK : options.fresnelModel;
        }

        var cubemapReflection = options.cubeMap || options.prefilteredCubemap;
        var reflections = options.sphereMap || cubemapReflection;
        var useTangents = pc.precalculatedTangents;
        var useTexCubeLod = options.useTexCubeLod;
        if ((options.cubeMap) || (options.prefilteredCubemap)) options.sphereMap = null; // cubeMaps have higher priority
        if (!options.useSpecular) options.specularMap = options.glossMap = null;

        this.options = options;

        ////////////////////////////
        // GENERATE VERTEX SHADER //
        ////////////////////////////
        var getSnippet = pc.programlib.getSnippet;
        var code = '';
        var codeBody = '';

        var varyings = ""; // additional varyings for map transforms

        var chunks = pc.shaderChunks;

        if (options.chunks) {
            var customChunks = [];
            for(var p in chunks) {
                if (chunks.hasOwnProperty(p)) {
                    if (!options.chunks[p]) {
                        customChunks[p] = chunks[p];
                    } else {
                        customChunks[p] = options.chunks[p];
                        if (!lighting && !reflections) {
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

        code += chunks.baseVS;

        // Allow first shadow coords to be computed in VS
        var mainShadowLight = -1;
        if (!options.noShadow) {
            for (i = 0; i < options.lights.length; i++) {
                var lightType = options.lights[i].getType();
                if (options.lights[i].getCastShadows()) {
                    if (lightType!==pc.LIGHTTYPE_POINT) {
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
        }
        codeBody += "   vPositionW    = getWorldPosition(data);\n";

        if (options.useInstancing) {
            attributes.instance_line1 = pc.SEMANTIC_TEXCOORD2;
            attributes.instance_line2 = pc.SEMANTIC_TEXCOORD3;
            attributes.instance_line3 = pc.SEMANTIC_TEXCOORD4;
            attributes.instance_line4 = pc.SEMANTIC_TEXCOORD5;
            code += chunks.instancingVS;
        }

        if (lighting || reflections) {
            attributes.vertex_normal = pc.SEMANTIC_NORMAL;
            codeBody += "   vNormalW    = data.normalW = getNormal(data);\n";

            if ((options.sphereMap) && (device.fragmentUniformsCount <= 16)) {
                code += chunks.viewNormalVS;
                codeBody += "   vNormalV    = getViewNormal(data);\n";
            }

            if ((options.heightMap || options.normalMap) && useTangents) {
                attributes.vertex_tangent = pc.SEMANTIC_TANGENT;
                code += chunks.tangentBinormalVS;
                codeBody += "   vTangentW   = getTangent(data);\n";
                codeBody += "   vBinormalW  = getBinormal(data);\n";
            }

            if (mainShadowLight >= 0) {
                if (lightType==pc.LIGHTTYPE_DIRECTIONAL) {
                    codeBody += "   data.lightDirNormW = light"+mainShadowLight+"_directionVS;\n";
                } else {
                    codeBody += "   getLightDirPoint(data, light"+mainShadowLight+"_positionVS);\n";
                }
                var shadowCoordArgs = "(data, light"+mainShadowLight+"_shadowMatrixVS, light"+mainShadowLight+"_shadowParamsVS);\n";
                codeBody += this._nonPointShadowMapProjection(options.lights[mainShadowLight], shadowCoordArgs);
            }
        }

        var useUv = [];
        var useUnmodifiedUv = [];
        var maxUvSets = 2;

        for(var p in pc._matTex2D) {
            var mname = p + "Map";
            if (options[mname]) {
                var tname = mname + "Transform";
                var uname = mname + "Uv";
                var cname = mname + "Channel";
                options[uname] = Math.min(options[uname], maxUvSets - 1)
                if (pc._matTex2D[p] > 0) {
                    if (pc._matTex2D[p] < options[cname].length) {
                        options[cname] = options[cname].substring(0, pc._matTex2D[p]);
                    } else if (pc._matTex2D[p] > options[cname].length) {
                        var str = options[cname];
                        var chr = str.charAt(str.length - 1)
                        var addLen = pc._matTex2D[p] - str.length;
                        for(i=0; i<addLen; i++) str += chr;
                        options[cname] = str;
                    }
                }
                var uvSet = options[uname];
                useUv[uvSet] = true;
                useUnmodifiedUv[uvSet] = useUnmodifiedUv[uvSet] || (options[mname] && !options[tname]);
            }
        }

        for(i=0; i<maxUvSets; i++) {
            if (useUv[i]) {
                attributes["vertex_texCoord" + i] = pc["SEMANTIC_TEXCOORD" + i];
                code += chunks["uv" + i + "VS"];
                codeBody += "   vec2 uv" + i + " = getUv" + i + "(data);\n";
            }
            if (useUnmodifiedUv[i]) {
                codeBody += "   vUv" + i + " = uv" + i + ";\n";
            }
        }

        var codes = [code, varyings, codeBody, []];

        for(var p in pc._matTex2D) {
            var mname = p + "Map";
            if (options[mname]) {
                var tname = mname + "Transform";
                if (options[tname]) {
                    var uname = mname + "Uv";
                    this._setMapTransform(codes, p, options[tname], options[uname]);
                }
            }
        }

        code = codes[0];
        varyings = codes[1];
        codeBody = codes[2];

        if (options.vertexColors) {
            attributes.vertex_color = pc.SEMANTIC_COLOR;
        }

        if (options.skin) {
            attributes.vertex_boneWeights = pc.SEMANTIC_BLENDWEIGHT;
            attributes.vertex_boneIndices = pc.SEMANTIC_BLENDINDICES;
            code += getSnippet(device, 'vs_skin_decl');
            code += chunks.transformSkinnedVS;
            if (lighting || reflections) code += chunks.normalSkinnedVS;
        } else if (options.useInstancing) {
            code += chunks.transformInstancedVS;
            if (lighting || reflections) code += chunks.normalInstancedVS;
        } else {
            code += chunks.transformVS;
            if (lighting || reflections) code += chunks.normalVS;
        }

        code += "\n";

        code += chunks.startVS;
        code += codeBody;
        code += "}";

        var vshader = code;

        var oldVars = varyings;
        varyings = "";
        varyings += this._addVaryingIfNeeded(code, "vec4", "vMainShadowUv");
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
        if (options.forceFragmentPrecision && options.forceFragmentPrecision!="highp"
            && options.forceFragmentPrecision!="mediump"
            && options.forceFragmentPrecision!="lowp")
            options.forceFragmentPrecision = null;

        if (options.forceFragmentPrecision) {
            if (options.forceFragmentPrecision==="highp" && device.maxPrecision!=="highp") options.forceFragmentPrecision = "mediump";
            if (options.forceFragmentPrecision==="mediump" && device.maxPrecision==="lowp") options.forceFragmentPrecision = "lowp";
        }

        var fshader;
        code = options.forceFragmentPrecision? "precision " + options.forceFragmentPrecision + " float;\n\n" : getSnippet(device, 'fs_precision');

        if (options.customFragmentShader) {
            fshader = code + options.customFragmentShader;
            return {
                attributes: attributes,
                vshader: vshader,
                fshader: fshader
            };
        }

        code += varyings;
        code += chunks.basePS;

        // FRAGMENT SHADER INPUTS: UNIFORMS
        var numShadowLights = 0;
        for (i = 0; i < options.lights.length; i++) {
            var lightType = options.lights[i].getType();
            code += "uniform vec3 light" + i + "_color;\n";
            if (lightType==pc.LIGHTTYPE_DIRECTIONAL) {
                code += "uniform vec3 light" + i + "_direction;\n";
            } else {
                code += "uniform vec3 light" + i + "_position;\n";
                code += "uniform float light" + i + "_radius;\n";
                if (lightType==pc.LIGHTTYPE_SPOT) {
                    code += "uniform vec3 light" + i + "_spotDirection;\n";
                    code += "uniform float light" + i + "_innerConeAngle;\n";
                    code += "uniform float light" + i + "_outerConeAngle;\n";
                }
            }
            if (options.lights[i].getCastShadows() && !options.noShadow) {
                code += "uniform mat4 light" + i + "_shadowMatrix;\n";
                if (lightType==pc.LIGHTTYPE_POINT) {
                    code += "uniform vec4 light" + i + "_shadowParams;\n"; // Width, height, bias, radius
                } else {
                    code += "uniform vec3 light" + i + "_shadowParams;\n"; // Width, height, bias
                }
                if (lightType==pc.LIGHTTYPE_POINT) {
                    code += "uniform samplerCube light" + i + "_shadowMap;\n";
                } else {
                    code += "uniform sampler2D light" + i + "_shadowMap;\n";
                }
                numShadowLights++;
            }
        }

        if (options.alphaTest) {
            code += getSnippet(device, 'fs_alpha_test_decl');
        }

        code += "\n"; // End of uniform declarations


        var uvOffset = options.heightMap ? " + data.uvOffset" : "";
        var tbn = options.fastTbn? chunks.TBNfastPS : chunks.TBNPS;

        if (lighting || reflections) {
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

        if (options.fog === 'linear') {
            code += chunks.fogLinearPS;
        } else if (options.fog === 'exp') {
            code += chunks.fogExpPS;
        } else if (options.fog === 'exp2') {
            code += chunks.fogExp2PS;
        } else {
            code += chunks.fogNonePS;
        }

        if (options.rgbmReflection) code += chunks.rgbmPS;
        if (cubemapReflection) {
            code += options.fixSeams? chunks.fixCubemapSeamsStretchPS : chunks.fixCubemapSeamsNonePS;
            code += options.cubeMapProjection>0? chunks.cubeMapProjectBoxPS : chunks.cubeMapProjectNonePS;
        }

        code += this._addMap("diffuse", options, chunks, uvOffset);
        code += this._addMap("opacity", options, chunks, uvOffset);
        code += this._addMap("emissive", options, chunks, uvOffset, null, options.emissiveFormat);

        if (options.useSpecular) {
            if (options.specularAA && options.normalMap) {
                if (options.needsNormalFloat && (lighting || reflections)) {
                    code += chunks.specularAaToksvigFloatPS;
                } else {
                    code += chunks.specularAaToksvigPS;
                }
            } else {
                code += chunks.specularAaNonePS;
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

        if (options.aoMap) {
            code += this._addMap("ao", options, chunks, uvOffset, chunks.aoBakedPS);
        }

        var reflectionDecode = options.rgbmReflection? "decodeRGBM" : (options.hdrReflection? "" : "gammaCorrectInput");

        if (cubemapReflection) {
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

        if ((cubemapReflection || options.sphereMap) && options.refraction) {
            code += chunks.refractionPS;
        }

        if (options.lightMap) {
            code += this._addMap("light", options, chunks, uvOffset, chunks.lightmapSinglePS);
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

        if (numShadowLights > 0) {
            code += chunks.shadowCoordPS + chunks.shadowPS;
            if (mainShadowLight>=0) code += chunks.shadowVSPS;
        }

        code += chunks.lightDiffuseLambertPS;
        var useOldAmbient = false;
        if (options.useSpecular) {
            code += options.shadingModel===pc.SPECULAR_PHONG? chunks.lightSpecularPhongPS : chunks.lightSpecularBlinnPS;
            if (options.sphereMap || cubemapReflection || (options.fresnelModel > 0)) {
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

        if (options.modulateAmbient && !useOldAmbient) {
            code += "uniform vec3 material_ambient;\n"
        }

        // FRAGMENT SHADER BODY
        code += chunks.startPS;

        if (lighting || reflections) {
            code += "   getViewDir(data);\n";
            if (options.heightMap || options.normalMap) {
                code += "   getTBN(data);\n";
            }
            if (options.heightMap) {
                code += "   getParallax(data);\n"
            }
            code += "   getNormal(data);\n";
            if (options.useSpecular) code += "   getReflDir(data);\n";
        }

        code += "   getAlbedo(data);\n";

        if ((lighting && options.useSpecular) || reflections) {
            code += "   getSpecularity(data);\n";
            code += "   getGlossiness(data);\n";
            if (options.fresnelModel > 0) code += "   getFresnel(data);\n";
        }

        code += "   getOpacity(data);\n";
        if (options.alphaTest) {
            code += "   if (data.alpha < alpha_ref) discard;"
        }

        code += "   addAmbient(data);\n";
        if (options.modulateAmbient && !useOldAmbient) {
            code += "   data.diffuseLight *= material_ambient;\n"
        }
        if (options.aoMap && !options.occludeDirect) {
                code += "    applyAO(data);\n";
        }

        if (lighting || reflections) {
            if (cubemapReflection || options.sphereMap) {
                code += "   addReflection(data);\n";
            }

            var light;
            for (i = 0; i < options.lights.length; i++) {
                // The following code is not decoupled to separate shader files, because most of it can be actually changed to achieve different behaviours like:
                // - different falloffs
                // - different shadow coords (point shadows will use drastically different genShadowCoord)
                // - different shadow filter modes

                // getLightDiffuse and getLightSpecular is BRDF itself.

                light = options.lights[i];
                var lightType = light.getType();

                if (lightType==pc.LIGHTTYPE_DIRECTIONAL) {
                    // directional
                    code += "   data.lightDirNormW = light"+i+"_direction;\n";
                    code += "   data.atten = 1.0;\n";
                } else {
                    code += "   getLightDirPoint(data, light"+i+"_position);\n";
                    if (light.getFalloffMode()==pc.LIGHTFALLOFF_LINEAR) {
                        code += "   data.atten = getFalloffLinear(data, light"+i+"_radius);\n";
                    } else {
                        code += "   data.atten = getFalloffInvSquared(data, light"+i+"_radius);\n";
                    }
                    if (lightType==pc.LIGHTTYPE_SPOT) {
                        code += "   data.atten *= getSpotEffect(data, light"+i+"_spotDirection, light"+i+"_innerConeAngle, light"+i+"_outerConeAngle);\n";
                    }
                }

                code += "   data.atten *= getLightDiffuse(data);\n";
                if (light.getCastShadows() && !options.noShadow) {

                    var shadowReadMode = null;
                    if (light._shadowType<=pc.SHADOW_DEPTHMASK) {
                        if (options.shadowSampleType===pc.SHADOWSAMPLE_HARD) {
                            shadowReadMode = "Hard";
                        } else if (light._shadowType===pc.SHADOW_DEPTH && options.shadowSampleType===pc.SHADOWSAMPLE_PCF3X3) {
                            shadowReadMode = "PCF3x3";
                        } else if (light._shadowType===pc.SHADOW_DEPTHMASK && options.shadowSampleType===pc.SHADOWSAMPLE_PCF3X3) {
                            shadowReadMode = "PCF3x3_YZW";
                        } else if (light._shadowType===pc.SHADOW_DEPTHMASK && options.shadowSampleType===pc.SHADOWSAMPLE_MASK) {
                            shadowReadMode = "Mask";
                        }
                    }

                    if (shadowReadMode!==null) {
                        if (lightType==pc.LIGHTTYPE_POINT) {
                            var shadowCoordArgs = "(data, light"+i+"_shadowMap, light"+i+"_shadowParams);\n";
                            if (light.getNormalOffsetBias()) {
                                code += "   normalOffsetPointShadow(data, light"+i+"_shadowParams);\n";
                            }
                            code += "   data.atten *= getShadowPoint" + shadowReadMode + shadowCoordArgs;
                        } else {
                            if (mainShadowLight===i) {
                                shadowReadMode += "VS";
                            } else {
                                var shadowCoordArgs = "(data, light"+i+"_shadowMatrix, light"+i+"_shadowParams);\n";
                                code += this._nonPointShadowMapProjection(options.lights[i], shadowCoordArgs);
                            }
                            code += "   data.atten *= getShadow" + shadowReadMode + "(data, light"+i+"_shadowMap, light"+i+"_shadowParams);\n";
                        }
                    }
                }

                code += "   data.diffuseLight += data.atten * light"+i+"_color;\n";

                if (options.useSpecular) {
                    code += "   data.atten *= getLightSpecular(data);\n"
                    code += "   data.specularLight += data.atten * light"+i+"_color;\n";
                }
                code += "\n";
            }

            if ((cubemapReflection || options.sphereMap) && options.refraction) {
                code += "   addRefraction(data);\n";
            }
        }
        code += "\n";

        if (options.aoMap) {
            if (options.occludeDirect) {
                    code += "    applyAO(data);\n";
            }
            if (options.occludeSpecular) {
                code += "    occludeSpecular(data);\n";
            }
        }

        code += chunks.endPS;
        if (options.blendType===pc.BLEND_NORMAL || options.blendType===pc.BLEND_ADDITIVEALPHA) {
            code += "gl_FragColor.a = data.alpha;\n";
        } else if (options.blendType===pc.BLEND_PREMULTIPLIED) {
            code += "gl_FragColor.rgb *= data.alpha;\n";
            code += "gl_FragColor.a = data.alpha;\n";
        } else {
            code+= "gl_FragColor.a = 1.0;\n";
        }

        // Make sure all components are between 0 and 1
        code += getSnippet(device, 'fs_clamp');

        code += getSnippet(device, 'common_main_end');

        fshader = code;

        return {
            attributes: attributes,
            vshader: vshader,
            fshader: fshader,
            vkey: this.generateVsKey(device, options)
        };
    }
};
