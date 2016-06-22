pc.programlib.basic = {
    generateKey: function (device, options) {
        var key = 'basic';
        if (options.fog)          key += '_fog';
        if (options.alphaTest)    key += '_atst';
        if (options.vertexColors) key += '_vcol';
        if (options.diffuseMap)   key += '_diff';
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
        if (options.vertexColors) {
            attributes.vertex_color = pc.SEMANTIC_COLOR;
        }
        if (options.diffuseMap) {
            attributes.vertex_texCoord0 = pc.SEMANTIC_TEXCOORD0;
        }

        var chunks = pc.shaderChunks;

        ////////////////////////////
        // GENERATE VERTEX SHADER //
        ////////////////////////////
        var code = '';

        // VERTEX SHADER DECLARATIONS
        code += chunks.transformDeclVS;

        if (options.skin) {
            code += pc.programlib.skinCode(device);
            code += chunks.transformSkinnedVS;
        } else {
            code += chunks.transformVS;
        }

        if (options.vertexColors) {
            code += 'attribute vec4 vertex_color;\n';
            code += 'varying vec4 vColor;\n';
        }
        if (options.diffuseMap) {
            code += 'attribute vec2 vertex_texCoord0;\n';
            code += 'varying vec2 vUv0;\n';
        }

        // VERTEX SHADER BODY
        code += pc.programlib.begin();

        code += "   gl_Position = getPosition();\n";

        if (options.vertexColors) {
            code += '    vColor = vertex_color;\n';
        }
        if (options.diffuseMap) {
            code += '    vUv0 = vertex_texCoord0;\n';
        }

        code += pc.programlib.end();

        var vshader = code;

        //////////////////////////////
        // GENERATE FRAGMENT SHADER //
        //////////////////////////////
        code = pc.programlib.precisionCode(device);

        // FRAGMENT SHADER DECLARATIONS
        if (options.vertexColors) {
            code += 'varying vec4 vColor;\n';
        } else {
            code += 'uniform vec4 uColor;\n';
        }
        if (options.diffuseMap) {
            code += 'varying vec2 vUv0;\n';
            code += 'uniform sampler2D texture_diffuseMap;\n';
        }
        if (options.fog) {
            code += pc.programlib.fogCode(options.fog);
        }
        if (options.alphatest) {
            code += chunks.alphaTestPS;
        }

        // FRAGMENT SHADER BODY
        code += pc.programlib.begin();

        // Read the map texels that the shader needs
        if (options.vertexColors) {
            code += '    gl_FragColor = vColor;\n';
        } else {
            code += '    gl_FragColor = uColor;\n';
        }
        if (options.diffuseMap) {
            code += '    gl_FragColor *= texture2D(texture_diffuseMap, vUv0);\n';
        }

        if (options.alphatest) {
            code += "   alphaTest(gl_FragColor.a);\n";
        }

        if (options.fog) {
            code += "   glFragColor.rgb = addFog(gl_FragColor.rgb);\n";
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
