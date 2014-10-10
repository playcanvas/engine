
vec4 getPosition(inout vsInternalData data) {
    data.modelMatrix = getModelMatrix(data);
    data.positionW = (data.modelMatrix * vec4(vertex_position, 1.0)).xyz;
    return matrix_viewProjection * vec4(data.positionW, 1.0);
}

vec3 getWorldPosition(inout vsInternalData data) {
    return data.positionW;
}
