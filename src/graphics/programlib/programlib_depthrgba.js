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

        if (options.point) {
            code += 'varying vec3 worldPos;\n\n';
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

        if (options.point) {
            code += '    worldPos = positionW.xyz;\n';
        }

        code += getSnippet(device, 'common_main_end');

        var vshader = code;

        //////////////////////////////
        // GENERATE FRAGMENT SHADER //
        //////////////////////////////
        code = getSnippet(device, 'fs_precision');

        if (options.opacityMap) {
            code += 'varying vec2 vUv0;\n\n';
            code += 'uniform sampler2D texture_opacityMap;\n\n';
        }

        if (options.point) {
            code += 'varying vec3 worldPos;\n\n';
            code += 'uniform vec3 view_position;\n\n';
            code += 'uniform float light_radius;\n\n';
        }

        var chunks = pc.shaderChunks;
        if (options.shadowType===pc.SHADOW_DEPTHMASK) {
            code += chunks.packDepthMaskPS;
        } else {
            code += chunks.packDepthPS;
        }

        // FRAGMENT SHADER BODY
        code += getSnippet(device, 'common_main_begin');

        if (options.opacityMap) {
            code += '    if (texture2D(texture_opacityMap, vUv0).' + options.opacityChannel + ' < 0.25) discard;\n\n';
        }

        if (options.point) {
            code += "   gl_FragData[0] = packFloat(min(distance(view_position, worldPos) / light_radius, 0.99999));\n"
        } else {
            code += '    gl_FragData[0] = packFloat(gl_FragCoord.z);\n';
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
