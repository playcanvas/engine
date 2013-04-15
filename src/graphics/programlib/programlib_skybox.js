pc.gfx.programlib.skybox = {
    generateKey: function (options) {
        var key = "skybox";
        return key;
    },

    generateVertexShader: function (options) {
        var getSnippet = pc.gfx.programlib.getSnippet;
        var code = '';

        // VERTEX SHADER DECLARATIONS
        code += getSnippet('vs_static_position_decl');

        code += "uniform vec3 view_position;\n";
        code += "varying vec3 vViewDir;\n\n";

        // VERTEX SHADER BODY
        code += getSnippet('common_main_begin');

        code += '    vec4 positionW = matrix_model * vec4(vertex_position + view_position, 1.0);\n';
        code += '    gl_Position = matrix_viewProjection * positionW;\n';

        // Force skybox to far Z, regardless of the clip planes on the camera
        code += "    gl_Position = gl_Position.xyww;\n";
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