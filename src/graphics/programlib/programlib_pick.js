pc.gfx.programlib.pick = {
    generateKey: function (device, options) {
        var key = "pick";
        if (options.skin) key += "_skin";
        return key;
    },

    generateVertexShader: function (device, options) {
        var getSnippet = pc.gfx.programlib.getSnippet;
        var code = '';

        // VERTEX SHADER DECLARATIONS
        if (options.skin) {
            code += getSnippet(device, 'vs_skin_position_decl');
        } else {
            code += getSnippet(device, 'vs_static_position_decl');
        }

        // VERTEX SHADER BODY
        code += getSnippet(device, 'common_main_begin');

        // Skinning is performed in world space
        if (options.skin) {
            code += getSnippet(device, 'vs_skin_position');
        } else {
            code += getSnippet(device, 'vs_static_position');
        }

        code += getSnippet(device, 'common_main_end');
        
        return code;
    },

    generateFragmentShader: function (device, options) {
        var getSnippet = pc.gfx.programlib.getSnippet;
        var code = getSnippet(device, 'fs_precision');

        code += getSnippet(device, 'fs_flat_color_decl');

        // FRAGMENT SHADER BODY
        code += getSnippet(device, 'common_main_begin');

        code += getSnippet(device, 'fs_flat_color');

        code += getSnippet(device, 'common_main_end');

        return code;
    }
};