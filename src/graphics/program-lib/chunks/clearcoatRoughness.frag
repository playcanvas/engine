#ifdef MAPFLOAT
uniform float material_clearcoatRoughness;
#endif

#ifdef MAPTEXTURE
uniform sampler2D texture_clearcoatRoughnessMap;
#endif

float getClearcoatRoughness() {
    float clearcoatRoughness = 1.0;

    #ifdef MAPFLOAT
        clearcoatRoughness *= material_clearcoatRoughness;
    #endif

    #ifdef MAPTEXTURE
        clearcoatRoughness *= texture2D(texture_clearcoatRoughnessMap, $UV).$CH;
    #endif

    return clearcoatRoughness;
}

