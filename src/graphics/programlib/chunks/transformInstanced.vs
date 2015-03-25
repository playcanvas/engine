mat4 getModelMatrix(inout vsInternalData data) {
    return mat4(instance_line1, instance_line2, instance_line3, instance_line4);
}

vec4 getPosition(inout vsInternalData data) {
    data.modelMatrix = getModelMatrix(data);
    vec4 posW = data.modelMatrix * vec4(vertex_position, 1.0);
    data.positionW = posW.xyz;
    return matrix_viewProjection * posW;
}

vec3 getWorldPosition(inout vsInternalData data) {
    return data.positionW;
}

