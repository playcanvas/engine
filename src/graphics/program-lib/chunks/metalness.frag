void processMetalness(float metalness) {
    const float dielectricF0 = 0.04;
    dSpecularity = mix(vec3(dielectricF0), dAlbedo, metalness);
    dAlbedo *= 1.0 - metalness;
}

#ifdef MAPFLOAT
uniform float material_metalness;
#endif

#ifdef MAPTEXTURE
uniform sampler2D texture_metalnessMap;
#endif

#ifdef CLEARCOAT
uniform float material_clear_coat_specularity;
#endif

void getSpecularity() {
    float metalness = 1.0;

    #ifdef MAPFLOAT
        metalness *= material_metalness;
    #endif

    #ifdef MAPTEXTURE
        metalness *= texture2D(texture_metalnessMap, $UV).$CH;
    #endif

    #ifdef MAPVERTEX
        metalness *= saturate(vVertexColor.$VC);
    #endif

    processMetalness(metalness);

    #ifdef CLEARCOAT
        cSpecularity = vec3(1.0);
        ccSpecularity *= material_clear_coat_specularity;
    #endif
}

