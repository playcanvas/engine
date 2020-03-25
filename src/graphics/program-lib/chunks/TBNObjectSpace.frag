void getTBN() {
    vec3 B = cross(dVertexNormalW, vObjectSpaceUpW);
    vec3 T = cross(dVertexNormalW, B);

    dTBN = mat3(normalize(T), normalize(B), normalize(dVertexNormalW));
}

