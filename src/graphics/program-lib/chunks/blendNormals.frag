vec3 blendNormals_rnm(vec3 n1, vec3 n2) {
    n1 += vec3(0, 0, 1);
    n2 *= vec3(-1, -1, 1);
    return n1*dot(n1, n2)/n1.z - n2;
}

vec3 blendNormals_pd(vec3 n1, vec3 n2) {
    return normalize(vec3(n1.xy*n2.z + n2.xy*n1.z, n1.z*n2.z));
}

vec3 blendNormals_whiteout(vec3 n1, vec3 n2) {
    return normalize(vec3(n1.xy + n2.xy, n1.z*n2.z));
}

vec3 blendNormals_udn(vec3 n1, vec3 n2) {
    return normalize(vec3(n1.xy + n2.xy, n1.z));
}

