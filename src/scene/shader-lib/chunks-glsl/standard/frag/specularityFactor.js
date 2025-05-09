export default /* glsl */`

#ifdef STD_SPECULARITYFACTOR_CONSTANT
uniform float material_specularityFactor;
#endif

void getSpecularityFactor() {
    float specularityFactor = 1.0;

    #ifdef STD_SPECULARITYFACTOR_CONSTANT
    specularityFactor *= material_specularityFactor;
    #endif

    #ifdef STD_SPECULARITYFACTOR_TEXTURE
    specularityFactor *= texture2DBias({STD_SPECULARITYFACTOR_TEXTURE_NAME}, {STD_SPECULARITYFACTOR_TEXTURE_UV}, textureBias).{STD_SPECULARITYFACTOR_TEXTURE_CHANNEL};
    #endif

    #ifdef STD_SPECULARITYFACTOR_VERTEX
    specularityFactor *= saturate(vVertexColor.{STD_SPECULARITYFACTOR_VERTEX_CHANNEL});
    #endif

    dSpecularityFactor = specularityFactor;
}
`;
