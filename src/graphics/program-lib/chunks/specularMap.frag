#ifdef MAPCOLOR
uniform vec3 material_specular;
#endif

#ifdef MAPTEXTURE
uniform sampler2D texture_specularMap;
#endif

void getSpecularity() {
    dSpecularity = vec3(1.0);

    #ifdef MAPCOLOR
        dSpecularity *= material_specular;
    #endif

    #ifdef MAPTEXTURE
        dSpecularity *= texture2D(texture_specularMap, $UV).$CH;
    #endif

    #ifdef MAPVERTEX
        dSpecularity *= saturate(vVertexColor.$VC);
    #endif
}

