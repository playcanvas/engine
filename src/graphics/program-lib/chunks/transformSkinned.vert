mat4 getModelMatrix(inout vsInternalData data) {
    return getBoneMatrix(vertex_boneIndices.x) * vertex_boneWeights.x +
           getBoneMatrix(vertex_boneIndices.y) * vertex_boneWeights.y +
           getBoneMatrix(vertex_boneIndices.z) * vertex_boneWeights.z +
           getBoneMatrix(vertex_boneIndices.w) * vertex_boneWeights.w;
}

vec4 getPosition(inout vsInternalData data) {
    data.modelMatrix = getModelMatrix(data);
    vec4 posW = data.modelMatrix * vec4(vertex_position, 1.0);
    data.positionW = posW.xyz / posW.w;
    return matrix_viewProjection * posW;
}

vec3 getWorldPosition(inout vsInternalData data) {
    return data.positionW;
}

