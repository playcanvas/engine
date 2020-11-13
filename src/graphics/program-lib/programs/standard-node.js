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

    var graphCode = {};

    graphCode.needsNormal = false;

    if (options._shaderGraphChunk) {
        rootShaderGraph = options._shaderGraphChunk;

        rootDeclGLSL = rootShaderGraph.generateRootDeclGlsl();
        rootCallGLSL = rootShaderGraph.generateRootCallGlsl();

        graphCode.vsDecl = '';
        if (rootShaderGraph.getIoPortByName('OUT_vertOff')) {
            graphCode.vsDecl += "#define SG_VS\n";
            graphCode.vsDecl += rootDeclGLSL;
        }

        graphCode.vsCode = '';
        if (graphCode.vsDecl) {
            graphCode.vsCode += rootCallGLSL;
            graphCode.vsCode += "   vPositionW = vPositionW+OUT_vertOff;\n";
            graphCode.vsCode += "   gl_Position = matrix_viewProjection*vec4(vPositionW,1);\n";
        }

        graphCode.psDecl = '';
        if (rootShaderGraph.getIoPortByName('OUT_dAlpha') || rootShaderGraph.getIoPortByName('OUT_dNormalMap') || rootShaderGraph.getIoPortByName('OUT_dGlossiness') || rootShaderGraph.getIoPortByName('OUT_dSpecularity') || rootShaderGraph.getIoPortByName('OUT_dAlbedo') || rootShaderGraph.getIoPortByName('OUT_fragOut') || rootShaderGraph.getIoPortByName('OUT_dEmission')) {
            graphCode.psDecl += "#define SG_PS\n";
            graphCode.psDecl += rootDeclGLSL;
        }

        graphCode.psCode = '';
        if (graphCode.psDecl) {
            graphCode.psCode += rootCallGLSL;

            if (rootShaderGraph.getIoPortByName('OUT_dAlpha')) {
                graphCode.psCode += 'dAlpha=OUT_dAlpha;\n';
            }

            if (rootShaderGraph.getIoPortByName('OUT_dNormalMap')) {
                graphCode.psCode += 'dNormalMap=OUT_dNormalMap;\n';
                graphCode.needsNormal = true;
            }

            if (rootShaderGraph.getIoPortByName('OUT_dGlossiness')) {
                graphCode.psCode += 'dGlossiness=OUT_dGlossiness;\n';
                graphCode.needsNormal = true;
            }

            if (rootShaderGraph.getIoPortByName('OUT_dSpecularity')) {
                graphCode.psCode += 'dSpecularity=OUT_dSpecularity;\n';
                graphCode.needsNormal = true;
            }

            if (rootShaderGraph.getIoPortByName('OUT_dAlbedo')) {
                graphCode.psCode += 'dAlbedo=OUT_dAlbedo;\n';
            }

            if (rootShaderGraph.getIoPortByName('OUT_dEmission')) {
                graphCode.psCode +=  'dEmission=OUT_dEmission;\n';
            }
        }

        graphCode.psEnd = '';
        if (rootShaderGraph.getIoPortByName('OUT_fragOut')) {
            graphCode.psEnd +=  'gl_FragColor = OUT_fragOut;\n';
        }
    }

    return this._createShaderDefinition(device, options, graphCode);
};

export { standardnode };
