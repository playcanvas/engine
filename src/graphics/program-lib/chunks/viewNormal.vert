
uniform mat4 matrix_view;
vec3 getViewNormal() {
    return mat3(matrix_view) * vNormalW;
}
