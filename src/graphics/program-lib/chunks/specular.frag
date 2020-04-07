#ifdef MAPCOLOR
uniform vec3 material_specular;
#endif

#ifdef MAPTEXTURE
uniform sampler2D texture_specularMap;
#endif

#ifdef CLEARCOAT
uniform float material_clear_coat_specularity;
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

    #ifdef CLEARCOAT
        cSpecularity = vec3(1.0);
        ccSpecularity *= material_clear_coat_specularity;
    #endif
}

