
mat4 getModelMatrix(inout vsInternalData data) {
    return matrix_model;
}

vec3 getNormal(inout vsInternalData data) {
    data.normalMatrix = matrix_normal;
    return normalize(data.normalMatrix * vertex_normal);
}

