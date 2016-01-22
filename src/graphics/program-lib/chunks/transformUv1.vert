mat4 getModelMatrix(inout vsInternalData data) {
    return matrix_model;
}
vec4 getPosition(inout vsInternalData data) {
    data.modelMatrix = getModelMatrix(data);
    vec4 posW = data.modelMatrix * vec4(vertex_position, 1.0);
    data.positionW = posW.xyz;
    return vec4(vertex_texCoord1.xy * 2.0 - 1.0, 0.5, 1);
}
vec3 getWorldPosition(inout vsInternalData data) {
    return data.positionW;
}

