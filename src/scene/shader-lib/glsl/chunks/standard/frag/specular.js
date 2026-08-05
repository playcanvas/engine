export default /* glsl */`

#ifdef STD_SPECULAR_CONSTANT
uniform vec3 material_specular;
#endif

void getSpecularity() {
    vec3 specularColor = vec3(1,1,1);

    #ifdef STD_SPECULAR_CONSTANT
    specularColor *= material_specular;
    #endif

    #ifdef STD_SPECULAR_TEXTURE
    specularColor *= {STD_SPECULAR_TEXTURE_DECODE}(texture2DBias({STD_SPECULAR_TEXTURE_NAME}, {STD_SPECULAR_TEXTURE_UV}, textureBias)).{STD_SPECULAR_TEXTURE_CHANNEL};
    #endif

    #ifdef STD_SPECULAR_VERTEX
    specularColor *= saturate(vVertexColor.{STD_SPECULAR_VERTEX_CHANNEL});
    #endif

    dSpecularity = specularColor;
}
`;
