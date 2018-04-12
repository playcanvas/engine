#ifdef MAPCOLOR
uniform vec3 material_diffuse;
#endif

#ifdef MAPTEXTURE
uniform sampler2D texture_diffuseMap;
#endif

void getAlbedo() {
    dAlbedo = vec3(1.0);

    #ifdef MAPCOLOR
        dAlbedo *= material_diffuse.rgb;
    #endif

    #ifdef MAPTEXTURE
        dAlbedo *= texture2DSRGB(texture_diffuseMap, $UV).$CH;
    #endif

    #ifdef MAPVERTEX
        dAlbedo *= gammaCorrectInput(saturate(vVertexColor.$VC));
    #endif
}

