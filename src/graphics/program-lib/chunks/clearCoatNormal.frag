#ifdef MAPTEXTURE
uniform sampler2D texture_clearCoatNormalMap;
#endif

void getClearCoatNormal() {
    #ifdef MAPTEXTURE
    vec3 normalMap = unpackNormal(texture2D(texture_clearCoatNormalMap, $UV));
    ccNormalW = dTBN * normalMap;
    #else
    ccNormalW = normalize(dVertexNormalW);
    #endif

    ccReflDirW = normalize(-reflect(dViewDirW, ccNormalW));
}
