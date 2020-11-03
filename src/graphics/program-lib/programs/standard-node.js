import { standard } from './standard.js';

// just do a shallow copy standard
var standardnode = Object.assign({}, standard);

// override a couple of functions - the overridden functions have been altered in standard to accept extra params
standardnode._generateKey = standard.generateKey;
standardnode.generateKey = function (options) {
    return this._generateKey(options, options._shaderGraphChunk.id);
};

standardnode._createShaderDefinition = standard.createShaderDefinition;
standardnode.createShaderDefinition = function (device, options) {
    var rootShaderGraph = null;
    var rootDeclGLSL = '';
    var rootCallGLSL = '';

    if (options._shaderGraphChunk) {
        rootShaderGraph = options._shaderGraphChunk;

        rootDeclGLSL = rootShaderGraph.generateRootDeclGlsl();
        rootCallGLSL = rootShaderGraph.generateRootCallGlsl();
    }

    var graphCode = [];

    if (options._shaderGraphChunk) {
        graphCode[0] = '';
        if (rootShaderGraph.getIoPortByName('OUT_vertOff')) {
            graphCode[0] += "#define SG_VS\n";
            graphCode[0] += rootDeclGLSL;
        }
    }

    if (options._shaderGraphChunk) {
        graphCode[1] = '';
        if (rootShaderGraph.getIoPortByName('OUT_vertOff')) {
            graphCode[1] += rootCallGLSL;
            graphCode[1] += "   vPositionW = vPositionW+OUT_vertOff;\n";
            graphCode[1] += "   gl_Position = matrix_viewProjection*vec4(vPositionW,1);\n";
        }
    }

    if (options._shaderGraphChunk) {
        graphCode[2] = '';
        if (rootShaderGraph.getIoPortByName('OUT_dAlpha') || rootShaderGraph.getIoPortByName('OUT_dNormalMap') || rootShaderGraph.getIoPortByName('OUT_dGlossiness') || rootShaderGraph.getIoPortByName('OUT_dSpecularity') || rootShaderGraph.getIoPortByName('OUT_dAlbedo') || rootShaderGraph.getIoPortByName('OUT_fragOut') || rootShaderGraph.getIoPortByName('OUT_dEmission')) {
            graphCode[2] += "#define SG_PS\n";
            graphCode[2] += rootDeclGLSL;
        }
    }

    if (options._shaderGraphChunk) {
        graphCode[3] = '';
        if (rootShaderGraph.getIoPortByName('OUT_dAlpha') || rootShaderGraph.getIoPortByName('OUT_dNormalMap') || rootShaderGraph.getIoPortByName('OUT_dGlossiness') || rootShaderGraph.getIoPortByName('OUT_dSpecularity') || rootShaderGraph.getIoPortByName('OUT_dAlbedo') || rootShaderGraph.getIoPortByName('OUT_fragOut') || rootShaderGraph.getIoPortByName('OUT_dEmission')) {
            graphCode[3] += rootCallGLSL;

            if (rootShaderGraph.getIoPortByName('OUT_dAlpha')) {
                graphCode[3] += 'dAlpha=OUT_dAlpha;\n';
            }

            if (rootShaderGraph.getIoPortByName('OUT_dNormalMap')) {
                graphCode[3] += 'dNormalMap=OUT_dNormalMap;\n';
            }

            if (rootShaderGraph.getIoPortByName('OUT_dGlossiness')) {
                graphCode[3] += 'dGlossiness=OUT_dGlossiness;\n';
            }

            if (rootShaderGraph.getIoPortByName('OUT_dSpecularity')) {
                graphCode[3] += 'dSpecularity=OUT_dSpecularity;\n';
            }

            if (rootShaderGraph.getIoPortByName('OUT_dAlbedo')) {
                graphCode[3] += 'dAlbedo=OUT_dAlbedo;\n';
            }

            if (rootShaderGraph.getIoPortByName('OUT_dEmission')) {
                graphCode[3] +=  'dEmission=OUT_dEmission;\n';
            }
        }
    }

    if (options._shaderGraphChunk) {
        graphCode[4] = '';
        if (rootShaderGraph.getIoPortByName('OUT_fragOut')) {
            graphCode[4] +=  'gl_FragColor = OUT_fragOut;\n';
        }
    }

    return this._createShaderDefinition(device, options, graphCode);
};

export { standardnode };
