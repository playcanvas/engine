#ifdef MAPFLOAT
uniform float material_shininess;
#endif

#ifdef MAPTEXTURE
uniform sampler2D texture_glossMap;
#endif

#ifdef CLEARCOAT
uniform float material_clear_coat_glossiness;
#endif

void getGlossiness() {
    dGlossiness = 1.0;

    #ifdef MAPFLOAT
        dGlossiness *= material_shininess;
    #endif

    #ifdef MAPTEXTURE
        dGlossiness *= texture2D(texture_glossMap, $UV).$CH;
    #endif

    #ifdef MAPVERTEX
        dGlossiness *= saturate(vVertexColor.$VC);
    #endif

    dGlossiness += 0.0000001;

    #ifdef CLEARCOAT
        ccGlossiness = 1.0;
        ccGlossiness *= material_clear_coat_glossiness*0.01;
        ccGlossiness += 0.0000001;
    #endif
}

