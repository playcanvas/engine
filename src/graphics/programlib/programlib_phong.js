pc.gfx.programlib.phong = {
    generateKey: function (device, options) {

        var props = [];
        var key = "phong";
        for(prop in options) {
            if (prop==="lights") {
                for(var i=0; i<options.lights.length; i++) {
                    props.push(options.lights[i].getType() + "_" + (options.lights[i].getCastShadows() ? 1 : 0) + "_" + options.lights[i].getFalloffMode());
                }
            } else {
                if (options[prop]) props.push(prop);
            }
        }
        props.sort();
        for(prop in props) key += "_" + props[prop];

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
        var useTangents = pc.gfx.precalculatedTangents;

        this.options = options;

        ////////////////////////////
        // GENERATE VERTEX SHADER //
        ////////////////////////////
        var getSnippet = pc.gfx.programlib.getSnippet;
        var code = '';
        var codeBody = '';

        var varyings = ""; // additional varyings for map transforms

        var chunks = pc.gfx.shaderChunks;
        code += chunks.baseVS;

        var attributes = {
            vertex_position: pc.gfx.SEMANTIC_POSITION
        }
        codeBody += "   vPositionW    = getWorldPosition(data);\n";

        if (lighting) {
            attributes.vertex_normal = pc.gfx.SEMANTIC_NORMAL;
            codeBody += "   vNormalW    = getNormal(data);\n";

            if ((options.sphereMap) && (device.fragmentUniformsCount <= 16)) {
                code += chunks.viewNormalVS;
                codeBody += "   vNormalV    = getViewNormal(data);\n";
            }

            if (options.normalMap && useTangents) {
                attributes.vertex_tangent = pc.gfx.SEMANTIC_TANGENT;
                code += chunks.tangentBinormalVS;
                codeBody += "   vTangentW   = getTangent(data);\n";
                codeBody += "   vBinormalW  = getBinormal(data);\n";
            }
        }

        if (options.diffuseMap || options.specularMap || options.glossMap ||
            options.emissiveMap || options.normalMap || options.heightMap || options.opacityMap) {
            attributes.vertex_texCoord0 = pc.gfx.SEMANTIC_TEXCOORD0;
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
                (options.emissiveMap && !options.emissiveMapTransform) ||
                (options.normalMap && !options.normalMapTransform) ||
                (options.heightMap && !options.heightMapTransform) ||
                (options.opacityMap && !options.opacityMapTransform) ||
                (options.specularMap && !options.specularMapTransform) ||
                (options.glossMap && !options.glossMapTransform)) {
                codeBody += "   vUv0        = uv0;\n";
            }
        }

        if (options.lightMap) {
            attributes.vertex_texCoord1 = pc.gfx.SEMANTIC_TEXCOORD1;
            code += chunks.uv1VS;
            codeBody += "   vUv1        = getUv1(data);\n";
        }

        if (options.vertexColors) {
            attributes.vertex_color = pc.gfx.SEMANTIC_COLOR;
        }

        if (options.skin) {
            attributes.vertex_boneWeights = pc.gfx.SEMANTIC_BLENDWEIGHT;
            attributes.vertex_boneIndices = pc.gfx.SEMANTIC_BLENDINDICES;
            code += getSnippet(device, 'vs_skin_decl');
            code += chunks.transformSkinnedVS;
            if (lighting) code += chunks.normalSkinnedVS;
        } else {
            code += chunks.transformVS;
            if (lighting) code += chunks.normalVS;
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
            if (lightType==pc.scene.LIGHTTYPE_DIRECTIONAL) {
                code += "uniform vec3 light" + i + "_direction;\n";
            } else {
                code += "uniform vec3 light" + i + "_position;\n";
                code += "uniform float light" + i + "_radius;\n";
                if (lightType==pc.scene.LIGHTTYPE_SPOT) {
                    code += "uniform vec3 light" + i + "_spotDirection;\n";
                    code += "uniform float light" + i + "_innerConeAngle;\n";
                    code += "uniform float light" + i + "_outerConeAngle;\n";
                }
            }
            if (options.lights[i].getCastShadows()) {
                code += "uniform mat4 light" + i + "_shadowMatrix;\n";
                if (lightType==pc.scene.LIGHTTYPE_POINT) {
                    code += "uniform vec4 light" + i + "_shadowParams;\n"; // Width, height, bias, radius
                } else {
                    code += "uniform vec3 light" + i + "_shadowParams;\n"; // Width, height, bias
                }
                if (lightType==pc.scene.LIGHTTYPE_POINT) {
                    code += "uniform samplerCube light" + i + "_shadowMap;\n";
                } else {
                    code += "uniform sampler2D light" + i + "_shadowMap;\n";
                }
                numShadowLights++;
            }
        }

        switch (options.fog) {
            case 'linear':
                code += getSnippet(device, 'fs_fog_linear_decl');
                break;
            case 'exp':
                code += getSnippet(device, 'fs_fog_exp_decl');
                break;
            case 'exp2':
                code += getSnippet(device, 'fs_fog_exp2_decl');
                break;
        }

        if (options.alphaTest) {
            code += getSnippet(device, 'fs_alpha_test_decl');
        }

        code += "\n"; // End of uniform declarations


        var uvOffset = options.heightMap? " + data.uvOffset" : "";

        if (options.normalMap && useTangents) {
            code += chunks.normalMapPS.replace(/\$UV/g, this._uvSource(options.normalMapTransform) + uvOffset);
            code += chunks.TBNPS;
        } else {
            code += chunks.normalVertexPS;
        }

        code += chunks.defaultGamma;

        if (options.diffuseMap) {
            code += chunks.albedoTexPS.replace(/\$UV/g, this._uvSource(options.diffuseMapTransform) + uvOffset);
        } else {
            code += chunks.albedoColorPS;
        }

        if (options.useSpecular) {
            if (options.specularMap) {
                code += chunks.specularityTexPS.replace(/\$UV/g, this._uvSource(options.specularMapTransform) + uvOffset);
            } else {
                code += chunks.specularityColorPS;
            }
            if (options.useFresnel) {
                code += chunks.defaultFresnel;
            }
        }

        if (options.glossMap) {
            code += chunks.glossinessTexPS.replace(/\$UV/g, this._uvSource(options.glossMapTransform) + uvOffset);
        } else {
            code += chunks.glossinessFloatPS;
        }

        if (options.opacityMap) {
            code += chunks.opacityTexPS.replace(/\$UV/g, this._uvSource(options.opacityMapTransform) + uvOffset);
        } else {
            code += chunks.opacityFloatPS;
        }

        if (options.emissiveMap) {
            code += chunks.emissionTexPS.replace(/\$UV/g, this._uvSource(options.emissiveMapTransform) + uvOffset);
        } else {
            code += chunks.emissionColorPS;
        }

        if (options.heightMap) {
            if (!options.normalMap) code += chunks.TBNPS;
            code += chunks.parallaxPS.replace(/\$UV/g, this._uvSource(options.heightMapTransform));
        }

        if (options.cubeMap) {
            code += chunks.reflectionCubePS;
        }

        if (options.sphereMap) {
            code += device.fragmentUniformsCount>16? chunks.reflectionSpherePS : chunks.reflectionSphereLowPS;
        }


        if (options.lightMap) {
            code += chunks.lightmapSinglePS;
        }

        if (numShadowLights > 0) {
            code += chunks.shadowPS;
        }

        code += chunks.lightDiffuseLambertPS;
        if (options.useSpecular) {
            code += chunks.defaultSpecular;
            if (options.sphereMap || options.cubeMap || options.useFresnel) {
                if (options.useFresnel) {
                    code += chunks.combineDiffuseSpecularPS; // this one is correct, others are old stuff
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

        if (lighting) {
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

        if (lighting && options.useSpecular) {
            code += "   getSpecularity(data);\n";
            if (options.useFresnel) code += "   getFresnel(data);\n";
            code += "   getGlossiness(data);\n";
        }

        code += "   getOpacity(data);\n";
        if (options.alphaTest) {
            code += "   if (data.alpha < alpha_ref) discard;"
        }

        if (options.lightMap) {
                code += "    addLightmap(data);\n";
         }

        code += "   addAmbientConstant(data);\n";
        if (lighting) {
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

                if (lightType==pc.scene.LIGHTTYPE_DIRECTIONAL) {
                    // directional
                    code += "   data.lightDirNormW = light"+i+"_direction;\n";
                    code += "   data.atten = 1.0;\n";
                } else {
                    code += "   getLightDirPoint(data, light"+i+"_position);\n";
                    if (options.lights[i].getFalloffMode()==pc.scene.LIGHTFALLOFF_LINEAR) {
                        code += "   data.atten = getFalloffLinear(data, light"+i+"_radius);\n";
                    } else {
                        code += "   data.atten = getFalloffInvSquared(data, light"+i+"_radius);\n";
                    }
                    if (lightType==pc.scene.LIGHTTYPE_SPOT) {
                        code += "   data.atten *= getSpotEffect(data, light"+i+"_spotDirection, light"+i+"_innerConeAngle, light"+i+"_outerConeAngle);\n";
                    }
                }

                code += "   data.atten *= getLightDiffuse(data);\n";
                if (options.lights[i].getCastShadows()) {
                    if (lightType==pc.scene.LIGHTTYPE_POINT) {
                        code += "   data.atten *= getShadowPoint(data, light"+i+"_shadowMap, light"+i+"_shadowParams);\n";
                    } else {
                        code += "   getShadowCoord(data, light"+i+"_shadowMatrix, light"+i+"_shadowParams);\n";
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
        code += chunks.endPS;

        // Fog
        switch (options.fog) {
            case 'linear':
                code += getSnippet(device, 'fs_fog_linear');
                break;
            case 'exp':
                code += getSnippet(device, 'fs_fog_exp');
                break;
            case 'exp2':
                code += getSnippet(device, 'fs_fog_exp2');
                break;
        }

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
