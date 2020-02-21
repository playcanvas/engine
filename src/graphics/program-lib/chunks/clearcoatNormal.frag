#ifdef MAPTEXTURE
uniform sampler2D texture_clearcoatNormalMap;
#endif

vec3 getClearcoatNormal() {
#ifdef MAPTEXTURE
    vec3 normalMap = unpackNormal(texture2D(texture_clearcoatNormalMap, $UV));
    return normalize(dTBN * normalMap);
#else
    return dVertexNormalW;
#endif
}

