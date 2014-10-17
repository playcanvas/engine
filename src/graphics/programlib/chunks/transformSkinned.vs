mat4 getModelMatrix(inout vsInternalData data) {
    return             vertex_boneWeights.x * getBoneMatrix(vertex_boneIndices.x) +
                       vertex_boneWeights.y * getBoneMatrix(vertex_boneIndices.y) +
                       vertex_boneWeights.z * getBoneMatrix(vertex_boneIndices.z) +
                       vertex_boneWeights.w * getBoneMatrix(vertex_boneIndices.w);
}

vec3 getNormal(inout vsInternalData data) {
    data.normalMatrix = mat3(data.modelMatrix[0].xyz, data.modelMatrix[1].xyz, data.modelMatrix[2].xyz);
    return normalize(data.normalMatrix * vertex_normal);
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

