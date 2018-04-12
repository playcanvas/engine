#ifdef MAPTEXTURE
uniform sampler2D texture_lightMap;
#endif

void addLightMap() {
    vec3 lm = vec3(1.0);

    #ifdef MAPTEXTURE
        lm *= $texture2DSAMPLE(texture_lightMap, $UV).$CH;
    #endif

    #ifdef MAPVERTEX
        lm *= saturate(vVertexColor.$VC);
    #endif
    
    dDiffuseLight += lm;
}

