import { standard } from './standard.js';

import { ShaderGraphRegistry } from '../../../scene/materials/shader-graph-registry.js';

// just do a shallow copy standard
var standardnode = Object.assign({}, standard);

// override a couple of functions - the overridden functions have been altered in standard to accept extra params
standardnode._generateKey = standard.generateKey;
standardnode.generateKey = function (options) {
    return this._generateKey(options, options._shaderGraphChunkId);
};

standardnode._createShaderDefinition = standard.createShaderDefinition;
standardnode.createShaderDefinition = function (device, options) {
    var rootShaderGraph = null;
    var rootDeclGLSL = '';
    var rootCallGLSL = '';

    if (options._shaderGraphChunkId) {
        rootShaderGraph = ShaderGraphRegistry.getNode(options._shaderGraphChunkId);

        rootDeclGLSL = rootShaderGraph.generateRootDeclGlsl();
        rootCallGLSL = rootShaderGraph.generateRootCallGlsl();
    }

    var graphCodes = [];

    if (options._shaderGraphChunkId) {
        graphCodes[0] = "#define SG_VS\n";
        graphCodes[0] += rootDeclGLSL;
    }

    if (options._shaderGraphChunkId) {
        graphCodes[1] = '';
        if (rootShaderGraph.getIoPortByName('OUT_vertOff')) {
            graphCodes[1] += rootCallGLSL;
            graphCodes[1] += "   vPositionW = vPositionW+OUT_vertOff;\n";
            graphCodes[1] += "   gl_Position = matrix_viewProjection*vec4(vPositionW,1);\n";
        }
    }

    if (options._shaderGraphChunkId) {
        graphCodes[2] = "#define SG_PS\n";
        graphCodes[2] += rootDeclGLSL;
    }

    if (options._shaderGraphChunkId) {
        graphCodes[3] = rootCallGLSL;

        if (rootShaderGraph.getIoPortByName('OUT_dAlpha')) {
            graphCodes[3] += 'dAlpha=OUT_dAlpha;\n';
        }
        if (options.alphaTest) {
            graphCodes[3] += "   alphaTest(dAlpha);\n";
        }

        if (rootShaderGraph.getIoPortByName('OUT_dNormalW')) {
            graphCodes[3] += 'dNormalW=OUT_dNormalW;\n';
        }

        if (rootShaderGraph.getIoPortByName('OUT_dGlossiness')) {
            graphCodes[3] += 'dGlossiness=OUT_dGlossiness;\n';
        }
        if (options.useSpecular) {
            graphCodes[3] += "   getReflDir();\n";
        }

        if (rootShaderGraph.getIoPortByName('OUT_dAlbedo')) {
            graphCodes[3] += 'dAlbedo=OUT_dAlbedo;\n';
        }
    }

    if (options._shaderGraphChunkId) {
        graphCodes[4] = '';

        if (rootShaderGraph.getIoPortByName('OUT_fragOut')) {
            graphCodes[4] +=  'gl_FragColor = OUT_fragOut;\n';
        }

        if (rootShaderGraph.getIoPortByName('OUT_dEmission')) {
            graphCodes[4] +=  'gl_FragColor.rgb += OUT_dEmission;\n';
        }
    }

    return this._createShaderDefinition(device, options, graphCodes);
};

export { standardnode };
