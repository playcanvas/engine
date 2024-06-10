import {
    SEMANTIC_BLENDINDICES, SEMANTIC_BLENDWEIGHT, SEMANTIC_COLOR, SEMANTIC_POSITION, SEMANTIC_TEXCOORD0
} from '../../../platform/graphics/constants.js';
import { ShaderUtils } from '../../../platform/graphics/shader-utils.js';
import { shaderChunks } from '../chunks/chunks.js';
import { ShaderPass } from '../../shader-pass.js';
import { ShaderGenerator } from './shader-generator.js';

const vShader = `

    #include "shaderPassDefines"
    #include "transformDeclVS"

    #ifdef SKIN
        #include "skinCode"
    #endif

    #include "transformVS"

    #ifdef VERTEX_COLORS
        attribute vec4 vertex_color;
        varying vec4 vColor;
    #endif

    #ifdef DIFFUSE_MAP
        attribute vec2 vertex_texCoord0;
        varying vec2 vUv0;
    #endif

    #ifdef DEPTH_PASS
        varying float vDepth;
        
        #ifndef VIEWMATRIX
        #define VIEWMATRIX
            uniform mat4 matrix_view;
        #endif

        #ifndef CAMERAPLANES
        #define CAMERAPLANES
            uniform vec4 camera_params;
        #endif
    #endif

    void main(void) {
        gl_Position = getPosition();

        #ifdef DEPTH_PASS
            vDepth = -(matrix_view * vec4(getWorldPosition(),1.0)).z * camera_params.x;
        #endif        

        #ifdef VERTEX_COLORS
            vColor = vertex_color;
        #endif

        #ifdef DIFFUSE_MAP
            vUv0 = vertex_texCoord0;
        #endif
    }
`;

const fShader = `

    #include "shaderPassDefines"

    #ifdef VERTEX_COLORS
        varying vec4 vColor;
    #else
        uniform vec4 uColor;
    #endif

    #ifdef DIFFUSE_MAP
        varying vec2 vUv0;
        uniform sampler2D texture_diffuseMap;
    #endif

    #ifdef FOG
        #include "fogCode"
    #endif

    #ifdef ALPHA_TEST
        #include "alphaTestPS"
    #endif

    #ifdef DEPTH_PASS
        varying float vDepth;
        #include "packDepthPS"
    #endif

    #ifdef PICK_PASS
        uniform uint meshInstanceId;
    #endif

    void main(void) {

        #ifdef VERTEX_COLORS
            gl_FragColor = vColor;
        #else
            gl_FragColor = uColor;
        #endif

        #ifdef DIFFUSE_MAP
            gl_FragColor *= texture2D(texture_diffuseMap, vUv0);
        #endif

        #ifdef ALPHA_TEST
            alphaTest(gl_FragColor.a);
        #endif

        #ifdef PICK_PASS

            const vec4 inv = vec4(1.0 / 255.0, 1.0 / 255.0, 1.0 / 255.0, 1.0 / 255.0);
            const uvec4 shifts = uvec4(16, 8, 0, 24);
            uvec4 col = (uvec4(meshInstanceId) >> shifts) & uvec4(0xff);
            gl_FragColor = vec4(col) * inv;

        #else

            #ifdef DEPTH_PASS
                gl_FragColor = packFloat(vDepth);
            #else
                #ifdef FOG
                    glFragColor.rgb = addFog(gl_FragColor.rgb);
                #endif
            #endif
        #endif
    }
`;

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

    createAttributesDefinition(definitionOptions, options) {

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

        definitionOptions.attributes = attributes;
    }

    createVertexDefinition(device, definitionOptions, options, shaderPassInfo) {

        const includes = new Map();
        const defines = new Map();

        includes.set('shaderPassDefines', shaderPassInfo.shaderDefines);
        includes.set('transformDeclVS', shaderChunks.transformDeclVS);
        includes.set('transformVS', shaderChunks.transformVS);
        includes.set('skinCode', ShaderGenerator.skinCode(device));

        if (options.skin) defines.set('SKIN', true);
        if (options.vertexColors) defines.set('VERTEX_COLORS', true);
        if (options.diffuseMap) defines.set('DIFFUSE_MAP', true);

        definitionOptions.vertexCode = vShader;
        definitionOptions.vertexIncludes = includes;
        definitionOptions.vertexDefines = defines;
    }

    createFragmentDefinition(definitionOptions, options, shaderPassInfo) {

        const includes = new Map();
        const defines = new Map();

        includes.set('shaderPassDefines', shaderPassInfo.shaderDefines);
        includes.set('fogCode', ShaderGenerator.fogCode(options.fog));
        includes.set('alphaTestPS', shaderChunks.alphaTestPS);
        includes.set('packDepthPS', shaderChunks.packDepthPS);

        if (options.vertexColors) defines.set('VERTEX_COLORS', true);
        if (options.diffuseMap) defines.set('DIFFUSE_MAP', true);
        if (options.fog) defines.set('FOG', true);
        if (options.alphaTest) defines.set('ALPHA_TEST', true);

        definitionOptions.fragmentCode = fShader;
        definitionOptions.fragmentIncludes = includes;
        definitionOptions.fragmentDefines = defines;
    }

    createShaderDefinition(device, options) {

        const definitionOptions = {
            name: 'BasicShader'
        };

        const shaderPassInfo = ShaderPass.get(device).getByIndex(options.pass);
        this.createAttributesDefinition(definitionOptions, options);
        this.createVertexDefinition(device, definitionOptions, options, shaderPassInfo);
        this.createFragmentDefinition(definitionOptions, options, shaderPassInfo);

        return ShaderUtils.createDefinition(device, definitionOptions);
    }
}

const basic = new ShaderGeneratorBasic();

export { basic };
