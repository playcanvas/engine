pc.gfx.programlib.phong = {
    generateKey: function (device, options) {
        var key = "phong";
        if (options.skin)                key += "_skin";
        switch (options.fog) {
            case 'none':
                key += "_fogn";
                break;
            case 'linear':
                key += "_fogl";
                break;
            case 'exp2':
                key += "_foge";
                break;
        }
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

        /////////////////////////
        // GENERATE ATTRIBUTES //
        /////////////////////////
        var attributes = {
            vertex_position: pc.gfx.SEMANTIC_POSITION
        }
        if (lighting || options.cubeMap || options.sphereMap) {
            attributes.vertex_normal = pc.gfx.SEMANTIC_NORMAL;
            if (options.normalMap && useTangents) {
                attributes.vertex_tangent = pc.gfx.SEMANTIC_TANGENT;
            }
        }
        if (options.diffuseMap || options.specularMap || options.glossMap ||
            options.emissiveMap || options.normalMap || options.heightMap || options.opacityMap) {
            attributes.vertex_texCoord0 = pc.gfx.SEMANTIC_TEXCOORD0;
        }
        if (options.lightMap) {
            attributes.vertex_texCoord1 = pc.gfx.SEMANTIC_TEXCOORD1;
        }
        if (options.vertexColors) {
            attributes.vertex_color = pc.gfx.SEMANTIC_COLOR;
        }
        if (options.skin) {
            attributes.vertex_boneWeights = pc.gfx.SEMANTIC_BLENDWEIGHT;
            attributes.vertex_boneIndices = pc.gfx.SEMANTIC_BLENDINDICES;
        }

        ////////////////////////////
        // GENERATE VERTEX SHADER //
        ////////////////////////////
        var getSnippet = pc.gfx.programlib.getSnippet;
        var code = '';

        // VERTEX SHADER INPUTS: ATTRIBUTES
        code += "attribute vec3 vertex_position;\n";
        if (lighting || options.cubeMap || options.sphereMap) {
            code += "attribute vec3 vertex_normal;\n";
            if (options.normalMap && useTangents) {
                code += "attribute vec4 vertex_tangent;\n";
            }
        }
        if (options.diffuseMap || options.specularMap || options.glossMap ||
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
        code += "uniform mat4 matrix_viewProjection;\n";
        code += "uniform mat4 matrix_model;\n";
        if (lighting) {
            code += "uniform mat3 matrix_normal;\n";
        }
        if (options.skin) {
            var numBones = device.getBoneLimit();
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
        if (lighting) {
            code += "uniform vec3 view_position;\n";
        }
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
        if (options.glossMap && options.glossMapTransform) {
            code += "uniform mat4 texture_glossMapTransform;\n";
        }
        if (options.emissiveMap && options.emissiveMapTransform) {
            code += "uniform mat4 texture_emissiveMapTransform;\n";
        }
        code += "\n";

        // VERTEX SHADER OUTPUTS
        if (lighting) {
            if (!(options.normalMap && useTangents)) {
                code += "varying vec3 vNormalW;\n";
            }
            code += "varying vec3 vViewDirW;\n";

            for (i = 0; i < totalLights; i++) {
                code += "varying vec3 vLight" + i + "DirW;\n";
                if (i >= totalDirs + totalPnts) {
                    code += "varying vec3 vLight" + i + "SpotDirW;\n";
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
            code += "    vec4 normal = vec4(vertex_normal, 0.0);\n";
            if (options.normalMap && useTangents) {
                code += "    vec4 tangent = vec4(vertex_tangent.xyz, 0.0);\n";
            }
        }
        code += "\n";

        // Skinning is performed in world space
        if (options.skin) {
            // Skin the necessary vertex attributes
            code += "    mat4 model = vertex_boneWeights.x * matrix_pose[int(vertex_boneIndices.x)] +\n";
            code += "                 vertex_boneWeights.y * matrix_pose[int(vertex_boneIndices.y)] +\n";
            code += "                 vertex_boneWeights.z * matrix_pose[int(vertex_boneIndices.z)] +\n";
            code += "                 vertex_boneWeights.w * matrix_pose[int(vertex_boneIndices.w)];\n";
            code += "    vec4 positionW = model * position;\n";

            if (lighting || options.cubeMap || options.sphereMap) {
                code += "    vec3 normalW = (model * normal).xyz;\n";

                if (options.normalMap && useTangents) {
                    code += "    vec3 tangentW = (model * tangent).xyz;\n";
                }
            }
        } else {
            code += "    vec4 positionW = matrix_model * position;\n";
            if (lighting || options.cubeMap || options.sphereMap) {
                code += "    vec3 normalW = matrix_normal * normal.xyz;\n";
                if (options.normalMap && useTangents) {
                    code += "    vec3 tangentW = matrix_normal * tangent.xyz;\n";
                }
            }
            code += "\n";
        }

        if (lighting || options.cubeMap || options.sphereMap) {
            code += "    normalW = normalize(normalW);\n";
            if (options.normalMap && useTangents) {
                code += "    tangentW  = normalize(tangentW);\n";
            }
            code += "\n";
        }

        // Transform to vertex position to screen
        code += "    gl_Position = matrix_viewProjection * positionW;\n\n";

        // Transform vectors required for lighting to eye space
        if (lighting) {
            if (options.normalMap && useTangents) {
                // Calculate the tangent space basis vectors
                code += "    vec3 binormalW = cross(normalW, tangentW) * vertex_tangent.w;\n";
                code += "    mat3 tbnMatrix = mat3(tangentW.x, binormalW.x, normalW.x,\n";
                code += "                          tangentW.y, binormalW.y, normalW.y,\n";
                code += "                          tangentW.z, binormalW.z, normalW.z);\n";
                code += "    vViewDirW = tbnMatrix * (view_position - positionW.xyz);\n";

                for (i = 0; i < totalLights; i++) {
                    if (i < totalDirs) {
                        code += "    vLight" + i + "DirW = -(tbnMatrix * light" + i + "_direction);\n";
                    }
                    if (i >= totalDirs) {
                        code += "    vLight" + i + "DirW = tbnMatrix * (light" + i + "_position - positionW.xyz);\n";
                    }
                    if (i >= totalDirs + totalPnts) {
                        code += "    vLight" + i + "SpotDirW = tbnMatrix * light" + i + "_spotDirection;\n";
                    }
                }
            } else {
                code += "    vNormalW = normalW;\n";
                code += "    vViewDirW = view_position - positionW.xyz;\n";

                for (i = 0; i < totalLights; i++) {
                    if (i < totalDirs) {
                        code += "    vLight" + i + "DirW = -light" + i + "_direction;\n";
                    }
                    if (i >= totalDirs) {
                        code += "    vLight" + i + "DirW = light" + i + "_position - positionW.xyz;\n";
                    }
                    if (i >= totalDirs + totalPnts) {
                        code += "    vLight" + i + "SpotDirW = light" + i + "_spotDirection;\n";
                    }
                }
            }

            for (i = 0; i < totalLights; i++) {
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
            if (options.glossMap & options.glossMapTransform) {
                code += "    vUvGlossMap = (texture_glossMapTransform * vec4(vertex_texCoord0, 0, 1)).st;\n";
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
        
        var vshader = code;

        //////////////////////////////
        // GENERATE FRAGMENT SHADER //
        //////////////////////////////
        code = getSnippet(device, 'fs_precision');

        if ((options.normalMap && !useTangents) || options.heightMap) {
            code += "#extension GL_OES_standard_derivatives : enable\n\n";
        }

        // FRAGMENT SHADER INPUTS: VARYINGS
        if (lighting) {
            if (!(options.normalMap && useTangents)) {
                code += "varying vec3 vNormalW;\n";
            }
            code += "varying vec3 vViewDirW;\n";

            for (i = 0; i < totalLights; i++) {
                code += "varying vec3 vLight" + i + "DirW;\n";
                if (i >= totalDirs + totalPnts) {
                    code += "varying vec3 vLight" + i + "SpotDirW;\n";
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
        if (options.diffuseMap) {
            code += "uniform sampler2D texture_diffuseMap;\n";
        } else {
            code += "uniform vec3 material_ambient;\n";
            code += "uniform vec3 material_diffuse;\n";
        }
        if (lighting) {
            if (options.specularMap) {
                code += "uniform sampler2D texture_specularMap;\n";
            } else {
                code += "uniform vec3 material_specular;\n";
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
        code += getSnippet(device, 'fs_alpha_test_decl');

        if (options.normalMap) {
            code += getSnippet(device, 'fs_normal_map_funcs');
        } else if (options.heightMap) {
            code += getSnippet(device, 'fs_height_map_funcs');
        }

        code += "\n"; // End of uniform declarations

        if (numShadowLights > 0) {
            code += 'float unpackFloat(vec4 rgbaDepth)\n';
            code += '{\n';
            code += '    const vec4 bitShift = vec4(1.0 / (256.0 * 256.0 * 256.0), 1.0 / (256.0 * 256.0), 1.0 / 256.0, 1.0);\n';
            code += '    float depth = dot(rgbaDepth, bitShift);\n';
            code += '    return depth;\n';
            code += '}\n\n';

            code += "float calculateShadowFactor(const in vec4 sc, const in vec3 sp, const in sampler2D shadowMap)\n";
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
                code += "        depth = upackRgbaDepthToFloat(texture2D(shadowMap, shadowCoord.xy));\n";
                code += "        return (depth < shadowCoord.z) ? 0.3 : 1.0;\n";
            } else {
                code += "        float shadowAccum = 0.0;\n";

/*
                code += "        const float shadowContrib = 1.0 / 9.0;\n";
                code += "        float xoffset = 1.0 / sp[0];\n"; // 1/shadow map width
                code += "        float yoffset = 1.0 / sp[1];\n"; // 1/shadow map height
                code += "        float dx0 = -1.25 * xoffset;\n";
                code += "        float dy0 = -1.25 * yoffset;\n";
                code += "        float dx1 = 1.25 * xoffset;\n";
                code += "        float dy1 = 1.25 * yoffset;\n";

                // Vector equivalent to vec4(1.0/(256.0*256.0*256.0), 1.0/(256.0*256.0), 1.0/256.0, 1.0)";
                code += "        const vec4 bit_shift = vec4(5.96046e-08, 1.52588e-05, 0.00390625, 1.0);\n";

                code += "        depth = dot(texture2D(shadowMap, shadowCoord.xy + vec2(dx0, dy0)), bit_shift);\n";
                code += "        shadowAccum += (depth < shadowCoord.z) ? 0.0 : shadowContrib;\n";

                code += "        depth = dot(texture2D(shadowMap, shadowCoord.xy + vec2(0.0, dy0)), bit_shift);\n";
                code += "        shadowAccum += (depth < shadowCoord.z) ? 0.0 : shadowContrib;\n";

                code += "        depth = dot(texture2D(shadowMap, shadowCoord.xy + vec2(dx1, dy0)), bit_shift);\n";
                code += "        shadowAccum += (depth < shadowCoord.z) ? 0.0 : shadowContrib;\n";

                code += "        depth = dot(texture2D(shadowMap, shadowCoord.xy + vec2(dx0, 0.0)), bit_shift);\n";
                code += "        shadowAccum += (depth < shadowCoord.z) ? 0.0 : shadowContrib;\n";

                code += "        depth = dot(texture2D(shadowMap, shadowCoord.xy), bit_shift);\n";
                code += "        shadowAccum += (depth < shadowCoord.z) ? 0.0 : shadowContrib;\n";

                code += "        depth = dot(texture2D(shadowMap, shadowCoord.xy + vec2(dx1, 0.0)), bit_shift);\n";
                code += "        shadowAccum += (depth < shadowCoord.z) ? 0.0 : shadowContrib;\n";

                code += "        depth = dot(texture2D(shadowMap, shadowCoord.xy + vec2(dx0, dy1)), bit_shift);\n";
                code += "        shadowAccum += (depth < shadowCoord.z) ? 0.0 : shadowContrib;\n";

                code += "        depth = dot(texture2D(shadowMap, shadowCoord.xy + vec2(0.0, dy1)), bit_shift);\n";
                code += "        shadowAccum += (depth < shadowCoord.z) ? 0.0 : shadowContrib;\n";

                code += "        depth = dot(texture2D(shadowMap, shadowCoord.xy + vec2(dx1, dy1)), bit_shift);\n";
                code += "        shadowAccum += (depth < shadowCoord.z) ? 0.0 : shadowContrib;\n";
*/

                code += "        float xoffset = 1.0 / sp[0];\n"; // 1/shadow map width
                code += "        float yoffset = 1.0 / sp[1];\n"; // 1/shadow map height
                code += "        float dx0 = -xoffset;\n";
                code += "        float dy0 = -yoffset;\n";
                code += "        float dx1 = xoffset;\n";
                code += "        float dy1 = yoffset;\n";

                code += "        mat3 shadowKernel;\n",
                code += "        mat3 depthKernel;\n",

                code += "        depthKernel[0][0] = unpackFloat(texture2D(shadowMap, shadowCoord.xy + vec2(dx0, dy0)));\n";
                code += "        depthKernel[0][1] = unpackFloat(texture2D(shadowMap, shadowCoord.xy + vec2(dx0, 0.0)));\n";
                code += "        depthKernel[0][2] = unpackFloat(texture2D(shadowMap, shadowCoord.xy + vec2(dx0, dy1)));\n";
                code += "        depthKernel[1][0] = unpackFloat(texture2D(shadowMap, shadowCoord.xy + vec2(0.0, dy0)));\n";
                code += "        depthKernel[1][1] = unpackFloat(texture2D(shadowMap, shadowCoord.xy));\n";
                code += "        depthKernel[1][2] = unpackFloat(texture2D(shadowMap, shadowCoord.xy + vec2(0.0, dy1)));\n";
                code += "        depthKernel[2][0] = unpackFloat(texture2D(shadowMap, shadowCoord.xy + vec2(dx1, dy0)));\n";
                code += "        depthKernel[2][1] = unpackFloat(texture2D(shadowMap, shadowCoord.xy + vec2(dx1, 0.0)));\n";
                code += "        depthKernel[2][2] = unpackFloat(texture2D(shadowMap, shadowCoord.xy + vec2(dx1, dy1)));\n";

                code += "        vec3 shadowZ = vec3(shadowCoord.z);\n";
                code += "        shadowKernel[0] = vec3(lessThan(depthKernel[0], shadowZ));\n";
                code += "        shadowKernel[0] *= vec3(0.25);\n";
                code += "        shadowKernel[1] = vec3(lessThan(depthKernel[1], shadowZ));\n";
                code += "        shadowKernel[1] *= vec3(0.25);\n";
                code += "        shadowKernel[2] = vec3(lessThan(depthKernel[2], shadowZ));\n";
                code += "        shadowKernel[2] *= vec3(0.25);\n";

                code += "        vec2 fractionalCoord = 1.0 - fract( shadowCoord.xy * sp.xy );\n";

                code += "        shadowKernel[0] = mix(shadowKernel[1], shadowKernel[0], fractionalCoord.x);\n";
                code += "        shadowKernel[1] = mix(shadowKernel[2], shadowKernel[1], fractionalCoord.x);\n";

                code += "        vec4 shadowValues;\n";
                code += "        shadowValues.x = mix(shadowKernel[0][1], shadowKernel[0][0], fractionalCoord.y);\n";
                code += "        shadowValues.y = mix(shadowKernel[0][2], shadowKernel[0][1], fractionalCoord.y);\n";
                code += "        shadowValues.z = mix(shadowKernel[1][1], shadowKernel[1][0], fractionalCoord.y);\n";
                code += "        shadowValues.w = mix(shadowKernel[1][2], shadowKernel[1][1], fractionalCoord.y);\n";

                code += "        shadowAccum = 1.0 - dot( shadowValues, vec4( 1.0 ) );\n";

                code += "        return shadowAccum;\n";
            }
            code += "    }\n";
            code += "    else\n";
            code += "    {\n";
            code += "        return 1.0;\n";
            code += "    }\n";
            code += "}\n\n";
        }

        // FRAGMENT SHADER BODY
        code += getSnippet(device, 'common_main_begin');

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
            if (!(options.normalMap && useTangents)) {
                code += "    vec3 normalW = normalize(vNormalW);\n";
            }

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
            code += "\n";
        }

        // Select the sources for material color
        if (options.diffuseMap) {
            code += "    vec3 diffuseColor = texture2D(texture_diffuseMap, uvDiffuseMap).rgb;\n";
            code += "    vec3 ambientColor = diffuseColor;\n";
        } else {
            code += "    vec3 ambientColor = material_ambient;\n";
            code += "    vec3 diffuseColor = material_diffuse;\n";
        }
        if (lighting) {
            if (options.specularMap) {
                code += "    vec3 specularColor = texture2D(texture_specularMap, uvSpecularMap).rgb;\n";
            } else {
                code += "    vec3 specularColor = material_specular;\n";
            }
            // Hack: On Mac OS X, calling pow with zero for the exponent generates hideous artifacts so bias up a little
            if (options.glossMap) {
                code += "    float shininess = texture2D(texture_glossMap, uvGlossMap).r * 100.0 + 0.0001;\n";
            } else {
                code += "    float shininess = material_shininess + 0.0001;\n";
            }
        }
        if (options.emissiveMap) {
            code += "    vec3 emissiveColor = texture2D(texture_emissiveMap, uvEmissiveMap).rgb;\n";
        } else {
            code += "    vec3 emissiveColor = material_emissive;\n";
        }
        if (options.opacityMap) {
            code += "    float opacity = texture2D(texture_opacityMap, uvOpacityMap).r;\n";
        } else {
            code += "    float opacity = material_opacity;\n";
        }
        code += "\n";

        if (lighting || options.lightMap) {
            code += "    vec3 diffuseContrib = vec3(0.0);\n";
        }

        if (lighting) {
            code += "    vec3 specularContrib = vec3(0.0);\n";

            // Calculate a surface normal
            if (options.normalMap) {
                if (useTangents) {
                    code += "    vec3 N = normalize(texture2D(texture_normalMap, uvBumpMap).xyz * 2.0 - 1.0);\n";
                    code += "    N = normalize(mix(vec3(0.0, 0.0, 1.0), N, material_bumpMapFactor));\n";
                } else {
                    code += "    vec3 N = perturb_normal(normalW, viewDirW, uvBumpMap);\n";
                }
            } else {
                // Use a normal interpolated from vertex normals
                code += "    vec3 N = normalW;\n";
            }

            code += "    vec3 L, R;\n";
            code += "    float diffuseLight, specularLight;\n";
            if (totalPnts + totalSpts > 0) {
                code += "    float d, attenuation;\n";
            }
            if (totalSpts > 0) {
                code += "    float cosAngle, spotEffect;\n";
            }
            if (numShadowLights > 0) {
                code += "    float shadowFactor;\n";
            }
            code += "\n";

            for (i = 0; i < totalLights; i++) {
                var positionalLight = i >= totalDirs;
                var spotLight = i >= totalDirs + totalPnts;
                var shadowLight =
                   ((i >= options.numDirs && i < totalDirs) || 
                    (i >= totalDirs + options.numPnts && i < totalDirs + totalPnts) || 
                    (i >= totalDirs + totalPnts + options.numSpts && i < totalLights));

                code += "    L = normalize(vLight" + i + "DirW);\n";
                code += "    diffuseLight = max(dot(N, L), 0.0);\n";
                code += "    R = normalize(-reflect(L, N));\n";
                code += "    specularLight = pow(max(dot(R, viewDirW), 0.0), shininess);\n";
                if (positionalLight) {
                    // Linear attenuation
                    code += "    d = length(vLight" + i + "DirW);\n";
                    code += "    attenuation = max(((light" + i + "_radius - d) / light" + i + "_radius), 0.0);\n";
                }
                if (spotLight) {
                    // Spotlight inner cone -> outer cone
                    code += "    cosAngle = dot(-L, vLight" + i + "SpotDirW);\n";
                    code += "    spotEffect = smoothstep(light" + i + "_outerConeAngle, light" + i + "_innerConeAngle, cosAngle);\n";
                }
                if (shadowLight) {
                    code += "    shadowFactor = calculateShadowFactor(vLight" + i + "ShadowCoord, light" + i + "_shadowParams, light" + i + "_shadowMap);\n";
                }
                code += "    diffuseContrib += light" + i + "_color * diffuseLight" + (positionalLight ? " * attenuation" : "") + (spotLight ? " * spotEffect" : "") + (shadowLight ? " * shadowFactor" : "") + ";\n";
                code += "    if (diffuseLight <= 0.0) specularLight = 0.0;\n";
                code += "    specularContrib += light" + i + "_color * specularLight" + (positionalLight ? " * attenuation" : "") + (spotLight ? " * spotEffect" : "") + (shadowLight ? " * shadowFactor" : "") + ";\n\n";
            }
        }

        // Process light map
        if (options.lightMap) {
            code += "    diffuseContrib += texture2D(texture_lightMap, uvLightMap).rgb;\n";
        }

        // Process reflection map
        if (lighting) {
            if (options.cubeMap || options.sphereMap) {
                code += "    vec3 reflectW = -reflect(viewDirW, N);\n";
                if (options.cubeMap) {
                    // Need to factor in lambert term here somehow
                    code += "    vec3 reflectionColor = textureCube(texture_cubeMap, reflectW).rgb;\n";
                } else if (options.sphereMap) {
                    // Reference: http://www.reindelsoftware.com/Documents/Mapping/Mapping.html
                    code += "    vec3 reflectE = (matrix_view * vec4(reflectW, 0.0)).xyz;\n";
                    code += "    float m = 2.0 * sqrt( dot(reflectE.xy, reflectE.xy) + (reflectE.z+1.0)*(reflectE.z+1.0) );\n";
                    code += "    vec2 sphereMapUv = reflectE.xy / m + 0.5;\n";
                    code += "    vec3 reflectionColor = texture2D(texture_sphereMap, sphereMapUv).rgb;\n";
                }
                code += "    diffuseColor = mix(diffuseColor, reflectionColor, material_reflectionFactor);\n\n";
            }
        }

        // Calculate final lighting contributions
        code += "    vec3 ambient  = ambientColor * light_globalAmbient;\n";
        if (lighting || options.lightMap) {
            code += "    vec3 diffuse  = diffuseColor * diffuseContrib;\n";
        }
        if (lighting) {
            code += "    vec3 specular = specularColor * specularContrib;\n";
        }
        code += "    vec3 emissive = emissiveColor;\n\n";

        // Write out final pixel color
        code += "    gl_FragColor.rgb  = ambient;\n";
        if (lighting || options.lightMap) {
            code += "    gl_FragColor.rgb += diffuse;\n";
        }
        if (lighting) {
            code += "    gl_FragColor.rgb += specular;\n";
        }
        code += "    gl_FragColor.rgb += emissive;\n";
        code += "    gl_FragColor.a    = opacity;\n\n";

        code += getSnippet(device, 'fs_alpha_test');

        // Make sure all components are between 0 and 1
        code += getSnippet(device, 'fs_clamp');

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

        code += getSnippet(device, 'common_main_end');

        var fshader = code;

        return {
            attributes: attributes,
            vshader: vshader,
            fshader: fshader
        };
    }
};