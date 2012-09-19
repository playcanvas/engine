pc.gfx.programlib.skybox = {
    generateKey: function (options) {
        var key = "skybox";
        return key;
    },

    generateVertexShader: function (options) {
        var getSnippet = pc.gfx.programlib.getSnippet;
        var code = '';

        // VERTEX SHADER DECLARATIONS
        code += "attribute vec3 vertex_position;\n";
        code += "uniform mat4 matrix_projection;\n";
        code += "uniform mat4 matrix_view;\n";
        code += "uniform mat4 matrix_model;\n";
        code += "varying vec3 vViewDir;\n\n";

        // VERTEX SHADER BODY
        code += getSnippet('common_main_begin');

        // Recreate the view projection matrix with no translation component in the view matrix
        code += "    mat4 viewMat = matrix_view;\n";
        code += "    viewMat[3][0] = viewMat[3][1] = viewMat[3][2] = 0.0;\n";
        code += "    mat4 matrix_viewProjection = matrix_projection * viewMat;\n";

        code += getSnippet('vs_static_position');

        code += "    vViewDir = vertex_position;\n";

        code += getSnippet('common_main_end');
        
        return code;
    },

    generateFragmentShader: function (options) {
        var getSnippet = pc.gfx.programlib.getSnippet;
        var code = getSnippet('fs_precision');

        // FRAGMENT SHADER DECLARATIONS
        code += "varying vec3 vViewDir;\n";
        code += "uniform samplerCube texture_cubeMap;\n\n";

        // FRAGMENT SHADER BODY
        code += getSnippet('common_main_begin');

        code += "    gl_FragColor = textureCube(texture_cubeMap, normalize(vViewDir));\n";

        code += getSnippet('common_main_end');

        return code;
    }
};