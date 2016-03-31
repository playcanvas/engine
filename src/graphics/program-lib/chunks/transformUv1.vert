mat4 getModelMatrix() {
    return matrix_model;
}
vec4 getPosition() {
    dModelMatrix = getModelMatrix();
    vec4 posW = dModelMatrix * vec4(vertex_position, 1.0);
    dPositionW = posW.xyz;
    return vec4(vertex_texCoord1.xy * 2.0 - 1.0, 0.5, 1);
}
vec3 getWorldPosition() {
    return dPositionW;
}

