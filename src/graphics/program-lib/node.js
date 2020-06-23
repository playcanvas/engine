pc.programlib.node = {
    generateKey: function (options) {
        var key = 'node';
        if (options.fog)          key += '_fog';
        if (options.alphaTest)    key += '_atst';
        if (options.shaderGraphNode) key += options.shaderGraphNode.key;
//        key += '_' + options.pass;
        return key;
    },

    createShaderDefinition: function (device, options) {
        // GENERATE ATTRIBUTES
        var attributes = {
            vertex_position: pc.SEMANTIC_POSITION,
            vertex_normal: pc.SEMANTIC_NORMAL,
            vertex_color: pc.SEMANTIC_COLOR,
            vertex_texCoord0: pc.SEMANTIC_TEXCOORD0
        };
        if (options.skin) {
            attributes.vertex_boneWeights = pc.SEMANTIC_BLENDWEIGHT;
            attributes.vertex_boneIndices = pc.SEMANTIC_BLENDINDICES;
        }

        var chunks = pc.shaderChunks;

        // GENERATE VERTEX SHADER
        var code = '';

        // VERTEX SHADER DECLARATIONS
        code += chunks.transformDeclVS;

        if (options.skin) {
            code += pc.programlib.skinCode(device);
            code += chunks.transformSkinnedVS;
        } else {
            code += chunks.transformVS;
        }

        if (1)
        {
//            code += 'attribute vec3 vertex_position;\n';
            code += 'varying vec3 vPosition;\n';

            code += 'attribute vec3 vertex_normal;\n';
            code += 'varying vec3 vNormal;\n';

            code += 'attribute vec4 vertex_color;\n';
            code += 'varying vec4 vColor;\n';

            code += 'attribute vec2 vertex_texCoord0;\n';
            code += 'varying vec2 vUv0;\n';
        }

     /*   if (options.pass === pc.SHADER_DEPTH) {
            code += 'varying float vDepth;\n';
            code += '#ifndef VIEWMATRIX\n';
            code += '#define VIEWMATRIX\n';
            code += 'uniform mat4 matrix_view;\n';
            code += '#endif\n';
            code += '#ifndef CAMERAPLANES\n';
            code += '#define CAMERAPLANES\n';
            code += 'uniform vec4 camera_params;\n\n';
            code += '#endif\n';
        }*/

        for (var n=0;n<options.shaderGraphNode.params.length;n++)
        {
            code += 'uniform '+options.shaderGraphNode.params[n].type+' '+options.shaderGraphNode.params[n].name+'_'+options.shaderGraphNode.key+';\n';
        }

        code +='vec3 getWorldPositionNM(){return (getModelMatrix()*vec4(vertex_position, 1.0)).xyz;}\n';
        code +='vec3 getWorldNormalNM(){return (getModelMatrix()*vec4(vertex_normal, 0.0)).xyz;}\n';

        if (options.shaderGraphNode.vertexPositionOffset) 
        {
            code += options.shaderGraphNode.vertexPositionOffset;
        }

        // VERTEX SHADER BODY
        code += pc.programlib.begin();

        if (options.shaderGraphNode.vertexPositionOffset) {
            code += "   vPosition = getWorldPositionNM()+getVertexPositionOffset();\n";
            code += "   gl_Position = matrix_viewProjection*vec4(vPosition,1);\n";
        }
        else {
            code += "   vPosition = getWorldPositionNM();\n";
            code += "   gl_Position = matrix_viewProjection*vec4(vPosition,1);\n";
        }

 /*       if (options.pass === pc.SHADER_DEPTH) {
            code += "    vDepth = -(matrix_view * vec4(getWorldPosition(),1.0)).z * camera_params.x;\n";
        }*/

        if (1) 
        {
//            code += '    vNormal = getNormal(vertex_normal);\n';
            code += '    vNormal = getWorldNormalNM();\n';            
            code += '    vColor = vertex_color;\n';
            code += '    vUv0 = vertex_texCoord0;\n';
        }

        code += pc.programlib.end();

        var vshader = code;

        // GENERATE FRAGMENT SHADER
        code = pc.programlib.precisionCode(device);

        // FRAGMENT SHADER DECLARATIONS
        if (1)
        {
            code += 'varying vec3 vNormal;\n';
            code += 'varying vec4 vColor;\n';
            code += 'varying vec2 vUv0;\n';
        }
        if (options.fog) {
            code += pc.programlib.fogCode(options.fog);
        }
        if (options.alphatest) {
            code += chunks.alphaTestPS;
        }

        /*if (options.pass === pc.SHADER_DEPTH) {
            // ##### SCREEN DEPTH PASS #####
            code += 'varying float vDepth;\n';
            code += chunks.packDepthPS;
        }*/

        for (var n=0;n<options.shaderGraphNode.params.length;n++)
        {
            code += 'uniform '+options.shaderGraphNode.params[n].type+' '+options.shaderGraphNode.params[n].name+';\n';
        }
  
        if (options.shaderGraphNode) code += options.shaderGraphNode.shaderGraphFuncString;

//        if (options.nodeInputs.emissiveColor) code += options.nodeInputs.emissiveColor;
//        if (options.nodeInputs.baseColor) code += options.nodeInputs.baseColor;
//        if (options.nodeInputs.opacity) code += options.nodeInputs.opacity;
//        if (options.nodeInputs.normal) code += options.nodeInputs.normal;
//        if (options.nodeInputs.metallic) code += options.nodeInputs.metallic;
//        if (options.nodeInputs.roughness) code += options.nodeInputs.roughness;    

        // FRAGMENT SHADER BODY
        code += pc.programlib.begin();            

        if (options.shaderGraphNode) code += options.shaderGraphNode.shaderGraphNodeString;

        //code += pc.NodeMaterial.generateLightingCode(options);

        //code += '    gl_FragColor = getEmissiveColor()+lightGGX(getBaseColor(), getOpacity(), getNormal(), getMetallic(), getRoughness());\n';
//        code += '    gl_FragColor = vec4(getEmissiveColor(),1);\n';
        //code += '    gl_FragColor = '+options.shaderGraphNode.funcName+ root(getEmissiveColor(),1);\n';

        if (options.alphatest) {
            code += "   alphaTest(gl_FragColor.a);\n";
        }

        /*if (options.pass === pc.SHADER_PICK) {
            // ##### PICK PASS #####
        } else if (options.pass === pc.SHADER_DEPTH) {
            // ##### SCREEN DEPTH PASS #####
            code += "    gl_FragColor = packFloat(vDepth);\n";
        } else */{
            // ##### FORWARD PASS #####
            if (options.fog) {
                code += "   glFragColor.rgb = addFog(gl_FragColor.rgb);\n";
            }
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
