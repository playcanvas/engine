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

        rootDeclGLSL = rootShaderGraph.generateRootDeclCodeString();
        rootCallGLSL = rootShaderGraph.generateRootCallCodeString();

        graphCode.vsDecl = '';
        if (rootShaderGraph.getIoPortByName('sgVertOff')) {
            graphCode.vsDecl += "#define SHADERGRAPH_VERTEXSHADER\n";
            graphCode.vsDecl += rootDeclGLSL;
        }

        graphCode.vsCode = '';
        if (graphCode.vsDecl) {
            graphCode.vsCode += rootCallGLSL;
            graphCode.vsCode += "   vPositionW = vPositionW+sgVertOff;\n";
            graphCode.vsCode += "   gl_Position = matrix_viewProjection*vec4(vPositionW,1);\n";
        }

        graphCode.psDecl = '';
        if (rootShaderGraph.getIoPortByName('sgAlpha') || rootShaderGraph.getIoPortByName('sgNormalMap') || rootShaderGraph.getIoPortByName('sgGlossiness') || rootShaderGraph.getIoPortByName('sgSpecularity') || rootShaderGraph.getIoPortByName('sgAlbedo') || rootShaderGraph.getIoPortByName('sgFragOut') || rootShaderGraph.getIoPortByName('sgEmission')) {
            graphCode.psDecl += "#define SHADERGRAPH_PIXELSHADER\n";
            graphCode.psDecl += rootDeclGLSL;
        }

        graphCode.psCode = '';
        if (graphCode.psDecl) {
            graphCode.psCode += rootCallGLSL;

            if (rootShaderGraph.getIoPortByName('sgAlpha')) {
                graphCode.psCode += 'dAlpha = sgAlpha;\n';
            }

            if (rootShaderGraph.getIoPortByName('sgNormalMap')) {
                graphCode.psCode += 'dNormalMap = sgNormalMap;\n';
                graphCode.needsNormal = true;
            }

            if (rootShaderGraph.getIoPortByName('sgGlossiness')) {
                graphCode.psCode += 'dGlossiness = sgGlossiness;\n';
                graphCode.needsNormal = true;
            }

            if (rootShaderGraph.getIoPortByName('sgSpecularity')) {
                graphCode.psCode += 'dSpecularity = sgSpecularity;\n';
                graphCode.needsNormal = true;
            }

            if (rootShaderGraph.getIoPortByName('sgAlbedo')) {
                graphCode.psCode += 'dAlbedo = sgAlbedo;\n';
            }

            if (rootShaderGraph.getIoPortByName('sgEmission')) {
                graphCode.psCode +=  'dEmission = sgEmission;\n';
            }
        }

        graphCode.psEnd = '';
        if (rootShaderGraph.getIoPortByName('sgFragOut')) {
            graphCode.psEnd +=  'gl_FragColor = sgFragOut;\n';
        }
    }

    return this._createShaderDefinition(device, options, graphCode);
};

export { standardnode };
