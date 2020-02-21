#ifdef MAPTEXTURE
uniform sampler2D texture_clearcoatNormalMap;
#endif

void getClearcoatNormal() {

    #ifdef MAPTEXTURE
        vec3 normalMap = unpackNormal(texture2D(texture_clearcoatNormalMap, $UV));
        dClearcoatNormalW = normalize(dTBN * normalMap);
    #else
        dClearcoatNormalW = dVertexNormalW;
    #endif
}

