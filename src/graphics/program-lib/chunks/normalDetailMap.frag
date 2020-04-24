#ifdef MAPTEXTURE
uniform sampler2D texture_normalDetailMap;
uniform float material_normalDetailMapBumpiness;

vec3 blendNormals(vec3 n1, vec3 n2) {
    // https://blog.selfshadow.com/publications/blending-in-detail/#detail-oriented
    n1 += vec3(0, 0, 1);
    n2 *= vec3(-1, -1, 1);
    return normalize(n1*dot(n1, n2)/n1.z - n2);
}
#endif

vec3 addNormalDetail(vec3 normalMap) {
    #ifdef MAPTEXTURE
        vec3 normalDetailMap = unpackNormal(texture2D(texture_normalDetailMap, $UV));
        normalDetailMap = normalize(mix(vec3(0.0, 0.0, 1.0), normalDetailMap, material_normalDetailMapBumpiness));
        return blendNormals(normalMap, normalDetailMap);
    #else
        return normalMap;
    #endif
}

