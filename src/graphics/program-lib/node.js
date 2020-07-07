import {
    SEMANTIC_BLENDINDICES, SEMANTIC_BLENDWEIGHT, SEMANTIC_COLOR, SEMANTIC_NORMAL, SEMANTIC_POSITION, SEMANTIC_TEXCOORD0
} from '../graphics.js';
import { shaderChunks } from '../chunks.js';

 //import {
 //   SHADER_DEPTH, SHADER_FORWARD, SHADER_FORWARDHDR, SHADER_PICK, SHADER_SHADOW
 //} from '../../scene/constants.js';

import { programlib } from './program-lib.js';

var node = {
    generateKey: function (options) {
        var key = 'node';
        if (options.fog)          key += '_fog';
        if (options.alphaTest)    key += '_atst';
        if (options.shaderGraph) key += options.shaderGraph.key;
//        key += '_' + options.pass;
        return key;
    },

    createShaderDefinition: function (device, options) {
        var n;

        // generate graph
        options.shaderGraph.generateShaderGraph();

        // GENERATE ATTRIBUTES
        var attributes = {
            vertex_position: SEMANTIC_POSITION,
            vertex_normal: SEMANTIC_NORMAL,
            vertex_color: SEMANTIC_COLOR,
            vertex_texCoord0: SEMANTIC_TEXCOORD0
        };
        if (options.skin) {
            attributes.vertex_boneWeights = SEMANTIC_BLENDWEIGHT;
            attributes.vertex_boneIndices = SEMANTIC_BLENDINDICES;
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

//      code += 'attribute vec3 vertex_position;\n';
        code += 'varying vec3 vPosition;\n';

        code += 'attribute vec3 vertex_normal;\n';
        code += 'varying vec3 vNormal;\n';

        code += 'attribute vec4 vertex_color;\n';
        code += 'varying vec4 vColor;\n';

        code += 'attribute vec2 vertex_texCoord0;\n';
        code += 'varying vec2 vUv0;\n';

        /*
        if (options.pass === SHADER_PICK) {
            // ##### PICK PASS #####
        } else if (options.pass === SHADER_DEPTH) {
            // ##### SCREEN DEPTH PASS #####
            code += "    gl_FragColor = packFloat(vDepth);\n";
        } 
        else if (options.pass === SHADER_FORWARD || options.pass === SHADER_FORWARDHDR )
        {
            
        }*/

     // if (options.pass === SHADER_DEPTH) {
     //     code += 'varying float vDepth;\n';
     //     code += '#ifndef VIEWMATRIX\n';
     //     code += '#define VIEWMATRIX\n';
     //     code += 'uniform mat4 matrix_view;\n';
     //     code += '#endif\n';
     //     code += '#ifndef CAMERAPLANES\n';
     //     code += '#define CAMERAPLANES\n';
     //     code += 'uniform vec4 camera_params;\n\n';
     //     code += '#endif\n';
     // }
        for (n = 0; n < options.shaderGraph.params.length; n++) {
            code += 'uniform ' + options.shaderGraph.params[n].type + ' ' + options.shaderGraph.params[n].name + ';\n';
        }

        code += 'vec3 getWorldPositionNM(){return (getModelMatrix()*vec4(vertex_position, 1.0)).xyz;}\n';
        code += 'vec3 getWorldNormalNM(){return (getModelMatrix()*vec4(vertex_normal, 0.0)).xyz;}\n';

        if (options.shaderGraph) {
            code += "#define SG_VS\n";
            code += options.shaderGraph.shaderGraphFuncString;
        }

        // VERTEX SHADER BODY
        code += programlib.begin();

        if (options.shaderGraph) {
            code += options.shaderGraph.shaderGraphNodeString;
            code += "   vPosition = getWorldPositionNM()+shaderGraphVertexOffset;\n";
            code += "   gl_Position = matrix_viewProjection*vec4(vPosition,1);\n";            
        } else {
            code += "   vPosition = getWorldPositionNM();\n";
            code += "   gl_Position = matrix_viewProjection*vec4(vPosition,1);\n";
        }
/*
        if (options.pass === SHADER_DEPTH) 
        {
            code += "    vDepth = -(matrix_view * vec4(getWorldPosition(),1.0)).z * camera_params.x;\n";
        }
        else if (options.pass === SHADER_FORWARD || options.pass === SHADER_FORWARDHDR )
        {
            //vert lighting!

        }    

        if (options.pass === SHADER_PICK) {
            // ##### PICK PASS #####
        } else if (options.pass === SHADER_DEPTH) {
            // ##### SCREEN DEPTH PASS #####
            code += "    gl_FragColor = packFloat(vDepth);\n";
        } 
        else if (options.pass === SHADER_FORWARD || options.pass === SHADER_FORWARDHDR )
        {
            
        }    */   

//      code += '    vNormal = getNormal(vertex_normal);\n';
        //code += '    vNormal = vertex_normal;/*getWorldNormalNM();*/\n';
        code += '    vNormal = normalize(getWorldNormalNM());\n';
        code += '    vColor = vertex_color;\n';
        code += '    vUv0 = vertex_texCoord0;\n';

        code += '   calcVertexLightingVS(vPosition, vNormal);\n';

        code += programlib.end();

        var vshader = code;

        var startCode = "";
        if (device.webgl2) {
            startCode = programlib.versionCode(device);
            if (chunks.extensionVS) {
                startCode += chunks.extensionVS + "\n";
            }
            vshader = startCode + chunks.gles3VS + vshader;
        } else {
            if (chunks.extensionVS) {
                startCode = chunks.extensionVS + "\n";
            }
            vshader = startCode + vshader;
        }

        // GENERATE FRAGMENT SHADER
        if (options.forceFragmentPrecision && options.forceFragmentPrecision != "highp" &&
            options.forceFragmentPrecision !== "mediump" && options.forceFragmentPrecision !== "lowp")
            options.forceFragmentPrecision = null;

        if (options.forceFragmentPrecision) {
            if (options.forceFragmentPrecision === "highp" && device.maxPrecision !== "highp") options.forceFragmentPrecision = "mediump";
            if (options.forceFragmentPrecision === "mediump" && device.maxPrecision === "lowp") options.forceFragmentPrecision = "lowp";
        }

        var fshader;
        code = '';

        if (device.webgl2) {
            code += programlib.versionCode(device);
        }

        if (device.extStandardDerivatives && !device.webgl2) {
            code += "#extension GL_OES_standard_derivatives : enable\n\n";
        }
        if (chunks.extensionPS) {
            code += chunks.extensionPS + "\n";
        }

        if (device.webgl2) {
            code += chunks.gles3PS;
        }

        code += options.forceFragmentPrecision ? "precision " + options.forceFragmentPrecision + " float;\n\n" : programlib.precisionCode(device);

        // FRAGMENT SHADER DECLARATIONS

        code += 'uniform vec3 view_position;\n';

        code += 'varying vec3 vPosition;\n';
        code += 'varying vec3 vNormal;\n';
        code += 'varying vec4 vColor;\n';
        code += 'varying vec2 vUv0;\n';

        if (options.fog) {
            code += programlib.fogCode(options.fog);
        }
        if (options.alphatest) {
            code += chunks.alphaTestPS;
        }

        // if (options.pass === SHADER_DEPTH) {
        //     // ##### SCREEN DEPTH PASS #####
        //     code += 'varying float vDepth;\n';
        //     code += chunks.packDepthPS;
        // }

        for (n = 0; n < options.shaderGraph.params.length; n++) {
            code += 'uniform ' + options.shaderGraph.params[n].type + ' ' + options.shaderGraph.params[n].name + ';\n';
        }

        if (options.shaderGraph) {
            code += "#define SG_PS\n";
            code += options.shaderGraph.shaderGraphFuncString;
        }
//        if (options.nodeInputs.emissiveColor) code += options.nodeInputs.emissiveColor;
//        if (options.nodeInputs.baseColor) code += options.nodeInputs.baseColor;
//        if (options.nodeInputs.opacity) code += options.nodeInputs.opacity;
//        if (options.nodeInputs.normal) code += options.nodeInputs.normal;
//        if (options.nodeInputs.metallic) code += options.nodeInputs.metallic;
//        if (options.nodeInputs.roughness) code += options.nodeInputs.roughness;

        // FRAGMENT SHADER BODY
        code += programlib.begin();

        if (options.shaderGraph) {
            code += options.shaderGraph.shaderGraphNodeString;
        }
        // code += NodeMaterial.generateLightingCode(options);

        // code += '    gl_FragColor = getEmissiveColor()+lightGGX(getBaseColor(), getOpacity(), getNormal(), getMetallic(), getRoughness());\n';
//        code += '    gl_FragColor = vec4(getEmissiveColor(),1);\n';
        // code += '    gl_FragColor = '+options.shaderGraph.funcName+ root(getEmissiveColor(),1);\n';

        if (options.alphatest) {
            code += "   alphaTest(gl_FragColor.a);\n";
        }

        // TODO implement passes
        // if (options.pass === SHADER_PICK) {
        //     // ##### PICK PASS #####
        // } else if (options.pass === SHADER_DEPTH) {
        //     // ##### SCREEN DEPTH PASS #####
        //     code += "    gl_FragColor = packFloat(vDepth);\n";
        // } else {
            // ##### FORWARD PASS #####
        if (options.fog) {
            code += "   glFragColor.rgb = addFog(gl_FragColor.rgb);\n";
        }
        // }

        code += programlib.end();

        var fshader = code;

        return {
            attributes: attributes,
            vshader: vshader,
            fshader: fshader
        };
    }
};

export { node };
