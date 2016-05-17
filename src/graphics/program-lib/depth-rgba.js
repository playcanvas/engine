// Packed normalized depth
// Ortho: simple Z
// Persp: linear distance

pc.programlib.depthrgba = {
    generateKey: function (device, options) {
        var key = "depthrgba";
        if (options.skin) key += "_skin";
        if (options.opacityMap) key += "_opam" + options.opacityChannel;
        if (options.point) key += "_pnt";
        key += "_" + options.shadowType;
        return key;
    },

    createShaderDefinition: function (device, options) {
        /////////////////////////
        // GENERATE ATTRIBUTES //
        /////////////////////////
        var attributes = {
            vertex_position: pc.SEMANTIC_POSITION
        };
        if (options.skin) {
            attributes.vertex_boneWeights = pc.SEMANTIC_BLENDWEIGHT;
            attributes.vertex_boneIndices = pc.SEMANTIC_BLENDINDICES;
        }
        if (options.opacityMap) {
            attributes.vertex_texCoord0 = pc.SEMANTIC_TEXCOORD0;
        }

        ////////////////////////////
        // GENERATE VERTEX SHADER //
        ////////////////////////////
        var getSnippet = pc.programlib.getSnippet;
        var code = '';

        // VERTEX SHADER DECLARATIONS
        code += getSnippet(device, 'vs_transform_decl');

        if (options.skin) {
            code += getSnippet(device, 'vs_skin_decl');
        }

        if (options.opacityMap) {
            code += "attribute vec2 vertex_texCoord0;\n\n";
            code += 'varying vec2 vUv0;\n\n';
        }

        if (options.point) {
            code += 'varying vec3 worldPos;\n\n';
        }

        // VERTEX SHADER BODY
        code += getSnippet(device, 'common_main_begin');

        // SKINNING
        if (options.skin) {
            code += "   "
            code += "    mat4 modelMatrix = vertex_boneWeights.x * getBoneMatrix(vertex_boneIndices.x) +\n";
            code += "                       vertex_boneWeights.y * getBoneMatrix(vertex_boneIndices.y) +\n";
            code += "                       vertex_boneWeights.z * getBoneMatrix(vertex_boneIndices.z) +\n";
            code += "                       vertex_boneWeights.w * getBoneMatrix(vertex_boneIndices.w);\n";
            code += "    vec4 positionW = modelMatrix * vec4(vertex_position, 1.0);\n";
            code += "    positionW.xyz += skinPosOffset;\n";
        } else {
            code += "    mat4 modelMatrix = matrix_model;\n";
            code += "    vec4 positionW = modelMatrix * vec4(vertex_position, 1.0);\n";
        }
        code += "\n";

        // TRANSFORM

        code += "    gl_Position = matrix_viewProjection * positionW;\n\n";

        if (options.opacityMap) {
            code += '    vUv0 = vertex_texCoord0;\n';
        }

        if (options.point) {
            code += '    worldPos = positionW.xyz;\n';
        }

        code += getSnippet(device, 'common_main_end');

        var vshader = code;

        //////////////////////////////
        // GENERATE FRAGMENT SHADER //
        //////////////////////////////
        code = getSnippet(device, 'fs_precision');

        if (options.shadowType===pc.SHADOW_VSM) {
            code += '#define VSM_EXPONENT ' + (device.extTextureFloatRenderable? 15 : 5) + ".0\n\n";
        }

        if (options.opacityMap) {
            code += 'varying vec2 vUv0;\n\n';
            code += 'uniform sampler2D texture_opacityMap;\n\n';
            code += 'uniform float alpha_ref;\n\n';
        }

        if (options.point) {
            code += 'varying vec3 worldPos;\n\n';
            code += 'uniform vec3 view_position;\n\n';
            code += 'uniform float light_radius;\n\n';
        }

        var chunks = pc.shaderChunks;
        var packVsm = !(device.extTextureHalfFloatRenderable || device.extTextureFloatRenderable);

        if (options.shadowType===pc.SHADOW_DEPTH) {
            code += chunks.packDepthPS;
        } else if (packVsm) {
            code += "vec2 encodeFloatRG( float v ) {\n\
                     vec2 enc = vec2(1.0, 255.0) * v;\n\
                     enc = fract(enc);\n\
                     enc -= enc.yy * vec2(1.0/255.0, 1.0/255.0);\n\
                     return enc;\n\
                    }\n";
        }

        // FRAGMENT SHADER BODY
        code += getSnippet(device, 'common_main_begin');

        if (options.opacityMap) {
            code += '    if (texture2D(texture_opacityMap, vUv0).' + options.opacityChannel + ' < alpha_ref) discard;\n\n';
        }

        if (options.point) {
            code += "   float depth = min(distance(view_position, worldPos) / light_radius, 0.99999);\n"
        } else {
            code += "   float depth = gl_FragCoord.z;\n"
        }

        if (options.shadowType===pc.SHADOW_DEPTH) {
            code += "   gl_FragData[0] = packFloat(depth);\n";
        } else if (options.shadowType===pc.SHADOW_VSM) {
            if (packVsm) {
                code += "   gl_FragColor = vec4(encodeFloatRG(depth), encodeFloatRG(depth*depth));\n";
            } else {
                code += chunks.storeEVSMPS;
            }
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
