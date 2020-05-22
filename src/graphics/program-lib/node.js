pc.programlib.node = {
    generateKey: function (options) {
        var key = 'basic';
        if (options.fog)          key += '_fog';
        if (options.alphaTest)    key += '_atst';
        if (options.nodeInputs) key += options.nodeInputs.key;
        key += '_' + options.pass;
        return key;
    },

    createShaderDefinition: function (device, options) {
        // GENERATE ATTRIBUTES
        var attributes = {
            vertex_position: pc.SEMANTIC_POSITION
        };
        if (options.skin) {
            attributes.vertex_boneWeights = pc.SEMANTIC_BLENDWEIGHT;
            attributes.vertex_boneIndices = pc.SEMANTIC_BLENDINDICES;
        }
        if (options.nodeInputs.vertexColor) {
            attributes.vertex_color = pc.SEMANTIC_COLOR;
        }
        if (options.nodeInputs.textureMaps) {
            attributes.vertex_texCoord0 = pc.SEMANTIC_TEXCOORD0;
        }

        var chunks = pc.shaderChunks;

        // GENERATE VERTEX SHADER
        var code = '';

        // VERTEX SHADER DECLARATIONS
        code += chunks.transformDeclVS;

        if (options.skin) {
            code += pc.programlib.skinCode(device);
            code += chunks.transformSkinnedVS;
        } else {
            code += chunks.transformVS;
        }

        if (options.nodeInputs.vertexColor) {
            code += 'attribute vec4 vertex_color;\n';
            code += 'varying vec4 vColor;\n';
        }
        if (options.nodeInputs.textureMaps) {
            code += 'attribute vec2 vertex_texCoord0;\n';
            code += 'varying vec2 vUv0;\n';
        }

        if (options.pass === pc.SHADER_DEPTH) {
            code += 'varying float vDepth;\n';
            code += '#ifndef VIEWMATRIX\n';
            code += '#define VIEWMATRIX\n';
            code += 'uniform mat4 matrix_view;\n';
            code += '#endif\n';
            code += '#ifndef CAMERAPLANES\n';
            code += '#define CAMERAPLANES\n';
            code += 'uniform vec4 camera_params;\n\n';
            code += '#endif\n';
        }

        for (var n=0;n<nodeInputs.textureParams.length;n++)
        {
            code += 'uniform sampler2D texture_param_'+n+'\n';
        }
        for (var n=0;n<nodeInputs.floatParams.length;n++)
        {
            code += 'uniform float float_param_'+n+'\n';
        }
        for (var n=0;n<nodeInputs.vec2Params.length;n++)
        {
            code += 'uniform vec2 vec2_param_'+n+'\n';
        }
        for (var n=0;n<nodeInputs.vec3Params.length;n++)
        {
            code += 'uniform vec3 vec3_param_'+n+'\n';
        }
        for (var n=0;n<nodeInputs.vec4Params.length;n++)
        {
            code += 'uniform vec4 vec4_param_'+n+'\n';
        }

        // VERTEX SHADER BODY
        code += pc.programlib.begin();

        if (options.nodeInputs.positionOffset) {
            code += options.nodeInputs.positionOffset;
            code += "   gl_Position = getPosition()+getPositionOffset();\n";
        }
        else {
            code += "   gl_Position = getPosition();\n";
        }

        if (options.pass === pc.SHADER_DEPTH) {
            code += "    vDepth = -(matrix_view * vec4(getWorldPosition(),1.0)).z * camera_params.x;\n";
        }

        if (options.nodeInputs.vertexColors) {
            code += '    vColor = vertex_color;\n';
        }
        if (options.nodeInputs.textureMaps) {
            code += '    vUv0 = vertex_texCoord0;\n';
        }

        code += pc.programlib.end();

        var vshader = code;

        // GENERATE FRAGMENT SHADER
        code = pc.programlib.precisionCode(device);

        // FRAGMENT SHADER DECLARATIONS
        if (options.nodeInputs.vertexColors) {
            code += 'varying vec4 vColor;\n';
        } else {
            code += 'uniform vec4 uColor;\n';
        }
        if (options.nodeInputs.textureParams) {
            code += 'varying vec2 vUv0;\n';
            code += 'uniform sampler2D texture_diffuseMap;\n';
        }
        if (options.fog) {
            code += pc.programlib.fogCode(options.fog);
        }
        if (options.alphatest) {
            code += chunks.alphaTestPS;
        }

        if (options.pass === pc.SHADER_DEPTH) {
            // ##### SCREEN DEPTH PASS #####
            code += 'varying float vDepth;\n';
            code += chunks.packDepthPS;
        }

        for (var n=0;n<nodeInputs.textureParams.length;n++)
        {
            code += 'uniform sampler2D texture_param_'+n+'\n';
        }
        for (var n=0;n<nodeInputs.floatParams.length;n++)
        {
            code += 'uniform float float_param_'+n+'\n';
        }
        for (var n=0;n<nodeInputs.vec2Params.length;n++)
        {
            code += 'uniform vec2 vec2_param_'+n+'\n';
        }
        for (var n=0;n<nodeInputs.vec3Params.length;n++)
        {
            code += 'uniform vec3 vec3_param_'+n+'\n';
        }
        for (var n=0;n<nodeInputs.vec4Params.length;n++)
        {
            code += 'uniform vec4 vec4_param_'+n+'\n';
        }

        // FRAGMENT SHADER BODY
        code += pc.programlib.begin();

        if (options.nodeInputs.baseColor) code += options.nodeInputs.baseColor;
        if (options.nodeInputs.opacity) code += options.nodeInputs.opacity;
        if (options.nodeInputs.normal) code += options.nodeInputs.normal;
        if (options.nodeInputs.metallic) code += options.nodeInputs.metallic;
        if (options.nodeInputs.roughness) code += options.nodeInputs.roughness;                

        code += pc.NodeMaterial.generateLightingCode(options);

        code += '    gl_FragColor = lightGGX(getBaseColor(), getOpacity(), getNormal(), getMetallic(), getRoughness());\n';

        if (options.alphatest) {
            code += "   alphaTest(gl_FragColor.a);\n";
        }

        if (options.pass === pc.SHADER_PICK) {
            // ##### PICK PASS #####
        } else if (options.pass === pc.SHADER_DEPTH) {
            // ##### SCREEN DEPTH PASS #####
            code += "    gl_FragColor = packFloat(vDepth);\n";
        } else {
            // ##### FORWARD PASS #####
            if (options.fog) {
                code += "   glFragColor.rgb = addFog(gl_FragColor.rgb);\n";
            }
        }

        code += pc.programlib.end();

        var fshader = code;

        return {
            attributes: attributes,
            vshader: vshader,
            fshader: fshader
        };
    }
};
