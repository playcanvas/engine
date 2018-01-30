#ifdef MAPFLOAT
uniform float material_metalness;
#endif

#ifdef MAPTEXTURE
uniform sampler2D texture_metalnessMap;
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
}

