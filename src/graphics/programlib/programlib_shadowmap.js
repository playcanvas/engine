pc.gfx.programlib.shadowmap = {
    generateKey: function (options) {
        var key = "shadowmap";
        if (options.skin) key += "_skin";
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

        // VERTEX SHADER BODY
        code += getSnippet('common_main_begin');

        // Skinning is performed in world space
        if (options.skin) {
            code += getSnippet('vs_skin_position');
        } else {
            code += getSnippet('vs_static_position');
        }

        code += getSnippet('common_main_end');
        
        return code;
    },

    generateFragmentShader: function (options) {
        var getSnippet = pc.gfx.programlib.getSnippet;
        var code = getSnippet('fs_precision');

        // FRAGMENT SHADER BODY
        code += getSnippet('common_main_begin');

        code += getSnippet('fs_depth_write');

        code += getSnippet('common_main_end');

        return code;
    }
};