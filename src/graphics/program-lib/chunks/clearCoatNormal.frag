#ifdef MAPTEXTURE
uniform sampler2D texture_clearCoatNormalMap;
uniform MMEDP float material_clearCoatBumpiness;
#endif

void getClearCoatNormal() {
    #ifdef MAPTEXTURE
    MMEDP vec3 normalMap = unpackNormal(texture2D(texture_clearCoatNormalMap, $UV));
    normalMap = normalize(mix(vec3(0.0, 0.0, 1.0), normalMap, material_clearCoatBumpiness));
    ccNormalW = dTBN * normalMap;
    #else
    ccNormalW = normalize(dVertexNormalW);
    #endif

    ccReflDirW = normalize(-reflect(dViewDirW, ccNormalW));
}
