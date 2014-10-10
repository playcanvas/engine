pc.gfx.programlib.phong = {
    generateKey: function (device, options) {

        var props = [];
        var key = "phong";
        for(prop in options) {
            props.push(prop+"="+(options[prop]));
        }
        props.sort();
         // The key is quite longer this way and it's not great for string comparisons.
         // However, it frees us from managing key generation after adding each new parameter.
         // We don't create new shaders real-time anyway... so string comparison shouldn't have huge impact.
        for(prop in props) key += "_" + props[prop];
        //console.log(key);

        /* TODO: we shouldn't specify numbers of lights in options!
           Instead we should specify each light as separate option, because we have compilation-time per-light parameters like shadows on/off
           These options may look like:
           "L0"
           "L0_shadow"
           "L0_projMap" // we don't have projection textures for light but may have in future
           etc
        */

        return key;
    },


    // Layers supposed to be more than just separate UV xforms actually. To be implemented.
    // This function makes sure all maps with same xform end up using one xform/varying because we can't waste varyings.
    // There is a problem however if user decides to animate xforms. The assumption then breaks, and all maps initialized with
    // this xform will move as well.
    addLayer: function(existingXforms, existingXformNames, xForm, xFormName) {
        if (!xForm) {
            xForm = new pc.Mat4();
            xFormName = null;
        }

        var i, j, equals;
        for(i=0; i<existingXforms.length; i++) {
            equals = true;
            for(j=0; j<xForm.data.length; j++) {
                if (existingXforms[i].data[j] != xForm.data[j]) {
                    equals = false;
                    break;
                }
            }
            if (equals) {
                return i;
            }
        }

        existingXforms.push(xForm);
        existingXformNames.push(xFormName);
        return existingXforms.length-1;
    },


    createShaderDefinition: function (device, options) {
        var i;
        var numNormalLights = options.numDirs + options.numPnts + options.numSpts;
        var numShadowLights = options.numSDirs + options.numSPnts + options.numSSpts;
        var totalDirs = options.numDirs + options.numSDirs;
        var totalPnts = options.numPnts + options.numSPnts;
        var totalSpts = options.numSpts + options.numSSpts;
        var totalLights = numNormalLights + numShadowLights;
        var lighting = totalLights > 0;
        var mapWithoutTransform =
           ((options.diffuseMap && !options.diffuseMapTransform) ||
            (options.specularMap && !options.specularMapTransform) ||
            (options.glossMap && !options.glossMapTransform) ||
            (options.emissiveMap && !options.emissiveMapTransform) ||
            (options.opacityMap && !options.opacityMapTransform) ||
            (options.normalMap && !options.normalMapTransform) ||
            (options.heightMap && !options.heightMapTransform));
        var useTangents = pc.gfx.precalculatedTangents;

        ////////////////////////////
        // GENERATE VERTEX SHADER //
        ////////////////////////////
        var getSnippet = pc.gfx.programlib.getSnippet;
        var code = '';
        var codeBody = '';

        var chunks = pc.gfx.shaderChunks;
        code += chunks.baseVS;

        var attributes = {
            vertex_position: pc.gfx.SEMANTIC_POSITION
        }
        codeBody += "   vPositionW    = getWorldPosition(data);\n";

        if (lighting || options.cubeMap || options.sphereMap) {
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

            // Count layers
            var layerXforms = [];
            var layerXformNames = [];
            var diffuseLayer =  this.addLayer(layerXforms, layerXformNames, options.diffuseMapTransform, "texture_diffuseMapTransform");
            var normalLayer =   this.addLayer(layerXforms, layerXformNames, options.diffuseMapTransform, "texture_normalMapTransform");
            var heightLayer =   this.addLayer(layerXforms, layerXformNames, options.heightMapTransform, "texture_heightMapTransform");
            var opacityLayer =  this.addLayer(layerXforms, layerXformNames, options.opacityMapTransform, "texture_opacityMapTransform");
            var specularLayer = this.addLayer(layerXforms, layerXformNames, options.specularMapTransform, "texture_specularMapTransform");
            var glossLayer =    this.addLayer(layerXforms, layerXformNames, options.glossMapTransform, "texture_glossMapTransform");
            var emissiveLayer = this.addLayer(layerXforms, layerXformNames, options.emissiveMapTransform, "texture_emissiveMapTransform");

            for(i=0; i<layerXforms.length; i++) {
                if (!layerXformNames[i]) {
                    codeBody += "   vUvLayer"+i+"   = uv0;\n";
                } else {
                    codeBody += "   vUvLayer"+i+"   = ("+layerXformNames[i]+" * vec4(uv0, 0, 1)).st;\n";
                }
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
        } else {
            code += chunks.transformVS;
        }

        code += "\n";
        code += chunks.positionWorldSpaceVS;

        code += chunks.startVS;
        code += codeBody;
        code += "}";

        var vshader = code;
        //console.log(vshader);


        //////////////////////////////
        // GENERATE FRAGMENT SHADER //
        //////////////////////////////
        code = getSnippet(device, 'fs_precision');

        /*if ((options.normalMap && !useTangents) || options.heightMap) {
            code += "#extension GL_OES_standard_derivatives : enable\n\n";
        }*/

        code += chunks.basePS;

        // FRAGMENT SHADER INPUTS: UNIFORMS
        for (i = 0; i < totalLights; i++) {
            if (i < totalDirs) {
                code += "uniform vec3 light" + i + "_direction;\n";
            }
            if (i >= totalDirs) {
                code += "uniform vec3 light" + i + "_position;\n";
            }
            if (i >= totalDirs + totalPnts) {
                code += "uniform vec3 light" + i + "_spotDirection;\n";
            }
            if ((i >= options.numDirs && i < totalDirs) ||
                (i >= totalDirs + options.numPnts && i < totalDirs + totalPnts) ||
                (i >= totalDirs + totalPnts + options.numSpts && i < totalLights)) {
                code += "uniform mat4 light" + i + "_shadowMatrix;\n";
            }
        }

        for (i = 0; i < totalLights; i++) {
            code += "uniform vec3 light" + i + "_color;\n";
            if (i >= totalDirs) {
                code += "uniform float light" + i + "_radius;\n";
                if (i >= totalDirs + totalPnts) {
                    code += "uniform float light" + i + "_innerConeAngle;\n";
                    code += "uniform float light" + i + "_outerConeAngle;\n";
                }
            }
            if ((i >= options.numDirs && i < totalDirs) ||
                (i >= totalDirs + options.numPnts && i < totalDirs + totalPnts) ||
                (i >= totalDirs + totalPnts + options.numSpts && i < totalLights)) {
                code += "uniform vec3 light" + i + "_shadowParams;\n"; // Width, height, bias
                code += "uniform sampler2D light" + i + "_shadowMap;\n";
            }
        }
        /*if (numShadowLights > 0) {
            code += "uniform bool shadow_enable;\n"; // do we really need it?
        }*/

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

        // do we really need it?
        /*if (options.normalMap) {
            code += getSnippet(device, 'fs_normal_map_funcs');
        } else if (options.heightMap) {
            code += getSnippet(device, 'fs_height_map_funcs');
        }*/

        code += "\n"; // End of uniform declarations


        var uvLayerSource = options.heightMap? "data.uvLayer" : "vUvLayer";

        if (options.normalMap && useTangents) {
            code += chunks.normalMapPS.replace(/\$LAYER/g, uvLayerSource+normalLayer);
            code += chunks.TBNPS;
        } else {
            code += chunks.normalVertexPS
        }

        code += chunks.gamma1_0PS;

        if (options.diffuseMap) {
            code += chunks.albedoTexPS.replace(/\$LAYER/g, uvLayerSource+diffuseLayer);
        } else {
            code += chunks.albedoColorPS;
        }

        if (options.specularMap) {
            code += chunks.specularityTexPS.replace(/\$LAYER/g, uvLayerSource+specularLayer);
        } else {
            code += chunks.specularityColorPS;
        }

        if (options.glossMap) {
            code += chunks.glossinessTexPS.replace(/\$LAYER/g, uvLayerSource+glossLayer);
        } else {
            code += chunks.glossinessFloatPS;
        }

        if (options.opacityMap) {
            code += chunks.alphaTexPS.replace(/\$LAYER/g, uvLayerSource+opacityLayer);
        } else {
            code += chunks.alphaFloatPS;
        }

        if (options.emissiveMap) {
            code += chunks.emissionTexPS.replace(/\$LAYER/g, uvLayerSource+emissiveLayer);
        } else {
            code += chunks.emissionColorPS;
        }

        if (options.heightMap) {
            if (!options.normalMap) code += chunks.TBNPS;
            code += chunks.parallaxPS.replace(/\$LAYER/g, uvLayerSource+heightLayer);
            for(i=0; i<layerXforms.length; i++) {
                code += chunks.parallaxApplyPS.replace(/\$LAYER/g, uvLayerSource+i);
            }
            code += "}\n";
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
        code += chunks.lightSpecularPhongPS;
        if (options.sphereMap || options.cubeMap) {
            code += chunks.combineDiffuseSpecularPS;
        } else {
            if (options.diffuseMap) {
                code += chunks.combineDiffuseSpecularNoReflPS;
            } else {
                code += chunks.combineDiffuseSpecularNoReflSeparateAmbientPS;
            }
        }

        // FRAGMENT SHADER BODY
        code += chunks.startPS;

        if (lighting) {
            code += "   getViewDir(data);\n";
            if (options.heightMap || options.normalMap) {
                code += "   getTBN(data);\n";
            }
            if (options.heightMap) {
                for(i=0; i<layerXforms.length; i++) {
                    code += "   data.uvLayer"+i+" = vUvLayer"+i+";\n";
                }
                code += "    getParallax(data);\n"
            }
            code += "   getNormal(data);\n";
            code += "   getReflDir(data);\n";
        }

        code += "   getAlbedo(data);\n";

        if (lighting) { // should we probably have separate option for specular?
            code += "   getSpecularity(data);\n";
            code += "   getGlossiness(data);\n";
        }

        code += "   getAlpha(data);\n";
        if (options.alphaTest) {
            code += "   if (data.alpha < alpha_ref) discard;"
        }

        if (options.lightMap) {
                code += "    addLightmap(data);\n";
         }

        if (lighting) {
            code += "   addAmbientConstant(data);\n";

            if (options.cubeMap) {
                code += "   addCubemapReflection(data);\n";
            } else if (options.sphereMap) {
                code += "   addSpheremapReflection(data);\n";
            }

            for (i = 0; i < totalLights; i++) {
                var positionalLight = i >= totalDirs;
                var spotLight = i >= totalDirs + totalPnts;
                var shadowLight =
                   ((i >= options.numDirs && i < totalDirs) ||
                    (i >= totalDirs + options.numPnts && i < totalDirs + totalPnts) ||
                    (i >= totalDirs + totalPnts + options.numSpts && i < totalLights));

                code += "\n";
                // The following lights are not decoupled to separate files, because most of them can be actually changed to achieve different behaviours like:
                // - different falloffs
                // - different shadow coords (point shadows will use drastically different genShadowCoord)
                // - different shadow filter modes

                // getLightDiffuse and getLightSpecular is BRDF (currently lame Lambert+Phong) itself.

                if ((!positionalLight) && (!spotLight)) {
                    // directional
                    code += "   data.lightDirNormW = light"+i+"_direction;\n";
                    code += "   data.atten = 1.0;\n";
                } else if (positionalLight) {
                    code += "   getLightDirPoint(data, light"+i+"_position);\n";
                    code += "   data.atten = getFalloffLinear(data, light"+i+"_radius);\n";
                    if (spotLight) {
                        code += "   data.atten *= getSpotEffect(data, light"+i+"_spotDirection, light"+i+"_innerConeAngle, light"+i+"_outerConeAngle);\n";
                    }
                }

                code += "   data.atten *= getLightDiffuse(data);\n";
                if (shadowLight) {
                    code += "   getShadowCoord(data, light"+i+"_shadowMatrix, light"+i+"_shadowParams);\n";
                    code += "   data.atten *= getShadowPCF3x3(data, light"+i+"_shadowMap, light"+i+"_shadowParams);\n";
                }

                code += "   data.diffuseLight += data.atten * light"+i+"_color;\n";

                code += "   data.atten *= getLightSpecular(data);\n"
                code += "   data.specularLight += data.atten * light"+i+"_color;\n";
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
