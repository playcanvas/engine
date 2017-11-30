mat4 getModelMatrix() {
    return getBoneMatrix(vertex_boneIndices);
}

vec4 getPosition() {
    vec4 posW = vec4((getModelMatrix() * vec4(vertex_position, 1.0)).xy, 0.0, 1.0);
    dPositionW = posW.xyz;
    return posW;
}

vec3 getWorldPosition() {
    return dPositionW;
}
