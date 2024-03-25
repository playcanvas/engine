import {
    SEMANTIC_BLENDINDICES, SEMANTIC_BLENDWEIGHT, SEMANTIC_COLOR, SEMANTIC_POSITION, SEMANTIC_TEXCOORD0
} from '../../../platform/graphics/constants.js';
import { ShaderUtils } from '../../../platform/graphics/shader-utils.js';
import { shaderChunks } from '../chunks/chunks.js';

import {
    SHADER_DEPTH, SHADER_PICK
} from '../../constants.js';
import { ShaderPass } from '../../shader-pass.js';

import { ShaderGenerator } from './shader-generator.js';

class ShaderGeneratorBasic extends ShaderGenerator {
    generateKey(options) {
        let key = 'basic';
        if (options.fog)                    key += '_fog';
        if (options.alphaTest)              key += '_atst';
        if (options.vertexColors)           key += '_vcol';
        if (options.diffuseMap)             key += '_diff';
        if (options.skin)                   key += '_skin';

        if (options.screenSpace)            key += '_ss';
        if (options.useInstancing)          key += '_inst';
        if (options.useMorphPosition)       key += '_morphp';
        if (options.useMorphNormal)         key += '_morphn';
        if (options.useMorphTextureBased)   key += '_morpht';

        key += '_' + options.pass;
        return key;
    }

    createShaderDefinition(device, options) {
        // GENERATE ATTRIBUTES
        const attributes = {
            vertex_position: SEMANTIC_POSITION
        };
        if (options.skin) {
            attributes.vertex_boneWeights = SEMANTIC_BLENDWEIGHT;
            attributes.vertex_boneIndices = SEMANTIC_BLENDINDICES;
        }
        if (options.vertexColors) {
            attributes.vertex_color = SEMANTIC_COLOR;
        }
        if (options.diffuseMap) {
            attributes.vertex_texCoord0 = SEMANTIC_TEXCOORD0;
        }

        const shaderPassInfo = ShaderPass.get(device).getByIndex(options.pass);
        const shaderPassDefines = shaderPassInfo.shaderDefines;

        // GENERATE VERTEX SHADER
        let vshader = shaderPassDefines;

        // VERTEX SHADER DECLARATIONS
        vshader += shaderChunks.transformDeclVS;

        if (options.skin) {
            vshader += ShaderGenerator.skinCode(device);
            vshader += shaderChunks.transformSkinnedVS;
        } else {
            vshader += shaderChunks.transformVS;
        }

        if (options.vertexColors) {
            vshader += 'attribute vec4 vertex_color;\n';
            vshader += 'varying vec4 vColor;\n';
        }
        if (options.diffuseMap) {
            vshader += 'attribute vec2 vertex_texCoord0;\n';
            vshader += 'varying vec2 vUv0;\n';
        }

        if (options.pass === SHADER_DEPTH) {
            vshader += 'varying float vDepth;\n';
            vshader += '#ifndef VIEWMATRIX\n';
            vshader += '#define VIEWMATRIX\n';
            vshader += 'uniform mat4 matrix_view;\n';
            vshader += '#endif\n';
            vshader += '#ifndef CAMERAPLANES\n';
            vshader += '#define CAMERAPLANES\n';
            vshader += 'uniform vec4 camera_params;\n\n';
            vshader += '#endif\n';
        }

        // VERTEX SHADER BODY
        vshader += ShaderGenerator.begin();

        vshader += "   gl_Position = getPosition();\n";

        if (options.pass === SHADER_DEPTH) {
            vshader += "    vDepth = -(matrix_view * vec4(getWorldPosition(),1.0)).z * camera_params.x;\n";
        }

        if (options.vertexColors) {
            vshader += '    vColor = vertex_color;\n';
        }
        if (options.diffuseMap) {
            vshader += '    vUv0 = vertex_texCoord0;\n';
        }

        vshader += ShaderGenerator.end();

        // GENERATE FRAGMENT SHADER
        let fshader = shaderPassDefines;

        // FRAGMENT SHADER DECLARATIONS
        if (options.vertexColors) {
            fshader += 'varying vec4 vColor;\n';
        } else {
            fshader += 'uniform vec4 uColor;\n';
        }
        if (options.diffuseMap) {
            fshader += 'varying vec2 vUv0;\n';
            fshader += 'uniform sampler2D texture_diffuseMap;\n';
        }
        if (options.fog) {
            fshader += ShaderGenerator.fogCode(options.fog);
        }
        if (options.alphaTest) {
            fshader += shaderChunks.alphaTestPS;
        }

        if (options.pass === SHADER_DEPTH) {
            // ##### SCREEN DEPTH PASS #####
            fshader += 'varying float vDepth;\n';
            fshader += shaderChunks.packDepthPS;
        }

        // FRAGMENT SHADER BODY
        fshader += ShaderGenerator.begin();

        // Read the map texels that the shader needs
        if (options.vertexColors) {
            fshader += '    gl_FragColor = vColor;\n';
        } else {
            fshader += '    gl_FragColor = uColor;\n';
        }
        if (options.diffuseMap) {
            fshader += '    gl_FragColor *= texture2D(texture_diffuseMap, vUv0);\n';
        }

        if (options.alphaTest) {
            fshader += "   alphaTest(gl_FragColor.a);\n";
        }

        if (options.pass !== SHADER_PICK) {
            if (options.pass === SHADER_DEPTH) {
                // ##### SCREEN DEPTH PASS #####
                fshader += "    gl_FragColor = packFloat(vDepth);\n";
            } else {
                // ##### FORWARD PASS #####
                if (options.fog) {
                    fshader += "   glFragColor.rgb = addFog(gl_FragColor.rgb);\n";
                }
            }
        }

        fshader += ShaderGenerator.end();

        return ShaderUtils.createDefinition(device, {
            name: 'BasicShader',
            attributes: attributes,
            vertexCode: vshader,
            fragmentCode: fshader
        });
    }
}

const basic = new ShaderGeneratorBasic();

export { basic };
