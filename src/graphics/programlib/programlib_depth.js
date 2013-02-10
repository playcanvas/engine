pc.gfx.programlib.depth = {
    generateKey: function (options) {
        var key = "depth";
        if (options.skin) key += "_skin";
        if (options.opacityMap) key += "_opam";
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

        if (options.opacityMap) {
            code += "attribute vec2 vertex_texCoord0;\n\n";
            code += 'varying vec2 vUv0;\n\n';
        }

        // VERTEX SHADER BODY
        code += getSnippet('common_main_begin');

        // Skinning is performed in world space
        if (options.skin) {
            code += getSnippet('vs_skin_position');
        } else {
            code += getSnippet('vs_static_position');
        }

        if (options.opacityMap) {
            code += '    vUv0 = vertex_texCoord0;\n';
        }

        code += getSnippet('common_main_end');
        
        return code;
    },

    generateFragmentShader: function (options) {
        var getSnippet = pc.gfx.programlib.getSnippet;
        var code = getSnippet('fs_precision');

        if (options.opacityMap) {
            code += 'varying vec2 vUv0;\n\n';
            code += 'uniform sampler2D texture_opacityMap;\n\n';
        }

        // FRAGMENT SHADER BODY
        code += getSnippet('common_main_begin');

        if (options.opacityMap) {
            code += '    if (texture2D(texture_opacityMap, vUv0).r < 0.25) discard;\n\n';
        }

        code += getSnippet('fs_depth_write');

        code += getSnippet('common_main_end');

        return code;
    }
};