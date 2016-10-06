// Packed linear normalized depth

pc.programlib.depth = {
    generateKey: function (device, options) {
        var key = "depth";
        if (options.skin) key += "_skin";
        if (options.opacityMap) key += "_opam";
        if (options.instancing) key += "_inst";
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
        if (options.opacityMap) {
            attributes.vertex_texCoord0 = pc.SEMANTIC_TEXCOORD0;
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
            code += chunks.transformSkinnedVS;
        } else if (options.instancing) {
            attributes.instance_line1 = pc.SEMANTIC_TEXCOORD2;
            attributes.instance_line2 = pc.SEMANTIC_TEXCOORD3;
            attributes.instance_line3 = pc.SEMANTIC_TEXCOORD4;
            attributes.instance_line4 = pc.SEMANTIC_TEXCOORD5;
            code += chunks.instancingVS;
            code += chunks.transformInstancedVS;
        } else if (options.screenSpace) {
            code += chunks.transformScreenSpaceVS;
        } else {
            code += chunks.transformVS;
        }

        if (options.opacityMap) {
            code += "attribute vec2 vertex_texCoord0;\n\n";
            code += 'varying vec2 vUv0;\n\n';
        }
        code += 'varying float vDepth;\n';
        code += 'uniform mat4 matrix_view;\n';
        code += 'uniform float camera_far;\n\n';

        // VERTEX SHADER BODY
        code += pc.programlib.begin();

        code += "   gl_Position = getPosition();\n";

        if (options.opacityMap) {
            code += '    vUv0 = vertex_texCoord0;\n';
        }

        code += '    vDepth = -(matrix_view * vec4(getWorldPosition(),1.0)).z / camera_far;\n';

        code += pc.programlib.end();

        var vshader = code;

        //////////////////////////////
        // GENERATE FRAGMENT SHADER //
        //////////////////////////////
        code = pc.programlib.precisionCode(device);

        if (options.opacityMap) {
            code += 'varying vec2 vUv0;\n\n';
            code += 'uniform sampler2D texture_opacityMap;\n\n';
            code += chunks.alphaTestPS;
        }
        code += 'varying float vDepth;\n\n';


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
        code += pc.programlib.begin();

        if (options.opacityMap) {
            code += '    alphaTest(texture2D(texture_opacityMap, vUv0).' + options.opacityChannel[0] + ' );\n\n';
        }

        code += "float depth = vDepth;\n";
        code += "gl_FragColor = packFloat(depth);\n";

        //code += "float color = 1.0 - smoothstep(camera_near, camera_far, depth);";
        //code += "gl_FragColor = vec4(vec3(color), 1.0);";

        code += pc.programlib.end();
        var fshader = code;

        return {
            attributes: attributes,
            vshader: vshader,
            fshader: fshader
        };
    }
};
