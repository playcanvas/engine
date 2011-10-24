pc.gfx.programlib.shadowmap = {};

pc.gfx.programlib.shadowmap.generateKey = function (options) {
    var key = "shadowmap";
    if (options.skinning) key += "_skin";
    return key;
}

pc.gfx.programlib.shadowmap.generateVertexShader = function (options) {
    var code = "";

    // VERTEX SHADER INPUTS: ATTRIBUTES
    code += "attribute vec3 vertex_position;\n";
    if (options.skinning) {
        code += "attribute vec4 vertex_boneWeights;\n";
        code += "attribute vec4 vertex_boneIndices;\n";
    }
    code += "\n";

    // VERTEX SHADER INPUTS: UNIFORMS
    code += "uniform mat4 matrix_viewProjection;\n";
    code += "uniform mat4 matrix_model;\n";
    if (options.skinning) {
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
    if (options.skinning) {
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
}

pc.gfx.programlib.shadowmap.generateFragmentShader = function (options) {
    var code = "";

    code += "#ifdef GL_ES\n";
    code += "precision highp float;\n";
    code += "#endif\n\n";

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

    return code;
}