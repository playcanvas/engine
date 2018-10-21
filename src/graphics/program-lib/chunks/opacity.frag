#ifdef MAPFLOAT
uniform float material_opacity;
#endif

#ifdef MAPTEXTURE
uniform sampler2D texture_opacityMap;
#endif

void getOpacity() {
    dAlpha = 1.0;

    #ifdef MAPFLOAT
        dAlpha *= material_opacity;
    #endif

    #ifdef MAPTEXTURE
        dAlpha *= texture2D(texture_opacityMap, $UV).$CH;
    #endif

    #ifdef MAPVERTEX
        dAlpha *= saturate(vVertexColor.$VC);
    #endif
}

