mat4 getModelMatrix() {
    return matrix_model;
}

vec4 getPosition() {
    dModelMatrix = getModelMatrix();
    vec4 pos = vec4(vertex_position, 1.0);
    if (vertex_texCoord1.x > 0.0) {
        pos.x = (pos.x + nineSliceCoords.z) * nineSliceCoords.x * vertex_texCoord1.x;
    }
    if (vertex_texCoord1.y > 0.0) {
        pos.y = (pos.y + nineSliceCoords.w) * nineSliceCoords.y * vertex_texCoord1.y;
    }
    vec4 posW = dModelMatrix * pos;
    dPositionW = posW.xyz;
    return matrix_viewProjection * posW;
}

vec3 getWorldPosition() {
    return dPositionW;
}

