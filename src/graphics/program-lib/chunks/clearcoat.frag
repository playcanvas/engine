#ifdef MAPFLOAT
uniform float material_clearcoat;
#endif

#ifdef MAPTEXTURE
uniform sampler2D texture_clearcoatMap;
#endif

float getClearcoat() {
    float clearcoat = 1.0;

    #ifdef MAPFLOAT
        clearcoat *= material_clearcoat;
    #endif

    #ifdef MAPTEXTURE
        clearcoat *= texture2D(texture_clearcoatMap, $UV).$CH;
    #endif

    return clearcoat;
}

