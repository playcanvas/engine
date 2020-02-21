#ifdef MAPFLOAT
uniform float material_clearcoat;
#endif

#ifdef MAPTEXTURE
uniform sampler2D texture_clearcoatMap;
#endif

void getClearcoat() {
    dClearcoat = 1.0;

    #ifdef MAPFLOAT
        dClearcoat *= material_clearcoat;
    #endif

    #ifdef MAPTEXTURE
        dClearcoat *= texture2D(texture_clearcoatMap, $UV).$CH;
    #endif
}

