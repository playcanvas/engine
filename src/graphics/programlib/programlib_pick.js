pc.gfx.programlib.pick = {
    generateKey: function (options) {
        var key = "pick";
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
        code += "uniform mat4 matrix_projection;\n";
        code += "uniform mat4 matrix_view;\n";
        code += "uniform mat4 matrix_model;\n";
        if (options.skin) {
            var numBones = pc.gfx.Device.getCurrent().getBoneLimit();
            code += "uniform mat4 matrix_pose[" + numBones + "];\n";
        }
        code += "\n";

        // VERTEX SHADER BODY
        code += "void main(void)\n";
        code += "{\n";
        // Prepare attribute values into the right formats for the vertex shader
        // and transform into world space
        code += "    vec4 positionW = matrix_model * vec4(vertex_position, 1.0);\n";
        code += "\n";

        // Skinning is performed in world space
        if (options.skin) {
            // Skin the necessary vertex attributes
            code += "    vec4 skinned_position;\n";
            code += "    skinned_position  = vertex_boneWeights[0] * matrix_pose[int(vertex_boneIndices[0])] * positionW;\n";
            code += "    skinned_position += vertex_boneWeights[1] * matrix_pose[int(vertex_boneIndices[1])] * positionW;\n";
            code += "    skinned_position += vertex_boneWeights[2] * matrix_pose[int(vertex_boneIndices[2])] * positionW;\n";
            code += "    skinned_position += vertex_boneWeights[3] * matrix_pose[int(vertex_boneIndices[3])] * positionW;\n";
            code += "    positionW = skinned_position;\n\n";
        }

        // Transform to vertex position to screen
        code += "    gl_Position = matrix_viewProjection * positionW;\n";
        code += "}";

        return code;
    },

    generateFragmentShader: function (options) {
        var code = "";

        code += "#ifdef GL_ES\n";
        code += "precision highp float;\n";
        code += "#endif\n\n";

        // FRAGMENT SHADER INPUTS: UNIFORMS
        code += "uniform vec4 pick_color;\n";

        code += "void main(void)\n";
        code += "{\n";
        code += "    gl_FragColor = pick_color;\n";
        code += "}";

        return code;
    }
};