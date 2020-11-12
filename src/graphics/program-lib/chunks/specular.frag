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
        #if GLTF_MAT_GENERATED
        vec3 srgb = texture2D(texture_specularMap, $UV).$CH;
        dSpecularity *= vec3(pow(srgb.r, 2.2), pow(srgb.g, 2.2), pow(srgb.b, 2.2));
        #else
        dSpecularity *= texture2D(texture_specularMap, $UV).$CH;
        #endif
    #endif

    #ifdef MAPVERTEX
    dSpecularity *= saturate(vVertexColor.$VC);
    #endif
}
