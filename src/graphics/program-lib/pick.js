pc.programlib.pick = {
    generateKey: function (device, options) {
        var key = "pick";
        if (options.skin) key += "_skin";
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

        ////////////////////////////
        // GENERATE VERTEX SHADER //
        ////////////////////////////
        var chunks = pc.shaderChunks;
        var code = '';

        // VERTEX SHADER DECLARATIONS
        code += chunks.transformDeclVS;

        if (options.skin) {
            code += pc.programlib.skinCode(device);
        }

        // VERTEX SHADER BODY
        code += pc.programlib.begin();

        // SKINNING
        if (options.skin) {
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

        code += pc.programlib.end();

        var vshader = code;

        //////////////////////////////
        // GENERATE FRAGMENT SHADER //
        //////////////////////////////
        code = pc.programlib.precisionCode(device);

        code += "uniform vec4 uColor;"

        // FRAGMENT SHADER BODY
        code += pc.programlib.begin();

        code += '    gl_FragColor = uColor;\n';

        code += pc.programlib.end();

        var fshader = code;

        return {
            attributes: attributes,
            vshader: vshader,
            fshader: fshader
        };
    }
};
