import { programlib } from './program-lib.js';
import { shaderChunks } from '../chunks.js';

programlib.basic = {
    generateKey: function (options) {
        var key = 'basic';
        if (options.fog)          key += '_fog';
        if (options.alphaTest)    key += '_atst';
        if (options.vertexColors) key += '_vcol';
        if (options.diffuseMap)   key += '_diff';
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
        if (options.vertexColors) {
            attributes.vertex_color = pc.SEMANTIC_COLOR;
        }
        if (options.diffuseMap) {
            attributes.vertex_texCoord0 = pc.SEMANTIC_TEXCOORD0;
        }

        var chunks = shaderChunks;

        // GENERATE VERTEX SHADER
        var code = '';

        // VERTEX SHADER DECLARATIONS
        code += chunks.transformDeclVS;

        if (options.skin) {
            code += programlib.skinCode(device);
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

        // VERTEX SHADER BODY
        code += programlib.begin();

        code += "   gl_Position = getPosition();\n";

        if (options.pass === pc.SHADER_DEPTH) {
            code += "    vDepth = -(matrix_view * vec4(getWorldPosition(),1.0)).z * camera_params.x;\n";
        }

        if (options.vertexColors) {
            code += '    vColor = vertex_color;\n';
        }
        if (options.diffuseMap) {
            code += '    vUv0 = vertex_texCoord0;\n';
        }

        code += programlib.end();

        var vshader = code;

        // GENERATE FRAGMENT SHADER
        code = programlib.precisionCode(device);

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
            code += programlib.fogCode(options.fog);
        }
        if (options.alphatest) {
            code += chunks.alphaTestPS;
        }

        if (options.pass === pc.SHADER_DEPTH) {
            // ##### SCREEN DEPTH PASS #####
            code += 'varying float vDepth;\n';
            code += chunks.packDepthPS;
        }

        // FRAGMENT SHADER BODY
        code += programlib.begin();

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

        code += programlib.end();

        var fshader = code;

        return {
            attributes: attributes,
            vshader: vshader,
            fshader: fshader
        };
    }
};
