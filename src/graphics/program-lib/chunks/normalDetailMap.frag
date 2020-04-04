#ifdef MAPTEXTURE
uniform sampler2D texture_normalDetailMap;
uniform float material_normalDetailMapBumpiness;
#endif

vec3 addNormalDetail(vec3 normalMap) {
    #ifdef MAPTEXTURE
        vec3 normalDetailMap = unpackNormal(texture2D(texture_normalDetailMap, $UV));
        normalDetailMap = normalize(mix(vec3(0.0, 0.0, 1.0), normalDetailMap, material_normalDetailMapBumpiness));
        return blendNormals_$DETAILBLEND(normalMap, normalDetailMap);
    #else
        return normalMap;
    #endif
}

