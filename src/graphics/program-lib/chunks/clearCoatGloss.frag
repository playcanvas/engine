#ifdef MAPFLOAT
uniform MMEDP float material_clearCoatGlossiness;
#endif

#ifdef MAPTEXTURE
uniform sampler2D texture_clearCoatGlossMap;
#endif

void getClearCoatGlossiness() {
    ccGlossiness = 1.0;

    #ifdef MAPFLOAT
    ccGlossiness *= material_clearCoatGlossiness;
    #endif

    #ifdef MAPTEXTURE
    ccGlossiness *= texture2D(texture_clearCoatGlossMap, $UV).$CH;
    #endif

    #ifdef MAPVERTEX
    ccGlossiness *= saturate(vVertexColor.$VC);
    #endif

    ccGlossiness += 0.0000001;
}
