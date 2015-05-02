
uniform mat4 matrix_view;
vec3 getViewNormal(inout vsInternalData data) {
    return mat3(matrix_view) * vNormalW;
}
