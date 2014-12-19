pc.programlib.depth = {
    generateKey: function (device, options) {
        var key = "depth";
        if (options.skin) key += "_skin";
        if (options.opacityMap) key += "_opam";
        return key;
    },

    createShaderDefinition: function (device, options) {
        /////////////////////////
        // GENERATE ATTRIBUTES //
        /////////////////////////
        var attributes = {
            vertex_position: pc.SEMANTIC_POSITION
        }
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

        // VERTEX SHADER BODY
        code += getSnippet(device, 'common_main_begin');

        // SKINNING
        if (options.skin) {
            code += "    mat4 modelMatrix = vertex_boneWeights.x * getBoneMatrix(vertex_boneIndices.x) +\n";
            code += "                       vertex_boneWeights.y * getBoneMatrix(vertex_boneIndices.y) +\n";
            code += "                       vertex_boneWeights.z * getBoneMatrix(vertex_boneIndices.z) +\n";
            code += "                       vertex_boneWeights.w * getBoneMatrix(vertex_boneIndices.w);\n";
        } else {
            code += "    mat4 modelMatrix = matrix_model;\n";
        }
        code += "\n";

        // TRANSFORM
        code += "    vec4 positionW = modelMatrix * vec4(vertex_position, 1.0);\n";
        code += "    gl_Position = matrix_viewProjection * positionW;\n\n";

        if (options.opacityMap) {
            code += '    vUv0 = vertex_texCoord0;\n';
        }

        code += getSnippet(device, 'common_main_end');

        var vshader = code;

        //////////////////////////////
        // GENERATE FRAGMENT SHADER //
        //////////////////////////////
        code = getSnippet(device, 'fs_precision');

        code += 'uniform float camera_near;\n';
        code += 'uniform float camera_far;\n';


        // Packing a float in GLSL with multiplication and mod
        // http://blog.gradientstudios.com/2012/08/23/shadow-map-improvement
        code += 'vec4 packFloat(float depth)\n';
        code += '{\n';
        code += '    const vec4 bit_shift = vec4(256.0 * 256.0 * 256.0, 256.0 * 256.0, 256.0, 1.0);\n';
        code += '    const vec4 bit_mask  = vec4(0.0, 1.0 / 256.0, 1.0 / 256.0, 1.0 / 256.0);\n';
                     // combination of mod and multiplication and division works better
        code += '    vec4 res = mod(depth * bit_shift * vec4(255), vec4(256) ) / vec4(255);\n';
        code += '    res -= res.xxyz * bit_mask;\n';
        code += '    return res;\n';
        code += '}\n\n';


        // FRAGMENT SHADER BODY
        code += getSnippet(device, 'common_main_begin');

        code += "float depth = gl_FragCoord.z / gl_FragCoord.w;\n";
        code += "gl_FragColor = packFloat(depth / camera_far);\n"

        //code += "float color = 1.0 - smoothstep(camera_near, camera_far, depth);";
        //code += "gl_FragColor = vec4(vec3(color), 1.0);";

        code += getSnippet(device, 'common_main_end');
        var fshader = code;

        return {
            attributes: attributes,
            vshader: vshader,
            fshader: fshader
        };
    }
};
