export default /* glsl */`

#ifdef STD_SPECULAR_MATERIAL_ENABLED
uniform vec3 material_specular;
#endif

void getSpecularity() {
    vec3 specularColor = vec3(1,1,1);

    #ifdef STD_SPECULAR_MATERIAL_ENABLED
    specularColor *= material_specular;
    #endif

    #ifdef STD_SPECULAR_TEXTURE_ENABLED
    specularColor *= {STD_SPECULAR_TEXTURE_DECODE}(texture2DBias({STD_SPECULAR_TEXTURE}, {STD_SPECULAR_TEXTURE_UV}, textureBias)).{STD_SPECULAR_TEXTURE_CHANNEL};
    #endif

    #ifdef STD_SPECULAR_VERTEX_ENABLED
    specularColor *= saturate(vVertexColor.{STD_SPECULAR_VERTEX_CHANNEL});
    #endif

    dSpecularity = specularColor;
}
`;
