// Packed normalized depth
// Ortho: simple Z
// Persp: linear distance

pc.programlib.depthrgba = {
    generateKey: function (device, options) {
        var key = "depthrgba";
        if (options.skin) key += "_skin";
        if (options.opacityMap) key += "_opam" + options.opacityChannel;
        if (options.type) key += options.type;
        if (options.instancing) key += "_inst";
        key += "_" + options.shadowType;
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

        if (options.type !== pc.LIGHTTYPE_DIRECTIONAL) {
            code += 'varying vec3 worldPos;\n\n';
        }

        // VERTEX SHADER BODY
        code += pc.programlib.begin();

        code += "   gl_Position = getPosition();\n";

        if (options.opacityMap) {
            code += '    vUv0 = vertex_texCoord0;\n';
        }

        if (options.type !== pc.LIGHTTYPE_DIRECTIONAL) {
            code += '    worldPos = dPositionW;\n';
        }

        code += pc.programlib.end();

        var vshader = code;

        //////////////////////////////
        // GENERATE FRAGMENT SHADER //
        //////////////////////////////

        code = "";

        if (device.extStandardDerivatives && !device.webgl2) {
            code += "#extension GL_OES_standard_derivatives : enable\n\n";
        }

        code += pc.programlib.precisionCode(device);

        if (device.extStandardDerivatives && !device.webgl2) {
            code += 'uniform vec2 polygonOffset;\n';
        }

        if (options.shadowType === pc.SHADOW_VSM32) {
            if (device.extTextureFloatHighPrecision) {
                code += '#define VSM_EXPONENT 15.0\n\n';
            } else {
                code += '#define VSM_EXPONENT 5.54\n\n';
            }
        } else if (options.shadowType === pc.SHADOW_VSM16) {
            code += '#define VSM_EXPONENT 5.54\n\n';
        }

        if (options.opacityMap) {
            code += 'varying vec2 vUv0;\n';
            code += 'uniform sampler2D texture_opacityMap;\n';
            code += chunks.alphaTestPS;
        }

        if (options.type !== pc.LIGHTTYPE_DIRECTIONAL) {
            code += 'varying vec3 worldPos;\n';
            code += 'uniform vec3 view_position;\n';
            code += 'uniform float light_radius;\n';
        }

        if (options.shadowType === pc.SHADOW_PCF3 && (!device.webgl2 || options.type === pc.LIGHTTYPE_POINT)) {
            code += chunks.packDepthPS;
        } else if (options.shadowType === pc.SHADOW_VSM8) {
            code += "vec2 encodeFloatRG( float v ) {\n\
                     vec2 enc = vec2(1.0, 255.0) * v;\n\
                     enc = fract(enc);\n\
                     enc -= enc.yy * vec2(1.0/255.0, 1.0/255.0);\n\
                     return enc;\n\
                    }\n";
        }

        // FRAGMENT SHADER BODY
        code += pc.programlib.begin();

        if (options.opacityMap) {
            code += '    alphaTest( texture2D(texture_opacityMap, vUv0).' + options.opacityChannel + ' );\n\n';
        }

        var isVsm = options.shadowType === pc.SHADOW_VSM8 || options.shadowType === pc.SHADOW_VSM16 || options.shadowType === pc.SHADOW_VSM32;

        if (options.type === pc.LIGHTTYPE_POINT || (isVsm && options.type !== pc.LIGHTTYPE_DIRECTIONAL)) {
            code += "   float depth = min(distance(view_position, worldPos) / light_radius, 0.99999);\n"
        } else {
            code += "   float depth = gl_FragCoord.z;\n"
        }

        if (options.shadowType === pc.SHADOW_PCF3 && (!device.webgl2 || options.type === pc.LIGHTTYPE_POINT)) {
            if (device.extStandardDerivatives && !device.webgl2) {
                code += "   float minValue = 2.3374370500153186e-10; //(1.0 / 255.0) / (256.0 * 256.0 * 256.0);\n";
                code += "   depth += polygonOffset.x * max(abs(dFdx(depth)), abs(dFdy(depth))) + minValue * polygonOffset.y;\n";
                code += "   gl_FragData[0] = packFloat(depth);\n";
            } else {
                code += "   gl_FragData[0] = packFloat(depth);\n";
            }
        } else if (options.shadowType === pc.SHADOW_PCF3 || options.shadowType === pc.SHADOW_PCF5) {
            code += "   gl_FragData[0] = vec4(1.0);\n"; // just the simpliest code, color is not written anyway
        } else if (options.shadowType === pc.SHADOW_VSM8) {
            code += "   gl_FragColor = vec4(encodeFloatRG(depth), encodeFloatRG(depth*depth));\n";
        } else {
            code += chunks.storeEVSMPS;
        }

        code += pc.programlib.end();

        var fshader = code;

        return {
            attributes: attributes,
            vshader: vshader,
            fshader: fshader
        };
    }
};
