vec4 getPosition(inout vsInternalData data) {
    data.modelMatrix = getModelMatrix(data);
    vec4 posW = data.modelMatrix * vec4(vertex_position, 1.0);
    data.positionW = posW.xyz / posW.w;
    return matrix_viewProjection * vec4(data.positionW.xyz, 1.0);
}

vec3 getWorldPosition(inout vsInternalData data) {
    return data.positionW;
}

