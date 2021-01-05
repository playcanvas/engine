#ifdef MAPFLOAT
uniform float material_clearCoat;
#endif

#ifdef MAPTEXTURE
uniform sampler2D texture_clearCoatMap;
#endif

void getClearCoat() {
    ccSpecularity = 1.0;

    #ifdef MAPFLOAT
    ccSpecularity *= material_clearCoat;
    #endif

    #ifdef MAPTEXTURE
    ccSpecularity *= texture2D(texture_clearCoatMap, $UV).$CH;
    #endif

    #ifdef MAPVERTEX
    ccSpecularity *= saturate(vVertexColor.$VC);
    #endif
}
