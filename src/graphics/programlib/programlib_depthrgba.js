pc.gfx.programlib.depthrgba = {
    generateKey: function (device, options) {
        var key = "depthrgba";
        if (options.skin) key += "_skin";
        if (options.opacityMap) key += "_opam";
        return key;
    },

    createShaderDefinition: function (device, options) {
        /////////////////////////
        // GENERATE ATTRIBUTES //
        /////////////////////////
        var attributes = {
            vertex_position: pc.gfx.SEMANTIC_POSITION
        }
        if (options.skin) {
            attributes.vertex_boneWeights = pc.gfx.SEMANTIC_BLENDWEIGHT;
            attributes.vertex_boneIndices = pc.gfx.SEMANTIC_BLENDINDICES;
        }
        if (options.opacityMap) {
            attributes.vertex_texCoord0 = pc.gfx.SEMANTIC_TEXCOORD0;
        }

        ////////////////////////////
        // GENERATE VERTEX SHADER //
        ////////////////////////////
        var getSnippet = pc.gfx.programlib.getSnippet;
        var code = '';

        // VERTEX SHADER DECLARATIONS
        if (options.skin) {
            code += getSnippet(device, 'vs_skin_position_decl');
        } else {
            code += getSnippet(device, 'vs_static_position_decl');
        }

        if (options.opacityMap) {
            code += "attribute vec2 vertex_texCoord0;\n\n";
            code += 'varying vec2 vUv0;\n\n';
        }

        // VERTEX SHADER BODY
        code += getSnippet(device, 'common_main_begin');

        // Skinning is performed in world space
        if (options.skin) {
            code += getSnippet(device, 'vs_skin_position');
        } else {
            code += getSnippet(device, 'vs_static_position');
        }

        if (options.opacityMap) {
            code += '    vUv0 = vertex_texCoord0;\n';
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

        // Packing a float in GLSL with multiplication and mod
        // http://blog.gradientstudios.com/2012/08/23/shadow-map-improvement
        code += 'vec4 packFloat(float depth)\n';
        code += '{\n';
        code += '    const vec4 bit_shift = vec4(256.0 * 256.0 * 256.0, 256.0 * 256.0, 256.0, 1.0);\n';
        code += '    const vec4 bit_mask  = vec4(0.0, 1.0 / 256.0, 1.0 / 256.0, 1.0 / 256.0);\n';
                     // combination of mod and multiplication and division works better
        code += '    vec4 res = mod(depth * bit_shift * vec4(255), vec4(256) ) / vec4(255);\n';
        code += '    res -= res.xxyz * bit_mask;\n';
        code += '    return res;\n';
        code += '}\n\n';

        // FRAGMENT SHADER BODY
        code += getSnippet(device, 'common_main_begin');

        if (options.opacityMap) {
            code += '    if (texture2D(texture_opacityMap, vUv0).r < 0.25) discard;\n\n';
        }

        code += '    gl_FragData[0] = packFloat(gl_FragCoord.z);\n';

        code += getSnippet(device, 'common_main_end');

        var fshader = code;

        return {
            attributes: attributes,
            vshader: vshader,
            fshader: fshader
        };
    }
};