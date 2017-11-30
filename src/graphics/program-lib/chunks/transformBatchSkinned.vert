mat4 getModelMatrix() {
    return getBoneMatrix(vertex_boneIndices);
}

vec4 getPosition() {
    dModelMatrix = getModelMatrix();
    vec4 posW = dModelMatrix * vec4(vertex_position, 1.0);
    dPositionW = posW.xyz;
    return matrix_viewProjection * posW;
}

vec3 getWorldPosition() {
    return dPositionW;
}

