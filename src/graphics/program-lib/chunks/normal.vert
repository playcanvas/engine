vec3 getNormal() {
    dNormalMatrix = matrix_normal;
    return normalize(dNormalMatrix * vertex_normal);
}

