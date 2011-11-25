pc.gfx.programlib.phong = {
    generateKey: function (options) {
        var key = "phong";
        if (options.skin)                key += "_skin";
        if (options.fog)                 key += "_fog";
        if (options.alphaTest)           key += "_atst";
        if (options.numDirectionals > 0) key += "_" + options.numDirectionals + "dir";
        if (options.numPoints > 0)       key += "_" + options.numPoints + "pnt";
        if (options.vertexColors)        key += "_vcol";
        if (options.diffuseMap)          key += "_diff";
        if (options.specularMap)         key += "_spec";
        if (options.emissiveMap)         key += "_emis";
        if (options.opacityMap)          key += "_opac";
        if (options.sphereMap)           key += "_sphr";
        if (options.cubeMap)             key += "_cube";
        if (options.bumpMap)             key += "_bump";
        if (options.normalMap)           key += "_norm";
        if (options.parallaxMap)         key += "_prlx";
        if (options.lightMap)            key += "_lght";
        if (options.shadowMap)           key += "_shdw";
        return key;
    },

    generateVertexShader: function (options) {
        var code = "";

        var lighting = (options.numDirectionals > 0) || (options.numPoints > 0);
        
        // VERTEX SHADER INPUTS: ATTRIBUTES
        code += "attribute vec3 vertex_position;\n";
        if (lighting || options.cubeMap || options.sphereMap) {
            code += "attribute vec3 vertex_normal;\n";
            if (options.bumpMap || options.normalMap || options.parallaxMap) {
                code += "attribute vec4 vertex_tangent;\n";
            }
        }
        if (options.diffuseMap || options.specularMap || options.emissiveMap || 
            options.bumpMap || options.normalMap || options.parallaxMap || options.opacityMap) {
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
        if (options.shadowMap) {
            code += "uniform mat4 matrix_shadow;\n";
        }
        for (var i = 0; i < options.numDirectionals + options.numPoints; i++) {
            code += "uniform vec3 light" + i + "_position;\n";
        }
        if ((options.cubeMap) || (options.sphereMap)) {
            code += "uniform vec3 view_position;\n";
        }
        if (options.diffuseMap) {
            code += "uniform mat4 texture_diffuseMapTransform;\n";
        }
        if (options.bumpMap) {
            code += "uniform mat4 texture_bumpMapTransform;\n";
        } else if (options.normalMap) {
            code += "uniform mat4 texture_normalMapTransform;\n";
        } else if (options.parallaxMap) {
            code += "uniform mat4 texture_parallaxMapTransform;\n";
        }
        if (options.opacityMap) {
            code += "uniform mat4 texture_opacityMapTransform;\n";
        }
        if (options.specularMap) {
            code += "uniform mat4 texture_specularMapTransform;\n";
        }
        if (options.emissiveMap) {
            code += "uniform mat4 texture_emissiveMapTransform;\n";
        }
        code += "\n";

        // VERTEX SHADER OUTPUTS
        if (lighting) {
            code += "varying vec3 vViewDir;\n";
            for (var i = 0; i < options.numDirectionals + options.numPoints; i++) {
                code += "varying vec3 vLight" + i + "Dir;\n";
            }
            if (!(options.bumpMap || options.normalMap || options.parallaxMap)) {
                code += "varying vec3 vNormalE;\n";
            }
        }
        if (options.diffuseMap) {
            code += "varying vec2 vUvDiffuseMap;\n";
        }
        if (options.specularMap) {
            code += "varying vec2 vUvSpecularMap;\n";
        }
        if (options.emissiveMap) {
            code += "varying vec2 vUvEmissiveMap;\n";
        }
        if (options.opacityMap) {
            code += "varying vec2 vUvOpacityMap;\n";
        }
        if (options.bumpMap || options.normalMap || options.parallaxMap) {
            code += "varying vec2 vUvBumpMap;\n";
        }
        if (options.lightMap) {
            code += "varying vec2 vUvLightMap;\n";
        }
        if (options.cubeMap || options.sphereMap) {
            code += "varying vec3 vNormalW;\n";
            code += "varying vec3 vVertToEyeW;\n";
        }
        if (options.vertexColors) {
            code += "varying vec4 vVertexColor;\n";
        }
        if (options.shadowMap) {
            code += "varying vec4 vShadowCoord;\n";
        }
        code += "\n";

        // VERTEX SHADER BODY
        code += "void main(void)\n";
        code += "{\n";
        // Prepare attribute values into the right formats for the vertex shader
        code += "    vec4 position = vec4(vertex_position, 1.0);\n";
        if (lighting || options.cubeMap || options.sphereMap) {
            code += "    vec4 normal   = vec4(vertex_normal, 0.0);\n";
            if (options.bumpMap || options.normalMap || options.parallaxMap) {
                code += "    vec4 tangent  = vec4(vertex_tangent.xyz, 0.0);\n";
            }
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

                if (options.bumpMap || options.normalMap || options.parallaxMap) {
                    code += "    vec4 tangentW;\n";
                    code += "    tangentW  = vertex_boneWeights[0] * matrix_pose[int(vertex_boneIndices[0])] * tangent;\n";
                    code += "    tangentW += vertex_boneWeights[1] * matrix_pose[int(vertex_boneIndices[1])] * tangent;\n";
                    code += "    tangentW += vertex_boneWeights[2] * matrix_pose[int(vertex_boneIndices[2])] * tangent;\n";
                    code += "    tangentW += vertex_boneWeights[3] * matrix_pose[int(vertex_boneIndices[3])] * tangent;\n\n";
                }
            }
        } else {
            code += "    vec4 positionW = matrix_model * position;\n";
            if (lighting || options.cubeMap || options.sphereMap) {
                code += "    vec4 normalW   = matrix_model * normal;\n";
                if (options.bumpMap || options.normalMap || options.parallaxMap) {
                    code += "    vec4 tangentW  = matrix_model * tangent;\n";
                }
            }
            code += "\n";
        }

        // Transform to vertex position to screen
        code += "    gl_Position = matrix_viewProjection * positionW;\n\n";
        if (options.shadowMap) {
            code += "    vShadowCoord = matrix_shadow * positionW;\n";
        }

        // Transform vectors required for lighting to eye space
        if (lighting) {
            if (options.bumpMap || options.normalMap || options.parallaxMap) {
                code += "    vec3 normalE   = normalize((matrix_view * normalW).xyz);\n";
                code += "    vec3 tangentE  = normalize((matrix_view * tangentW).xyz);\n";
                code += "    vec3 binormalE = cross(normalE, tangentE) * vertex_tangent.w;\n";
                code += "    mat3 tbnMatrix = mat3(tangentE.x, binormalE.x, normalE.x,\n";
                code += "                          tangentE.y, binormalE.y, normalE.y,\n";
                code += "                          tangentE.z, binormalE.z, normalE.z);\n";
                code += "    vec3 positionE = vec3(matrix_view * positionW);\n";
                code += "    vViewDir = tbnMatrix * -positionE;\n";
                for (var i = 0; i < options.numDirectionals; i++) {
                    code += "    vec3 light" + i + "DirE = vec3(matrix_view * vec4(-light" + i + "_position, 0.0));\n";
                    code += "    vLight" + i + "Dir = tbnMatrix * light" + i + "DirE;\n";
                }
                for (var i = options.numDirectionals; i < options.numDirectionals + options.numPoints; i++) {
                    code += "    vec3 light" + i + "DirE = vec3(matrix_view * vec4(light" + i + "_position - positionW.xyz, 0.0));\n";
                    code += "    vLight" + i + "Dir = tbnMatrix * light" + i + "DirE;\n";
                }
            } else {
                code += "    vNormalE   = normalize((matrix_view * normalW).xyz);\n";
                code += "    vec3 positionE = vec3(matrix_view * positionW);\n";
                code += "    vViewDir = -positionE;\n";
                for (var i = 0; i < options.numDirectionals; i++) {
                    code += "    vLight" + i + "Dir = vec3(matrix_view * vec4(-light" + i + "_position, 0.0));\n";
                }
                for (var i = options.numDirectionals; i < options.numDirectionals + options.numPoints; i++) {
                    code += "    vLight" + i + "Dir = vec3(matrix_view * vec4(light" + i + "_position - positionW.xyz, 0.0));\n";
                }
            }
            code += "\n";
        }

        // Calculate world space vector from eye point to vertex for reflection mapping
        if (options.cubeMap || options.sphereMap) {
            code += "    vNormalW    = normalW.xyz;\n";
            code += "    vVertToEyeW = view_position - positionW.xyz;\n";
        }

        if (options.diffuseMap) {
            code += "    vUvDiffuseMap  = (texture_diffuseMapTransform * vec4(vertex_texCoord0, 0, 1)).st;\n";
        }
        if (options.bumpMap) {
            code += "    vUvBumpMap     = (texture_bumpMapTransform * vec4(vertex_texCoord0, 0, 1)).st;\n";
        } else if (options.normalMap) {
            code += "    vUvBumpMap     = (texture_normalMapTransform * vec4(vertex_texCoord0, 0, 1)).st;\n";
        } else if (options.parallaxMap) {
            code += "    vUvBumpMap     = (texture_parallaxMapTransform * vec4(vertex_texCoord0, 0, 1)).st;\n";
        }

        if (options.opacityMap) {
            code += "    vUvOpacityMap  = (texture_opacityMapTransform * vec4(vertex_texCoord0, 0, 1)).st;\n";
        }
        if (options.specularMap) {
            code += "    vUvSpecularMap = (texture_specularMapTransform * vec4(vertex_texCoord0, 0, 1)).st;\n";
        }
        if (options.emissiveMap) {
            code += "    vUvEmissiveMap = (texture_emissiveMapTransform * vec4(vertex_texCoord0, 0, 1)).st;\n";
        }
        if (options.lightMap) {
            code += "    vUvLightMap    = vertex_texCoord1;\n";
        }
        code += "}";
        
        return code;
    },

    generateFragmentShader: function (options) {
        var code = "";

        var lighting = (options.numDirectionals > 0) || (options.numPoints > 0);

        code += "#ifdef GL_ES\n";
        code += "precision highp float;\n";
        code += "#endif\n\n";

        // FRAGMENT SHADER INPUTS: VARYINGS
        if (lighting) {
            code += "varying vec3 vViewDir;\n";
            for (var i = 0; i < options.numDirectionals + options.numPoints; i++) {
                code += "varying vec3 vLight" + i + "Dir;\n";
            }
            if (!(options.bumpMap || options.normalMap)) {
                code += "varying vec3 vNormalE;\n";
            }
        }
        if (options.diffuseMap) {
            code += "varying vec2 vUvDiffuseMap;\n";
        }
        if (options.specularMap) {
            code += "varying vec2 vUvSpecularMap;\n";
        }
        if (options.emissiveMap) {
            code += "varying vec2 vUvEmissiveMap;\n";
        }
        if (options.opacityMap) {
            code += "varying vec2 vUvOpacityMap;\n";
        }
        if (options.bumpMap || options.normalMap || options.parallaxMap) {
            code += "varying vec2 vUvBumpMap;\n";
        }
        if (options.lightMap) {
            code += "varying vec2 vUvLightMap;\n";
        }
        if (options.cubeMap || options.sphereMap) {
            code += "varying vec3 vNormalW;\n";
            code += "varying vec3 vVertToEyeW;\n";
        }
        if (options.vertexColors) {
            code += "varying vec4 vVertexColor;\n";
        }
        if (options.shadowMap) {
            code += "varying vec4 vShadowCoord;\n";
        }
        code += "\n";

        // FRAGMENT SHADER INPUTS: UNIFORMS
        if (lighting) {
            code += "uniform vec3 material_ambient;\n";
            code += "uniform vec3 material_diffuse;\n";
            if (options.specularMap) {
                code += "uniform sampler2D texture_specularMap;\n";
            } else {
                code += "uniform vec3 material_specular;\n";
            }
            code += "uniform float material_shininess;\n";
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
        if (options.bumpMap) {
            code += "uniform sampler2D texture_bumpMap;\n";
        } else if (options.normalMap) {
            code += "uniform sampler2D texture_normalMap;\n";
        } else if (options.parallaxMap) {
            code += "uniform sampler2D texture_parallaxMap;\n";
        }
        if (options.cubeMap || options.sphereMap) {
            code += "uniform float material_reflectionFactor;\n";
            if (options.sphereMap) {
                code += "uniform sampler2D texture_sphereMap;\n";
            } else { // Cube mapping
                code += "uniform mat4 matrix_view;\n";
                code += "uniform samplerCube texture_cubeMap;\n";
            }
        }
        if (options.opacityMap) {
            code += "uniform sampler2D texture_opacityMap;\n";
        } else {
            code += "uniform float material_opacity;\n";
        }
        if (options.shadowMap) {
            code += "uniform sampler2D texture_shadowMap;\n";
        }
        code += "uniform vec3 light_globalAmbient;\n";
        for (var i = 0; i < options.numDirectionals + options.numPoints; i++) {
            code += "uniform vec3 light" + i + "_color;\n";
        }
        if (options.fog) {
            code += "uniform vec4 fog_color;\n";
            code += "uniform float fog_density;\n";
        }
        if (options.alphatest) {
            code += "uniform float alpha_ref;\n";
        }

        if (options.shadowMap) {
            code += "\n";
            code += "float unpack_depth(const in vec4 rgba_depth)\n";
            code += "{\n";
            code += "    const vec4 bit_shift = vec4(1.0/(256.0*256.0*256.0), 1.0/(256.0*256.0), 1.0/256.0, 1.0);\n";
            code += "    float depth = dot(rgba_depth, bit_shift);\n";
            code += "    return depth;\n";
            code += "}\n";
        }
        code += "\n";
        code += "void main(void)\n";
        code += "{\n";
        if (lighting) {
            code += "    vec3 viewDir = normalize(vViewDir);\n";
        }

        // We can't write to varyings to copy them to temporarys
        if (options.diffuseMap) {
            code += "    vec2 uvDiffuseMap = vUvDiffuseMap;\n";
        }
        if (options.specularMap) {
            code += "    vec2 uvSpecularMap = vUvSpecularMap;\n";
        }
        
        // Read the map texels that the shader needs
        if (options.bumpMap) {
            code += "    float hghtMapPixel = texture2D(texture_bumpMap, vUvBumpMap).r;\n";
        } else if (options.normalMap) {
            code += "    vec3 normMapPixel = texture2D(texture_normalMap, vUvBumpMap).rgb;\n";
        } else if (options.parallaxMap) {
            // Shift UV0 if parallax mapping is enabled
            code += "    float height = texture2D(texture_parallaxMap, vUvBumpMap).a;\n";
            // Scale and bias
            code += "    float offset = height * 0.025 - 0.02;\n";
            code += "    vec3 normMapPixel = texture2D(texture_parallaxMap, vUvBumpMap + offset * viewDir.xy).rgb;\n";
            if (options.diffuseMap) {
                code += "    uvDiffuseMap += offset * viewDir.xy;\n";
            }
            if (options.specularMap) {
                code += "    uvSpecularMap += offset * viewDir.xy;\n";
            }
        }

        if (options.diffuseMap) {
            code += "    vec4 diffMapPixel = texture2D(texture_diffuseMap, uvDiffuseMap);\n";
        }
        if (options.specularMap && lighting) {
            code += "    vec4 specMapPixel = texture2D(texture_specularMap, uvSpecularMap);\n";
        }
        if (options.lightMap) {
            code += "    vec4 lghtMapPixel = texture2D(texture_lightMap, vUvLightMap);\n";
        }

        if (options.opacityMap) {
            code += "    gl_FragColor.a = texture2D(texture_opacityMap, vUvOpacityMap).r;\n";
        } else if (options.diffuseMap) {
            code += "    gl_FragColor.a = material_opacity * diffMapPixel.a;\n";
        } else {
            code += "    gl_FragColor.a = material_opacity;\n";
        }
        if (options.alphatest) {
            code += "    if (gl_FragColor.a <= alpha_ref)\n"; 
            code += "    {\n";
            code += "        discard;\n";
            code += "    }\n";
        }

        if (lighting) {
            code += "    vec3 lightDir, halfVec;\n";
            code += "    vec3 ambient, diffuse, specular;\n";
            code += "    vec3 diffuseContrib = vec3(0.0);\n";
            code += "    float specularContrib = 0.0;\n";
            code += "    float nDotL, nDotH;\n";
            if (options.cubeMap || options.sphereMap) {
                code += "    float lambertContrib = 0.0;\n";
            }

            if ((options.normalMap) || (options.parallaxMap)) {
                // Use a normal extracted from the supplied normal map
                code += "    vec3 N = normalize(normMapPixel * 2.0 - 1.0);\n";
            } else if (options.bumpMap) {
                // Work out a tangent space normal based on the heightmaps neighbours
                code += "    vec2 offset = vec2(1.0/64.0, 1.0/64.0);\n";
                code += "    float xPlusOne  = texture2D(texture_bumpMap, vUvBumpMap + vec2( offset.x, 0)).r;\n";
                code += "    float xMinusOne = texture2D(texture_bumpMap, vUvBumpMap + vec2(-offset.x, 0)).r;\n";
                code += "    float yPlusOne  = texture2D(texture_bumpMap, vUvBumpMap + vec2(0,  offset.y)).r;\n";
                code += "    float yMinusOne = texture2D(texture_bumpMap, vUvBumpMap + vec2(0, -offset.y)).r;\n";
                code += "    vec3 tangent  = vec3(1, 0, xPlusOne - xMinusOne);\n";
                code += "    vec3 binormal = vec3(0, 1, yPlusOne - yMinusOne);\n";
                code += "    vec3 N = normalize(cross(tangent, binormal));\n";
            } else {
                // Use a normal interpolated from vertex normals
                code += "    vec3 N = vNormalE;\n";
            }

            for (var i = 0; i < options.numDirectionals + options.numPoints; i++) {
                code += "    lightDir = normalize(vLight" + i + "Dir);\n";
                code += "    halfVec = normalize(lightDir + viewDir);\n";
                code += "    nDotL = max(0.0, dot(N, lightDir));\n";
                code += "    if (nDotL > 0.0)\n";
                code += "    {\n";
                code += "        diffuseContrib  += light" + i + "_color * nDotL;\n";
                if (options.cubeMap || options.sphereMap) {
                    code += "        lambertContrib  += nDotL;\n";
                } else {
                    code += "        nDotH = max(0.0, dot(N, halfVec));\n";
                    if (options.specularMap) {
                        code += "        specularContrib += pow(nDotH, specMapPixel.a * 100.0);\n";
                    } else {
                        code += "        specularContrib += pow(nDotH, material_shininess);\n";
                    }
                }
                code += "    }\n";
            }

            // Select the sources for material color
            if (options.diffuseMap) {
                code += "    ambient = diffMapPixel.rgb;\n";
                code += "    diffuse = diffMapPixel.rgb;\n";
            } else {
                code += "    ambient = material_ambient;\n";
                code += "    diffuse = material_diffuse;\n";
            }
            if (options.cubeMap) {
                // Need to factor in lambert term here somehow
                if (options.normalMap) {
                    code += "    vec3 normalW = (vec4(N, 0.0) * matrix_view).xyz;\n";
                } else {
                    code += "    vec3 normalW = normalize(vNormalW);\n";
                }
                code += "    vec3 reflectW = -reflect(normalize(vVertToEyeW), normalW);\n";
                code += "    specular = textureCube(texture_cubeMap, reflectW).rgb * material_reflectionFactor;\n";
                code += "    specularContrib = 1.0;\n";
            } else if (options.sphereMap) {
                code += "    vec3 R = normalize(-reflect(lightDir, N));\n";
                code += "    float m = 2.0 * sqrt( R.x*R.x + R.y*R.y + (R.z+1.0)*(R.z+1.0) );\n";
                code += "    vec2 sphereMapUv = vec2(R.x/m + 0.5, R.y/m + 0.5);\n";
                // Need to factor in lambert term here somehow
                code += "    specular = texture2D(texture_sphereMap, sphereMapUv).rgb * lambertContrib * material_reflectionFactor;\n";
                code += "    specularContrib = 1.0;\n";
            } else if (options.specularMap) {
                code += "    specular = specMapPixel.rgb;\n";
            } else {
                code += "    specular = material_specular;\n";
            }

            // Shadows should only affect diffuse and specular contribution
            if (options.shadowMap) {
                code += "    vec3 shadow_coord = vShadowCoord.xyz / vShadowCoord.w;\n";
                code += "    vec4 rgba_depth   = texture2D(texture_shadowMap, shadow_coord.xy);\n";
                code += "    float depth       = unpack_depth(rgba_depth);\n";
                code += "    float visibility  = ((depth - shadow_coord.z) > -0.01) ? (1.0) : (0.3);\n";
                code += "    diffuse           = diffuse * visibility;\n";
                code += "    specular          = specular * visibility;\n";
            }

            // Add ambient + diffuse + specular
            code += "    gl_FragColor.rgb  = ambient * light_globalAmbient;\n";
            if (options.lightMap) {
                code += "    diffuseContrib += lghtMapPixel.rgb;\n";
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
            code += "    gl_FragColor.rgb += texture2D(texture_emissiveMap, vUvEmissiveMap).rgb;\n";
        } else {
            code += "    gl_FragColor.rgb += material_emissive;\n";
        }

        code += "    gl_FragColor = clamp(gl_FragColor, 0.0, 1.0);\n";

        if (options.fog) {
            // Calculate fog (equivalent to glFogi(GL_FOG_MODE, GL_EXP2);
            code += "    const float LOG2 = 1.442695;\n";
            code += "    float z = gl_FragCoord.z / gl_FragCoord.w;\n";
            code += "    float fogFactor = exp2(-fog_density * fog_density * z * z * LOG2);\n";
            code += "    fogFactor = clamp(fogFactor, 0.0, 1.0);\n";
            code += "    gl_FragColor = mix(fog_color, gl_FragColor, fogFactor );\n";
        }
        code += "}";

        return code;
    }
};