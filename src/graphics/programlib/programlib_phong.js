pc.gfx.programlib.phong = {
    generateKey: function (options) {
        var key = "phong";
        if (options.skin)                key += "_skin";
        if (options.fog)                 key += "_fog";
        if (options.alphaTest)           key += "_atst";
        if (options.numDirs > 0)         key += "_" + options.numDirs + "dir";
        if (options.numPnts > 0)         key += "_" + options.numPnts + "pnt";
        if (options.numSpts > 0)         key += "_" + options.numSpts + "spt";
        if (options.numSDirs > 0)        key += "_" + options.numSDirs + "sdir";
        if (options.numSPnts > 0)        key += "_" + options.numSPnts + "spnt";
        if (options.numSSpts > 0)        key += "_" + options.numSSpts + "sspt";
        if (options.vertexColors)        key += "_vcol";

        if (options.diffuseMapTransform) {
            key += "_difx"; // Diffuse map with texture transform
        } else if (options.diffuseMap) {
            key += "_difm"; // Diffuse map
        } else {
            key += "_difc"; // Diffuse color
        }

        if (options.specularMapTransform) {
            key += "_spex"; // Specular map with texture transform
        } else if (options.specularMap) {
            key += "_spem"; // Specular map
        } else {
            key += "_spec"; // Specular color
        }

        if (options.specularFactorMapTransform) {
            key += "_spfx"; // Specular factor map with texture transform
        } else if (options.specularFactorMap) {
            key += "_spfm"; // Specular factor map
        }

        if (options.glossMapTransform) {
            key += "_glox"; // Gloss map with texture transform
        } else if (options.glossMap) {
            key += "_glom"; // Gloss map
        }

        if (options.emissiveMapTransform) {
            key += "_emix"; // Emissive map with texture transform
        } else if (options.emissiveMap) {
            key += "_emim"; // Emissive map
        } else {
            key += "_emic"; // Emissive color
        }

        if (options.opacityMapTransform) {
            key += "_opax"; // Opacity map with texture transform
        } else if (options.opacityMap) {
            key += "_opam"; // Opacity map
        }

        if (options.normalMapTransform) {
            key += "_norx"; // Normal map with texture transform
        } else if (options.normalMap) {
            key += "_norm"; // Normal map
        }

        if (options.heightMapTransform) {
            key += "_hgtx"; // Height map with texture transform
        } else if (options.heightMap) {
            key += "_hgtm"; // Height map
        }

        if (options.sphereMap)           key += "_sphr";
        if (options.cubeMap)             key += "_cube";
        if (options.lightMap)            key += "_lght";

        return key;
    },

    generateVertexShader: function (options) {
        var code = "";

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
            (options.specularFactorMap && !options.specularFactorMapTransform) ||
            (options.glossMap && !options.glossMapTransform) ||
            (options.emissiveMap && !options.emissiveMapTransform) ||
            (options.opacityMap && !options.opacityMapTransform) ||
            (options.normalMap && !options.normalMapTransform) ||
            (options.heightMap && !options.heightMapTransform));
        
        // VERTEX SHADER INPUTS: ATTRIBUTES
        code += "attribute vec3 vertex_position;\n";
        if (lighting || options.cubeMap || options.sphereMap) {
            code += "attribute vec3 vertex_normal;\n";
        }
        if (options.diffuseMap || options.specularMap || options.specularFactorMap || options.glossMap ||
            options.emissiveMap || options.normalMap || options.heightMap || options.opacityMap) {
            code += "attribute vec2 vertex_texCoord0;\n";
        }
        if (options.lightMap) {
            code += "attribute vec2 vertex_texCoord1;\n";
        }
        if (options.vertexColors) {
            code += "attribute vec4 vertex_color;\n";
        }
        if (options.skin) {
            code += "attribute vec4 vertex_boneWeights;\n";
            code += "attribute vec4 vertex_boneIndices;\n";
        }
        code += "\n";

        // VERTEX SHADER INPUTS: UNIFORMS
        code += "uniform mat4 matrix_view;\n";
        code += "uniform mat4 matrix_viewProjection;\n";
        code += "uniform mat4 matrix_model;\n";
        if (options.skin) {
            var numBones = pc.gfx.Device.getCurrent().getBoneLimit();
            code += "uniform mat4 matrix_pose[" + numBones + "];\n";
        }
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
        code += "uniform vec3 view_position;\n";
        if (options.diffuseMap && options.diffuseMapTransform) {
            code += "uniform mat4 texture_diffuseMapTransform;\n";
        }
        if (options.normalMap && options.normalMapTransform) {
            code += "uniform mat4 texture_normalMapTransform;\n";
        }
        if (options.heightMap && options.heightMapTransform) {
            code += "uniform mat4 texture_heightMapTransform;\n";
        }
        if (options.opacityMap && options.opacityMapTransform) {
            code += "uniform mat4 texture_opacityMapTransform;\n";
        }
        if (options.specularMap && options.specularMapTransform) {
            code += "uniform mat4 texture_specularMapTransform;\n";
        }
        if (options.specularFactorMap && options.specularFactorMapTransform) {
            code += "uniform mat4 texture_specularFactorMapTransform;\n";
        }
        if (options.glossMap && options.glossMapTransform) {
            code += "uniform mat4 texture_glossMapTransform;\n";
        }
        if (options.emissiveMap && options.emissiveMapTransform) {
            code += "uniform mat4 texture_emissiveMapTransform;\n";
        }
        code += "\n";

        // VERTEX SHADER OUTPUTS
        if (lighting) {
            code += "varying vec3 vNormalW;\n";
            code += "varying vec3 vViewDirW;\n";

            for (i = 0; i < totalLights; i++) {
                code += "varying vec3 vLight" + i + "Dir;\n";
                if (i >= totalDirs + totalPnts) {
                    code += "varying vec3 vLight" + i + "SpotDir;\n";
                }
                if ((i >= options.numDirs && i < totalDirs) || 
                    (i >= totalDirs + options.numPnts && i < totalDirs + totalPnts) || 
                    (i >= totalDirs + totalPnts + options.numSpts && i < totalLights)) {
                    code += "varying vec4 vLight" + i + "ShadowCoord;\n";
                }
            }
        }

        if (mapWithoutTransform) {
            code += "varying vec2 vUv0;\n";
        }
        if (options.diffuseMap && options.diffuseMapTransform) {
            code += "varying vec2 vUvDiffuseMap;\n";
        }
        if (lighting) {
            if (options.specularMap && options.specularMapTransform) {
                code += "varying vec2 vUvSpecularMap;\n";
            }
            if (options.specularFactorMap && options.specularFactorMapTransform) {
                code += "varying vec2 vUvSpecularFactorMap;\n";
            }
            if (options.glossMap && options.glossMapTransform) {
                code += "varying vec2 vUvGlossMap;\n";
            }
            if ((options.normalMap && options.normalMapTransform) || (options.heightMap && options.heightMapTransform)) {
                code += "varying vec2 vUvBumpMap;\n";
            }
        }
        if (options.emissiveMap && options.emissiveMapTransform) {
            code += "varying vec2 vUvEmissiveMap;\n";
        }
        if (options.opacityMap && options.opacityMapTransform) {
            code += "varying vec2 vUvOpacityMap;\n";
        }
        if (options.lightMap) {
            code += "varying vec2 vUvLightMap;\n";
        }

        if (options.vertexColors) {
            code += "varying vec4 vVertexColor;\n";
        }
        code += "\n";

        // VERTEX SHADER BODY
        code += "void main(void)\n";
        code += "{\n";
        // Prepare attribute values into the right formats for the vertex shader
        code += "    vec4 position = vec4(vertex_position, 1.0);\n";
        if (lighting || options.cubeMap || options.sphereMap) {
            code += "    vec4 normal   = vec4(vertex_normal, 0.0);\n";
        }
        code += "\n";

        // Skinning is performed in world space
        if (options.skin) {
            // Skin the necessary vertex attributes
            code += "    vec4 positionW;\n";
            code += "    positionW  = vertex_boneWeights[0] * matrix_pose[int(vertex_boneIndices[0])] * position;\n";
            code += "    positionW += vertex_boneWeights[1] * matrix_pose[int(vertex_boneIndices[1])] * position;\n";
            code += "    positionW += vertex_boneWeights[2] * matrix_pose[int(vertex_boneIndices[2])] * position;\n";
            code += "    positionW += vertex_boneWeights[3] * matrix_pose[int(vertex_boneIndices[3])] * position;\n\n";

            if (lighting || options.cubeMap || options.sphereMap) {
                code += "    vec4 normalW;\n";
                code += "    normalW  = vertex_boneWeights[0] * matrix_pose[int(vertex_boneIndices[0])] * normal;\n";
                code += "    normalW += vertex_boneWeights[1] * matrix_pose[int(vertex_boneIndices[1])] * normal;\n";
                code += "    normalW += vertex_boneWeights[2] * matrix_pose[int(vertex_boneIndices[2])] * normal;\n";
                code += "    normalW += vertex_boneWeights[3] * matrix_pose[int(vertex_boneIndices[3])] * normal;\n\n";
            }
        } else {
            code += "    vec4 positionW = matrix_model * position;\n";
            if (lighting || options.cubeMap || options.sphereMap) {
                code += "    vec4 normalW   = matrix_model * normal;\n";
            }
            code += "\n";
        }

        // Transform to vertex position to screen
        code += "    gl_Position = matrix_viewProjection * positionW;\n\n";

        // Transform vectors required for lighting to eye space
        if (lighting) {
            // Calculate position, normal and light direction in eye space
            code += "    vNormalW = normalW.xyz;\n";
            code += "    vViewDirW = view_position - positionW.xyz;\n";

            for (i = 0; i < totalDirs; i++) {
                code += "    vec3 light" + i + "DirW = -light" + i + "_direction;\n";
            }
            for (i = totalDirs; i < totalLights; i++) {
                code += "    vec3 light" + i + "DirW = light" + i + "_position - positionW.xyz;\n";
                if (i >= totalDirs + totalPnts) {
                    code += "    vec3 light" + i + "SpotDirW = light" + i + "_spotDirection;\n";
                }
            }

            // Transform vertex-view and vertex-light vectors to eye space
            for (i = 0; i < totalLights; i++) {
                code += "    vLight" + i + "Dir = light" + i + "DirW;\n";
                if (i >= totalDirs + totalPnts) {
                    code += "    vLight" + i + "SpotDir = light" + i + "SpotDirW;\n";
                }
                if ((i >= options.numDirs && i < totalDirs) || 
                    (i >= totalDirs + options.numPnts && i < totalDirs + totalPnts) || 
                    (i >= totalDirs + totalPnts + options.numSpts && i < totalLights)) {
                    code += "    vLight" + i + "ShadowCoord = light" + i + "_shadowMatrix * positionW;\n";
                }
            }
            code += "\n";
        }

        if (mapWithoutTransform) {
            code += "    vUv0 = vertex_texCoord0;\n";
        }
        if (options.diffuseMap && options.diffuseMapTransform) {
            code += "    vUvDiffuseMap = (texture_diffuseMapTransform * vec4(vertex_texCoord0, 0, 1)).st;\n";
        }
        if (lighting) {
            if (options.specularMap & options.specularMapTransform) {
                code += "    vUvSpecularMap = (texture_specularMapTransform * vec4(vertex_texCoord0, 0, 1)).st;\n";
            }
            if (options.specularFactorMap && options.specularFactorMapTransform) {
                code += "    vUvSpecularFactorMap = (texture_specularFactorMapTransform * vec4(vertex_texCoord0, 0, 1)).st;\n";
            }
            if (options.normalMap && options.normalMapTransform) {
                code += "    vUvBumpMap = (texture_normalMapTransform * vec4(vertex_texCoord0, 0, 1)).st;\n";
            } else if (options.heightMap && options.heightMapTransform) {
                code += "    vUvBumpMap = (texture_heightMapTransform * vec4(vertex_texCoord0, 0, 1)).st;\n";
            }
        }
        if (options.opacityMap && options.opacityMapTransform) {
            code += "    vUvOpacityMap = (texture_opacityMapTransform * vec4(vertex_texCoord0, 0, 1)).st;\n";
        }
        if (options.emissiveMap && options.emissiveMapTransform) {
            code += "    vUvEmissiveMap = (texture_emissiveMapTransform * vec4(vertex_texCoord0, 0, 1)).st;\n";
        }

        if (options.lightMap) {
            code += "    vUvLightMap = vertex_texCoord1;\n";
        }
        code += "}";
        
        return code;
    },

    generateFragmentShader: function (options) {
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
            (options.specularFactorMap && !options.specularFactorMapTransform) ||
            (options.glossMap && !options.glossMapTransform) ||
            (options.emissiveMap && !options.emissiveMapTransform) ||
            (options.opacityMap && !options.opacityMapTransform) ||
            (options.normalMap && !options.normalMapTransform) ||
            (options.heightMap && !options.heightMapTransform));

        var getSnippet = pc.gfx.programlib.getSnippet;
        var code = getSnippet('fs_precision');

        if (options.normalMap || options.heightMap) {
            code += "#extension GL_OES_standard_derivatives : enable\n\n";
        }

        // FRAGMENT SHADER INPUTS: VARYINGS
        if (lighting) {
            code += "varying vec3 vNormalW;\n";
            code += "varying vec3 vViewDirW;\n";

            for (i = 0; i < totalLights; i++) {
                code += "varying vec3 vLight" + i + "Dir;\n";
                if (i >= totalDirs + totalPnts) {
                    code += "varying vec3 vLight" + i + "SpotDir;\n";
                }
                if ((i >= options.numDirs && i < totalDirs) || 
                    (i >= totalDirs + options.numPnts && i < totalDirs + totalPnts) || 
                    (i >= totalDirs + totalPnts + options.numSpts && i < totalLights)) {
                    code += "varying vec4 vLight" + i + "ShadowCoord;\n";
                }
            }
        }

        if (mapWithoutTransform) {
            code += "varying vec2 vUv0;\n";
        }
        if (options.diffuseMap && options.diffuseMapTransform) {
            code += "varying vec2 vUvDiffuseMap;\n";
        }
        if (lighting) {
            if (options.specularMap && options.specularMapTransform) {
                code += "varying vec2 vUvSpecularMap;\n";
            }
            if (options.specularFactorMap && options.specularFactorMapTransform) {
                code += "varying vec2 vUvSpecularFactorMap;\n";
            }
            if (options.glossMap && options.glossMapTransform) {
                code += "varying vec2 vUvGlossMap;\n";
            }
            if ((options.normalMap && options.normalMapTransform) || (options.heightMap && options.heightMapTransform)) {
                code += "varying vec2 vUvBumpMap;\n";
            }
        }
        if (options.emissiveMap && options.emissiveMapTransform) {
            code += "varying vec2 vUvEmissiveMap;\n";
        }
        if (options.opacityMap && options.opacityMapTransform) {
            code += "varying vec2 vUvOpacityMap;\n";
        }
        if (options.lightMap) {
            code += "varying vec2 vUvLightMap;\n";
        }

        if (options.vertexColors) {
            code += "varying vec4 vVertexColor;\n";
        }
        code += "\n";

        // FRAGMENT SHADER INPUTS: UNIFORMS
        if (!options.diffuseMap) {
            code += "uniform vec3 material_ambient;\n";
            if (lighting) {
                code += "uniform vec3 material_diffuse;\n";
            }
        }
        if (lighting) {
            if (options.specularMap) {
                code += "uniform sampler2D texture_specularMap;\n";
            } else {
                code += "uniform vec3 material_specular;\n";
            }
            if (options.specularFactorMap) {
                code += "uniform sampler2D texture_specularFactorMap;\n";
            }
            if (options.glossMap) {
                code += "uniform sampler2D texture_glossMap;\n";
            } else {
                code += "uniform float material_shininess;\n";
            }
        }
        if (options.emissiveMap) {
            code += "uniform sampler2D texture_emissiveMap;\n";
        } else {
            code += "uniform vec3 material_emissive;\n";
        }
        if (options.diffuseMap) {
            code += "uniform sampler2D texture_diffuseMap;\n";
        }
        if (options.lightMap) {
            code += "uniform sampler2D texture_lightMap;\n";
        }
        if (lighting) {
            if (options.normalMap) {
                code += "uniform sampler2D texture_normalMap;\n";
                code += "uniform float material_bumpMapFactor;\n";
            }
            if (options.heightMap) {
                code += "uniform sampler2D texture_heightMap;\n";
            }
            if (options.cubeMap || options.sphereMap) {
                code += "uniform float material_reflectionFactor;\n";
                if (options.sphereMap) {
                    code += "uniform mat4 matrix_view;\n";
                    code += "uniform sampler2D texture_sphereMap;\n";
                } else { // Cube mapping
                    code += "uniform samplerCube texture_cubeMap;\n";
                }
            }
        }
        if (options.opacityMap) {
            code += "uniform sampler2D texture_opacityMap;\n";
        } else {
            code += "uniform float material_opacity;\n";
        }
        code += "uniform vec3 light_globalAmbient;\n";
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
        if (options.fog) {
            code += getSnippet('fs_fog_decl');
        }
        if (options.alphaTest) {
            code += getSnippet('fs_alpha_test_decl');
        }

        if (options.normalMap) {
            code += getSnippet('fs_normal_map_funcs');
        } else if (options.heightMap) {
            code += getSnippet('fs_height_map_funcs');
        }

        code += "\n"; // End of uniform declarations

        if (numShadowLights > 0) {
            code += "float calculateShadowFactor(const in vec4 sc, const in vec3 sp, const in sampler2D sm)\n";
            code += "{\n";
            code += "    float depth;\n";
            code += "    float depthBias = sp.z;\n";
            code += "    vec3 shadowCoord = sc.xyz / sc.w;\n";
            code += "    shadowCoord.z += depthBias;\n";
            code += "    bvec4 containedVec = bvec4(shadowCoord.x >= 0.0, shadowCoord.x <= 1.0, shadowCoord.y >= 0.0, shadowCoord.y <= 1.0);\n";
            code += "    bool contained = all(bvec2(all(containedVec), shadowCoord.z <= 1.0));\n";
            code += "    if (contained)\n";
            code += "    {\n";
            if (false) {
                code += "        depth = upackRgbaDepthToFloat(texture2D(sm, shadowCoord.xy));\n";
                code += "        return (depth < shadowCoord.z) ? 0.3 : 1.0;\n";
            } else {
                code += "        float shadowAccum = 0.0;\n";
                code += "        const float shadowContrib = 1.0 / 9.0;\n";
                code += "        float xoffset = 1.0 / sp[0];\n"; // 1/shadow map width
                code += "        float yoffset = 1.0 / sp[1];\n"; // 1/shadow map height
                code += "        float xWest = -1.25 * xoffset;\n";
                code += "        float ySouth = -1.25 * yoffset;\n";
                code += "        float xEast = 1.25 * xoffset;\n";
                code += "        float yNorth = 1.25 * yoffset;\n";

                if (pc.gfx.Device.getCurrent().extDepthTexture) {
                    code += "        depth = texture2D(sm, shadowCoord.xy + vec2(xWest, ySouth)).r;\n";
                    code += "        shadowAccum += (depth < shadowCoord.z) ? 0.0 : shadowContrib;\n";

                    code += "        depth = texture2D(sm, shadowCoord.xy + vec2(0.0, ySouth)).r;\n";
                    code += "        shadowAccum += (depth < shadowCoord.z) ? 0.0 : shadowContrib;\n";

                    code += "        depth = texture2D(sm, shadowCoord.xy + vec2(xEast, ySouth)).r;\n";
                    code += "        shadowAccum += (depth < shadowCoord.z) ? 0.0 : shadowContrib;\n";

                    code += "        depth = texture2D(sm, shadowCoord.xy + vec2(xWest, 0.0)).r;\n";
                    code += "        shadowAccum += (depth < shadowCoord.z) ? 0.0 : shadowContrib;\n";

                    code += "        depth = texture2D(sm, shadowCoord.xy)).r;\n";
                    code += "        shadowAccum += (depth < shadowCoord.z) ? 0.0 : shadowContrib;\n";

                    code += "        depth = texture2D(sm, shadowCoord.xy + vec2(xEast, 0.0)).r;\n";
                    code += "        shadowAccum += (depth < shadowCoord.z) ? 0.0 : shadowContrib;\n";

                    code += "        depth = texture2D(sm, shadowCoord.xy + vec2(xWest, yNorth)).r;\n";
                    code += "        shadowAccum += (depth < shadowCoord.z) ? 0.0 : shadowContrib;\n";

                    code += "        depth = texture2D(sm, shadowCoord.xy + vec2(0.0, yNorth)).r;\n";
                    code += "        shadowAccum += (depth < shadowCoord.z) ? 0.0 : shadowContrib;\n";

                    code += "        depth = texture2D(sm, shadowCoord.xy + vec2(xEast, yNorth)).r;\n";
                    code += "        shadowAccum += (depth < shadowCoord.z) ? 0.0 : shadowContrib;\n";
                } else {
                    // Vector equivalent to vec4(1.0/(256.0*256.0*256.0), 1.0/(256.0*256.0), 1.0/256.0, 1.0)";
                    code += "        const vec4 bit_shift = vec4(5.96046e-08, 1.52588e-05, 0.00390625, 1.0);\n";

                    code += "        depth = dot(texture2D(sm, shadowCoord.xy + vec2(xWest, ySouth)), bit_shift);\n";
                    code += "        shadowAccum += (depth < shadowCoord.z) ? 0.0 : shadowContrib;\n";

                    code += "        depth = dot(texture2D(sm, shadowCoord.xy + vec2(0.0, ySouth)), bit_shift);\n";
                    code += "        shadowAccum += (depth < shadowCoord.z) ? 0.0 : shadowContrib;\n";

                    code += "        depth = dot(texture2D(sm, shadowCoord.xy + vec2(xEast, ySouth)), bit_shift);\n";
                    code += "        shadowAccum += (depth < shadowCoord.z) ? 0.0 : shadowContrib;\n";

                    code += "        depth = dot(texture2D(sm, shadowCoord.xy + vec2(xWest, 0.0)), bit_shift);\n";
                    code += "        shadowAccum += (depth < shadowCoord.z) ? 0.0 : shadowContrib;\n";

                    code += "        depth = dot(texture2D(sm, shadowCoord.xy), bit_shift);\n";
                    code += "        shadowAccum += (depth < shadowCoord.z) ? 0.0 : shadowContrib;\n";

                    code += "        depth = dot(texture2D(sm, shadowCoord.xy + vec2(xEast, 0.0)), bit_shift);\n";
                    code += "        shadowAccum += (depth < shadowCoord.z) ? 0.0 : shadowContrib;\n";

                    code += "        depth = dot(texture2D(sm, shadowCoord.xy + vec2(xWest, yNorth)), bit_shift);\n";
                    code += "        shadowAccum += (depth < shadowCoord.z) ? 0.0 : shadowContrib;\n";

                    code += "        depth = dot(texture2D(sm, shadowCoord.xy + vec2(0.0, yNorth)), bit_shift);\n";
                    code += "        shadowAccum += (depth < shadowCoord.z) ? 0.0 : shadowContrib;\n";

                    code += "        depth = dot(texture2D(sm, shadowCoord.xy + vec2(xEast, yNorth)), bit_shift);\n";
                    code += "        shadowAccum += (depth < shadowCoord.z) ? 0.0 : shadowContrib;\n";
                }
                code += "        return shadowAccum;\n";
            }
            code += "    }\n";
            code += "    else\n";
            code += "    {\n";
            code += "        return 1.0;\n";
            code += "    }\n";
            code += "}\n\n";
        }
/*
        if ((totalPnts > 0) || (totalSpts > 0)) {
            code += "\n";
            code += "float calculateAttenuation(float d, float r, float cutoff)\n";
            code += "{\n";
            // calculate normalized light vector and distance to sphere light surface
            code += "    d = max(d - r, 0.0);\n";

            // calculate basic attenuation
            code += "    float denom = d/r + 1.0;\n";
            code += "    float attenuation = 1 / (denom*denom);\n";

            // scale and bias attenuation such that:
            //   attenuation == 0 at extent of max influence
            //   attenuation == 1 when d == 0
            code += "    attenuation = (attenuation - cutoff) / (1 - cutoff);\n";
            code += "    attenuation = max(attenuation, 0);\n";
            code += "    return attenuation;\n";
            code += "}\n";
        }
*/
        // FRAGMENT SHADER BODY
        code += getSnippet('common_main_begin');

        // We can't write to varyings to copy them to temporarys
        if (options.diffuseMap) {
            if (options.diffuseMapTransform) {
                code += "    vec2 uvDiffuseMap = vUvDiffuseMap;\n";
            } else {
                code += "    vec2 uvDiffuseMap = vUv0;\n";
            }
        }

        if (lighting) {
            if (options.specularMap) {
                if (options.specularMapTransform) {
                    code += "    vec2 uvSpecularMap = vUvSpecularMap;\n";
                } else { 
                    code += "    vec2 uvSpecularMap = vUv0;\n";
                }
            }

            if (options.specularFactorMap) {
                if (options.specularFactorMapTransform) {
                    code += "    vec2 uvSpecularFactorMap = vUvSpecularFactorMap;\n";
                } else {
                    code += "    vec2 uvSpecularFactorMap = vUv0;\n";
                }
            }

            if (options.glossMap) {
                if (options.glossMapTransform) {
                    code += "    vec2 uvGlossMap = vUvGlossMap;\n";
                } else { 
                    code += "    vec2 uvGlossMap = vUv0;\n";
                }
            }

            if (options.normalMap || options.heightMap) {
                if (options.normalMapTransform || options.heightMapTransform) {
                    code += "    vec2 uvBumpMap = vUvBumpMap;\n";
                } else {
                    code += "    vec2 uvBumpMap = vUv0;\n";
                }
            }
        }

        if (options.opacityMap) {
            if (options.opacityMapTransform) {
                code += "    vec2 uvOpacityMap = vUvOpacityMap;\n";
            } else {
                code += "    vec2 uvOpacityMap = vUv0;\n";
            }
        }

        if (options.emissiveMap) {
            if (options.emissiveMapTransform) {
                code += "    vec2 uvEmissiveMap = vUvEmissiveMap;\n";
            } else {
                code += "    vec2 uvEmissiveMap = vUv0;\n";
            }
        }

        if (options.lightMap) {
            code += "    vec2 uvLightMap = vUvLightMap;\n";
        }

        // Read the map texels that the shader needs
        if (lighting) {
            code += "    vec3 viewDirW = normalize(vViewDirW);\n";
            code += "    vec3 normalW = normalize(vNormalW);\n";

            if (options.normalMap && options.heightMap) {
                // Shift UV0 if parallax mapping is enabled
                code += "    const float parallaxScale = 0.025;\n";
                code += "    const float parallaxBias = 0.01;\n";
                code += "    float height = texture2D(texture_heightMap, uvBumpMap).a * parallaxScale - parallaxBias;\n";
                code += "    uvBumpMap = uvBumpMap - min(height * viewDirW.xy, vec2(parallaxBias));\n";
                if (options.diffuseMap) {
                    code += "    uvDiffuseMap = uvDiffuseMap - min(height * viewDirW.xy, vec2(parallaxBias));\n";
                }
                if (options.specularMap) {
                    code += "    uvSpecularMap = uvSpecularMap - min(height * viewDirW.xy, vec2(parallaxBias));\n";
                }
            }
        }

        if (options.diffuseMap) {
            code += "    vec4 diffMapPixel = texture2D(texture_diffuseMap, uvDiffuseMap);\n";
        }
        if (lighting) {
            if (options.specularMap) {
                code += "    vec4 specMapPixel = texture2D(texture_specularMap, uvSpecularMap);\n";
            }
            if (options.specularFactorMap) {
                code += "    vec4 specFacMapPixel = texture2D(texture_specularFactorMap, uvSpecularFactorMap);\n";
            }
        }
        if (options.lightMap) {
            code += "    vec4 lghtMapPixel = texture2D(texture_lightMap, uvLightMap);\n";
        }

        if (options.diffuseMap) {
            code += "    gl_FragColor.rgb  = diffMapPixel.rgb * light_globalAmbient;\n";
        } else {
            code += "    gl_FragColor.rgb  = material_ambient * light_globalAmbient;\n";
        }

        if (options.opacityMap) {
            code += "    gl_FragColor.a = texture2D(texture_opacityMap, uvOpacityMap).r;\n";
        } else {
            code += "    gl_FragColor.a = material_opacity;\n";
        }
        if (options.alphaTest) {
            code += getSnippet('fs_alpha_test');
        }

        if (lighting) {
            code += "    vec3 lightDir;\n";
            code += "    vec3 diffuse, specular;\n";
            code += "    vec3 diffuseContrib = vec3(0.0);\n";
            code += "    float specularContrib = 0.0;\n";
            code += "    float d, nDotL;\n";
            if (options.cubeMap || options.sphereMap) {
                code += "    float lambertContrib = 0.0;\n";
            }
            if (numShadowLights > 0) {
                code += "    float shadowFactor = 0.0;\n";
            }
            if (options.normalMap || options.heightMap) {
                // Use a normal extracted from the supplied normal map
                code += "    vec3 N = perturb_normal(normalW, viewDirW, uvBumpMap);\n";
            } else {
                // Use a normal interpolated from vertex normals
                code += "    vec3 N = normalW;\n";
            }

            for (i = 0; i < totalLights; i++) {
                if (i < totalDirs) {
                    code += "    lightDir = normalize(vLight" + i + "Dir);\n";
                    code += "    nDotL = max(0.0, dot(N, lightDir));\n";
                    code += "    if (nDotL > 0.0)\n";
                    code += "    {\n";
                    code += "        diffuseContrib += light" + i + "_color * nDotL;\n";
                    if (options.cubeMap || options.sphereMap) {
                        code += "        lambertContrib += nDotL;\n";
                    } else {
                        if (options.glossMap) {
                            code += "        float shininess = texture2D(texture_glossMap, uvGlossMap).r * 100.0;\n";
                        } else {
                            code += "        float shininess = material_shininess;\n";
                        }
                        code += "        if (shininess > 0.0)\n";
                        code += "        {\n";
                        code += "            vec3 R = normalize(-reflect(lightDir, N));\n";
                        code += "            float rDotV = max(0.0, dot(R, viewDirW));\n";
                        code += "            specularContrib += pow(rDotV, shininess);\n";
                        code += "        }\n";
                    }
                    code += "    }\n";
                } else {
                    code += "    d = length(vLight" + i + "Dir);\n";
                    code += "    if (d < light" + i + "_radius)\n";
                    code += "    {\n";
                    code += "        lightDir = normalize(vLight" + i + "Dir);\n";
                    code += "        nDotL = max(0.0, dot(N, lightDir));\n";
                    code += "        if (nDotL > 0.0)\n";
                    code += "        {\n";
                    code += "            float att = ((light" + i + "_radius - d) / light" + i + "_radius);\n";
//                    code += "            float att = light" + i + "_attenuate ? 1.0 : calculateAttenuation(N, light" + i + "_range, ;\n";
                    if (i >= totalDirs + totalPnts) {
                        code += "            float cosAngle = dot(-lightDir, normalize(vLight" + i + "SpotDir));\n";
                        code += "            float cosInnerAngle = light" + i + "_innerConeAngle;\n";
                        code += "            float cosOuterAngle = light" + i + "_outerConeAngle;\n";
                        code += "            att *= clamp((cosAngle - cosOuterAngle) / (cosInnerAngle - cosOuterAngle), 0.0, 1.0);\n";
                    }
                    code += "            diffuseContrib += light" + i + "_color * nDotL * att;\n";
                    if (options.cubeMap || options.sphereMap) {
                        code += "            lambertContrib += nDotL;\n";
                    } else {
                        if (options.glossMap) {
                            code += "            float shininess = texture2D(texture_glossMap, uvGlossMap).r * 100.0;\n";
                        } else {
                            code += "            float shininess = material_shininess;\n";
                        }
                        code += "            if (shininess > 0.0)\n";
                        code += "            {\n";
                        code += "                vec3 R = normalize(-reflect(lightDir, N));\n";
                        code += "                float rDotV = max(0.0, dot(R, viewDirW));\n";
                        code += "                specularContrib += pow(rDotV, shininess) * att;\n";
                        code += "            }\n";
                    }
                    code += "        }\n";
                    code += "    }\n";
                }

                if ((i >= options.numDirs && i < totalDirs) || 
                    (i >= totalDirs + options.numPnts && i < totalDirs + totalPnts) || 
                    (i >= totalDirs + totalPnts + options.numSpts && i < totalLights)) {
                    code += "    shadowFactor += calculateShadowFactor(vLight" + i + "ShadowCoord, light" + i + "_shadowParams, light" + i + "_shadowMap);\n";
                }
            }

            // Select the sources for material color
            if (options.diffuseMap) {
                code += "    diffuse = diffMapPixel.rgb;\n";
            } else {
                code += "    diffuse = material_diffuse;\n";
            }
            if (options.cubeMap) {
                // Need to factor in lambert term here somehow
                code += "    vec3 reflectW = -reflect(viewDirW, N);\n";
                code += "    specular = textureCube(texture_cubeMap, reflectW).rgb * material_reflectionFactor;\n";
                code += "    specularContrib = 1.0;\n";
            } else if (options.sphereMap) {
                // Reference: http://www.reindelsoftware.com/Documents/Mapping/Mapping.html
                code += "    vec3 reflectW = -reflect(viewDirW, N);\n";
                code += "    vec3 reflectE = (matrix_view * vec4(reflectW, 0.0)).xyz;\n";
                code += "    float m = 2.0 * sqrt( dot(reflectE.xy, reflectE.xy) + (reflectE.z+1.0)*(reflectE.z+1.0) );\n";
                code += "    vec2 sphereMapUv = reflectE.xy / m + 0.5;\n";
                // Need to factor in lambert term here somehow
                code += "    specular = texture2D(texture_sphereMap, sphereMapUv).rgb * lambertContrib * material_reflectionFactor;\n";
                code += "    specularContrib = 1.0;\n";
            } else if (options.specularMap) {
                if (options.specularFactorMap) {
                    code += "    specular = specMapPixel.rgb * specFacMapPixel.rgb;\n";
                } else {
                    code += "    specular = specMapPixel.rgb;\n";
                }
            } else if (options.specularFactorMap) {
                code += "    specular = material_specular * specFacMapPixel.rgb;\n";
            } else {
                code += "    specular = material_specular;\n";
            }

            // Add ambient + diffuse + specular
            if (options.lightMap) {
                code += "    diffuseContrib += lghtMapPixel.rgb;\n";
            }

            if (numShadowLights > 0) {
                if (numShadowLights > 1) {
                    code += "    shadowFactor *= 1.0 / " + numShadowLights + ".0;\n";
                }
                code += "    diffuse = diffuse * shadowFactor;\n";
                code += "    specular = specular * shadowFactor;\n";
            }

            code += "    gl_FragColor.rgb += diffuse * diffuseContrib;\n";
            code += "    gl_FragColor.rgb += specular * specularContrib;\n";
        } else if (options.lightMap) {
            if (options.diffuseMap) {
                code += "    gl_FragColor.rgb += diffMapPixel.rgb * lghtMapPixel.rgb;\n";
            } else {
                code += "    gl_FragColor.rgb += lghtMapPixel.rgb;\n";
            }
        }

        if (options.emissiveMap) {
            code += "    gl_FragColor.rgb += texture2D(texture_emissiveMap, uvEmissiveMap).rgb;\n";
        } else {
            code += "    gl_FragColor.rgb += material_emissive;\n";
        }

        code += getSnippet('fs_clamp');

        if (options.fog) {
            code += getSnippet('fs_fog');
        }

        code += getSnippet('common_main_end');

        return code;
    }
};