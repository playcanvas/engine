pc.programlib.phong = {
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
            } else {
                if (options[prop]) props.push(prop);
            }
        }
        props.sort();
        for(prop in props) key += "_" + props[prop] + ":" + options[props[prop]];

        return key;
    },

    _setMapTransform: function (codes, name, id) {
        codes[0] += "uniform vec4 texture_"+name+"MapTransform;\n"

        if (!codes[3][id]) {
            codes[1] += "varying vec2 vUv0_"+id+";\n"
            codes[2] += "   vUv0_"+id+"   = uv0 * texture_"+name+"MapTransform.xy + texture_"+name+"MapTransform.zw;\n";
            codes[3][id] = true;
        }
        return codes;
    },

    _uvSource: function(id) {
        return id==0? "vUv0" : ("vUv0_" + id);
    },

    createShaderDefinition: function (device, options) {
        var i;
        var lighting = options.lights.length > 0;
        var cubemapReflection = options.cubeMap || options.prefilteredCubemap;
        var reflections = options.sphereMap || cubemapReflection;
        var useTangents = pc.precalculatedTangents;
        var useTexCubeLod = options.useTexCubeLod;
        if ((options.cubeMap) || (options.prefilteredCubemap)) options.sphereMap = null; // cubeMaps have higher priority

        if (options.shadingModel===pc.SPECULAR_PHONG) {
            options.fresnelModel = 0;
            options.specularAA = false;
        } else {
            options.fresnelModel = (options.fresnelModel===0)? pc.FRESNEL_SCHLICK : options.fresnelModel;
        }

        this.options = options;

        ////////////////////////////
        // GENERATE VERTEX SHADER //
        ////////////////////////////
        var getSnippet = pc.programlib.getSnippet;
        var code = '';
        var codeBody = '';

        var varyings = ""; // additional varyings for map transforms

        var chunks = pc.shaderChunks;
        code += chunks.baseVS;

        var attributes = {
            vertex_position: pc.SEMANTIC_POSITION
        }
        codeBody += "   vPositionW    = getWorldPosition(data);\n";

        if (lighting || reflections) {
            attributes.vertex_normal = pc.SEMANTIC_NORMAL;
            codeBody += "   vNormalW    = getNormal(data);\n";

            if ((options.sphereMap) && (device.fragmentUniformsCount <= 16)) {
                code += chunks.viewNormalVS;
                codeBody += "   vNormalV    = getViewNormal(data);\n";
            }

            if (options.normalMap && useTangents) {
                attributes.vertex_tangent = pc.SEMANTIC_TANGENT;
                code += chunks.tangentBinormalVS;
                codeBody += "   vTangentW   = getTangent(data);\n";
                codeBody += "   vBinormalW  = getBinormal(data);\n";
            }
        }

        if (options.diffuseMap || options.specularMap || options.glossMap ||
            options.emissiveMap || options.normalMap || options.heightMap || options.opacityMap) {
            attributes.vertex_texCoord0 = pc.SEMANTIC_TEXCOORD0;
            code += chunks.uv0VS;
            codeBody += "   vec2 uv0        = getUv0(data);\n";

            var codes = [code, varyings, codeBody, []];
            if (options.diffuseMapTransform)    this._setMapTransform(codes, "diffuse", options.diffuseMapTransform);
            if (options.normalMapTransform)     this._setMapTransform(codes, "normal", options.normalMapTransform);
            if (options.heightMapTransform)     this._setMapTransform(codes, "height", options.heightMapTransform);
            if (options.opacityMapTransform)    this._setMapTransform(codes, "opacity", options.opacityMapTransform);
            if (options.useSpecular) {
                if (options.specularMapTransform)   this._setMapTransform(codes, "specular", options.specularMapTransform);
                if (options.glossMapTransform)      this._setMapTransform(codes, "gloss", options.glossMapTransform);
            }
            if (options.emissiveMapTransform)   this._setMapTransform(codes, "emissive", options.emissiveMapTransform);
            code = codes[0] + codes[1];
            varyings = codes[1];
            codeBody = codes[2];

            if ((options.diffuseMap && !options.diffuseMapTransform) ||
                (options.normalMap && !options.normalMapTransform) ||
                (options.heightMap && !options.heightMapTransform) ||
                (options.opacityMap && !options.opacityMapTransform) ||
                (options.specularMap && !options.specularMapTransform) ||
                (options.emissiveMap && !options.emissiveMapTransform) ||
                (options.glossMap && !options.glossMapTransform)) {
                codeBody += "   vUv0        = uv0;\n";
            }
        }

        if (options.lightMap || (options.aoMap && options.aoUvSet===1)) {
            attributes.vertex_texCoord1 = pc.SEMANTIC_TEXCOORD1;
            code += chunks.uv1VS;
            codeBody += "   vUv1        = getUv1(data);\n";
        }

        if (options.vertexColors) {
            attributes.vertex_color = pc.SEMANTIC_COLOR;
        }

        if (options.skin) {
            attributes.vertex_boneWeights = pc.SEMANTIC_BLENDWEIGHT;
            attributes.vertex_boneIndices = pc.SEMANTIC_BLENDINDICES;
            code += getSnippet(device, 'vs_skin_decl');
            code += chunks.transformSkinnedVS;
            if (lighting || reflections) code += chunks.normalSkinnedVS;
        } else {
            code += chunks.transformVS;
            if (lighting || reflections) code += chunks.normalVS;
        }

        code += "\n";

        code += chunks.startVS;
        code += codeBody;
        code += "}";

        var vshader = code;

        //////////////////////////////
        // GENERATE FRAGMENT SHADER //
        //////////////////////////////
        code = getSnippet(device, 'fs_precision');
        code += chunks.basePS;
        code += varyings;

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
            if (options.lights[i].getCastShadows()) {
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


        var uvOffset = options.heightMap? " + data.uvOffset" : "";

        if (options.normalMap && useTangents) {
            code += options.packedNormal? chunks.normalXYPS : chunks.normalXYZPS;

            var uv = this._uvSource(options.normalMapTransform) + uvOffset;
            //if (options.needsNormalFloat) {
                code += chunks.normalMapFloatPS.replace(/\$UV/g, uv);
            //} else {
             //   code += chunks.normalMapPS.replace(/\$UV/g, uv);
            //}
            code += chunks.TBNPS;
        } else {
            code += chunks.normalVertexPS;
        }

        code += chunks.defaultGamma;
        code += chunks.defaultTonemapping;

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
        if (cubemapReflection) code += options.fixSeams? chunks.fixCubemapSeamsStretchPS : chunks.fixCubemapSeamsNonePS;

        if (options.diffuseMap) {
            var uv = this._uvSource(options.diffuseMapTransform) + uvOffset
            if (options.blendMapsWithColors && options.needsDiffuseColor) {
                code += chunks.albedoTexColorPS.replace(/\$UV/g, uv);
            } else {
                code += chunks.albedoTexPS.replace(/\$UV/g, uv);
            }
        } else {
            code += chunks.albedoColorPS;
        }

        if (options.useSpecular) {
            if (options.specularAA && options.normalMap) {
                code += chunks.specularAaToksvigPS;
            } else {
                code += chunks.specularAaNonePS;
            }
            if (options.specularMap) {
                var uv = this._uvSource(options.specularMapTransform) + uvOffset;
                if (options.blendMapsWithColors && options.needsSpecularColor) {
                    code += chunks.specularityTexColorPS.replace(/\$UV/g, uv);
                } else {
                    code += chunks.specularityTexPS.replace(/\$UV/g, uv);
                }
            } else {
                code += chunks.specularityColorPS;
            }
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

        if (options.glossMap) {
            var uv = this._uvSource(options.glossMapTransform) + uvOffset;
            if (options.blendMapsWithColors && options.needsGlossFloat) {
                code += chunks.glossinessTexFloatPS.replace(/\$UV/g, uv);
            } else {
                code += chunks.glossinessTexPS.replace(/\$UV/g, uv);
            }
        } else {
            code += chunks.glossinessFloatPS;
        }

        if (options.opacityMap) {
            var uv = this._uvSource(options.opacityMapTransform) + uvOffset;
            if (options.blendMapsWithColors && options.needsOpacityFloat) {
                code += chunks.opacityTexFloatPS.replace(/\$UV/g, uv);
            } else {
                code += chunks.opacityTexPS.replace(/\$UV/g, uv);
            }
        } else {
            code += chunks.opacityFloatPS;
        }

        if (options.emissiveMap) {
            var uv = this._uvSource(options.emissiveMapTransform) + uvOffset;
            if (options.blendMapsWithColors && options.needsEmissiveColor) {
                code += chunks.emissionTexColorPS.replace(/\$UV/g, uv);
            } else {
                code += chunks.emissionTexPS.replace(/\$UV/g, uv);
            }
        } else {
            code += chunks.emissionColorPS;
        }

        if (options.heightMap) {
            if (!options.normalMap) code += chunks.TBNPS;
            code += chunks.parallaxPS.replace(/\$UV/g, this._uvSource(options.heightMapTransform));
        }

        var reflectionDecode = options.rgbmReflection? "decodeRGBM" : (options.hdrReflection? "" : "gammaCorrectInput");

        if (options.cubeMap) {
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


        if (options.lightMap) {
            code += chunks.lightmapSinglePS;
        }

        if (options.aoMap) {
            code += chunks.aoBakedPS.replace(/\$UV/g, options.aoUvSet===0? "vUv0" : "vUv1");
        }

        if (options.prefilteredCubemap) {
            if (useTexCubeLod) {
                code += chunks.ambientPrefilteredCubeLodPS.replace(/\$DECODE/g, reflectionDecode);
            } else {
                code += chunks.ambientPrefilteredCubePS.replace(/\$DECODE/g, reflectionDecode);
            }
        } else {
            code += chunks.ambientConstantPS;
        }

        if (options.modulateAmbient) {
            code += "uniform vec3 material_ambient;\n"
        }

        if (numShadowLights > 0) {
            code += chunks.shadowPS;
        }

        code += chunks.lightDiffuseLambertPS;
        if (options.useSpecular) {
            code += options.shadingModel===pc.SPECULAR_PHONG? chunks.lightSpecularPhongPS : chunks.lightSpecularBlinnPS;
            if (options.sphereMap || options.cubeMap || (options.fresnelModel > 0)) {
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
                }
            }
        } else {
            code += chunks.combineDiffusePS;
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

        if (options.lightMap) {
                code += "    addLightmap(data);\n";
        }

        code += "   addAmbient(data);\n";
        if (options.modulateAmbient) {
            code += "   data.diffuseLight *= material_ambient;\n"
        }
        if (options.aoMap) {
                code += "    applyAO(data);\n";
        }

        if (lighting || reflections) {
            if (options.cubeMap) {
                code += "   addCubemapReflection(data);\n";
            } else if (options.sphereMap) {
                code += "   addSpheremapReflection(data);\n";
            }

            for (i = 0; i < options.lights.length; i++) {
                // The following code is not decoupled to separate shader files, because most of it can be actually changed to achieve different behaviours like:
                // - different falloffs
                // - different shadow coords (point shadows will use drastically different genShadowCoord)
                // - different shadow filter modes

                // getLightDiffuse and getLightSpecular is BRDF (currently lame Lambert+Phong) itself.

                var lightType = options.lights[i].getType();

                if (lightType==pc.LIGHTTYPE_DIRECTIONAL) {
                    // directional
                    code += "   data.lightDirNormW = light"+i+"_direction;\n";
                    code += "   data.atten = 1.0;\n";
                } else {
                    code += "   getLightDirPoint(data, light"+i+"_position);\n";
                    if (options.lights[i].getFalloffMode()==pc.LIGHTFALLOFF_LINEAR) {
                        code += "   data.atten = getFalloffLinear(data, light"+i+"_radius);\n";
                    } else {
                        code += "   data.atten = getFalloffInvSquared(data, light"+i+"_radius);\n";
                    }
                    if (lightType==pc.LIGHTTYPE_SPOT) {
                        code += "   data.atten *= getSpotEffect(data, light"+i+"_spotDirection, light"+i+"_innerConeAngle, light"+i+"_outerConeAngle);\n";
                    }
                }

                code += "   data.atten *= getLightDiffuse(data);\n";
                if (options.lights[i].getCastShadows()) {
                    if (lightType==pc.LIGHTTYPE_POINT) {
                        var shadowCoordArgs = "(data, light"+i+"_shadowMap, light"+i+"_shadowParams);\n";
                        if (!options.lights[i].getNormalOffsetBias()) {
                            code += "   data.atten *= getShadowPoint" + shadowCoordArgs;
                        } else {
                            code += "   data.atten *= getShadowPointNormalOffset" + shadowCoordArgs;
                        }
                    } else {
                        var shadowCoordArgs = "(data, light"+i+"_shadowMatrix, light"+i+"_shadowParams);\n";
                        if (!options.lights[i].getNormalOffsetBias()) {
                            if (lightType==pc.LIGHTTYPE_SPOT) {
                                code += "   getShadowCoordPersp" + shadowCoordArgs;
                            } else {
                                code += "   getShadowCoordOrtho" + shadowCoordArgs;
                            }
                        } else {
                            if (lightType==pc.LIGHTTYPE_SPOT) {
                                code += "   getShadowCoordPerspNormalOffset" + shadowCoordArgs;
                            } else {
                                code += "   getShadowCoordOrthoNormalOffset" + shadowCoordArgs;
                            }
                        }
                        code += "   data.atten *= getShadowPCF3x3(data, light"+i+"_shadowMap, light"+i+"_shadowParams);\n";
                    }
                }

                code += "   data.diffuseLight += data.atten * light"+i+"_color;\n";

                if (options.useSpecular) {
                    code += "   data.atten *= getLightSpecular(data);\n"
                    code += "   data.specularLight += data.atten * light"+i+"_color;\n";
                }
                code += "\n";
            }
        }
        code += "\n";

        if (options.aoMap && options.occludeSpecular) {
                code += "    occludeSpecular(data);\n";
        }

        code += chunks.endPS;

        // Make sure all components are between 0 and 1
        code += getSnippet(device, 'fs_clamp');

        code += getSnippet(device, 'common_main_end');

        var fshader = code;

        return {
            attributes: attributes,
            vshader: vshader,
            fshader: fshader
        };
    }
};
