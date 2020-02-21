#ifdef MAPFLOAT
uniform float material_clearcoatRoughness;
#endif

#ifdef MAPTEXTURE
uniform sampler2D texture_clearcoatRoughnessMap;
#endif

void getClearcoatRoughness() {
    dClearcoatRoughness = 1.0;

    #ifdef MAPFLOAT
        dClearcoatRoughness *= material_clearcoatRoughness;
    #endif

    #ifdef MAPTEXTURE
        dClearcoatRoughness *= texture2D(texture_clearcoatRoughnessMap, $UV).$CH;
    #endif
}

