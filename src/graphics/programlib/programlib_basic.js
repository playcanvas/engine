pc.gfx.programlib.basic = {
    generateKey: function (options) {
        var key = 'basic';
        if (options.fog)          key += '_fog';
        if (options.alphaTest)    key += '_atst';
        if (options.vertexColors) key += '_vcol';
        if (options.diffuseMap)   key += '_diff';
        return key;
    },

    generateVertexShader: function (options) {
        var getSnippet = pc.gfx.programlib.getSnippet;
        var code = '';

        // VERTEX SHADER DECLARATIONS
        if (options.skin) {
            code += getSnippet('vs_skin_position_decl');
        } else {
            code += getSnippet('vs_static_position_decl');
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
        code += getSnippet('common_main_begin');

        // Skinning is performed in world space
        if (options.skin) {
            code += getSnippet('vs_skin_position');
        } else {
            code += getSnippet('vs_static_position');
        }

        if (options.vertexColors) {
            code += '    vColor = vertex_color;\n';
        }
        if (options.diffuseMap) {
            code += '    vUv0 = vertex_texCoord0;\n';
        }

        code += getSnippet('common_main_end');
        
        return code;
    },

    generateFragmentShader: function (options) {
        var getSnippet = pc.gfx.programlib.getSnippet;
        var code = getSnippet('fs_precision');

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
            code += getSnippet('fs_fog_decl');
        }
        if (options.alphatest) {
            code += getSnippet('fs_alpha_test_decl');
        }

        // FRAGMENT SHADER BODY
        code += getSnippet('common_main_begin');

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
            code += getSnippet('fs_alpha_test');
        }

        code += getSnippet('fs_clamp');

        if (options.fog) {
            code += getSnippet('fs_fog');
        }

        code += getSnippet('common_main_end');

        return code;
    }
};