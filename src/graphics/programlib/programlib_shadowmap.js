pc.gfx.programlib.shadowmap = {
    generateKey: function (options) {
        var key = "shadowmap";
        if (options.skin) key += "_skin";
        return key;
    },

    generateVertexShader: function (options) {
        var code = "";

        // VERTEX SHADER INPUTS: ATTRIBUTES
        code += "attribute vec3 vertex_position;\n";
        if (options.skin) {
            code += "attribute vec4 vertex_boneWeights;\n";
            code += "attribute vec4 vertex_boneIndices;\n";
        }
        code += "\n";

        // VERTEX SHADER INPUTS: UNIFORMS
        if (options.skin) {
            var numBones = pc.gfx.Device.getCurrent().getBoneLimit();
            code += "uniform mat4 matrix_pose[" + numBones + "];\n";
        } else {
            code += "uniform mat4 matrix_model;\n";
        }
        code += "uniform mat4 matrix_viewProjection;\n";
        code += "\n";

        // VERTEX SHADER BODY
        code += "void main(void)\n";
        code += "{\n";
        // Prepare attribute values into the right formats for the vertex shader
        code += "    vec4 position = vec4(vertex_position, 1.0);\n\n";

        // Skinning is performed in world space
        if (options.skin) {
            // Skin the necessary vertex attributes
            code += "    vec4 positionW;\n";
            code += "    positionW  = vertex_boneWeights[0] * matrix_pose[int(vertex_boneIndices[0])] * position;\n";
            code += "    positionW += vertex_boneWeights[1] * matrix_pose[int(vertex_boneIndices[1])] * position;\n";
            code += "    positionW += vertex_boneWeights[2] * matrix_pose[int(vertex_boneIndices[2])] * position;\n";
            code += "    positionW += vertex_boneWeights[3] * matrix_pose[int(vertex_boneIndices[3])] * position;\n\n";
        } else {
            code += "    vec4 positionW = matrix_model * position;\n\n";
        }

        // Transform to vertex position to screen
        code += "    gl_Position = matrix_viewProjection * positionW;\n\n";
        code += "}";
        
        return code;
    },

    generateFragmentShader: function (options) {
        var code = "";

        code += "precision mediump float;\n\n";

        if (pc.gfx.Device.getCurrent().extDepthTexture) {
            code += "void main(void)\n";
            code += "{\n";
            code += "    gl_FragData[0] = vec4(1.0);\n";
            code += "}";
        } else {
            code += "vec4 pack_depth(const in float depth)\n";
            code += "{\n";
            code += "    const vec4 bit_shift = vec4(256.0*256.0*256.0, 256.0*256.0, 256.0, 1.0);\n";
            code += "    const vec4 bit_mask  = vec4(0.0, 1.0/256.0, 1.0/256.0, 1.0/256.0);\n";
            code += "    vec4 res = fract(depth * bit_shift);\n";
            code += "    res -= res.xxyz * bit_mask;\n";
            code += "    return res;\n";
            code += "}\n\n";
            
            code += "void main(void)\n";
            code += "{\n";
            code += "    gl_FragData[0] = pack_depth(gl_FragCoord.z);\n";
            code += "}";
        }

        return code;
    }
};