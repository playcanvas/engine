#ifdef MAPFLOAT
uniform float material_shininess;
#endif

#ifdef MAPTEXTURE
uniform sampler2D texture_glossMap;
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
}

