export default /* glsl */`

#ifdef STD_REFRACTION_CONSTANT
uniform float material_refraction;
#endif

void getRefraction() {
    float refraction = 1.0;

    #ifdef STD_REFRACTION_CONSTANT
    refraction = material_refraction;
    #endif

    #ifdef STD_REFRACTION_TEXTURE
    refraction *= texture2DBias({STD_REFRACTION_TEXTURE_NAME}, {STD_REFRACTION_TEXTURE_UV}, textureBias).{STD_REFRACTION_TEXTURE_CHANNEL};
    #endif

    #ifdef STD_REFRACTION_VERTEX
    refraction *= saturate(vVertexColor.{STD_REFRACTION_VERTEX_CHANNEL});
    #endif

    dTransmission = refraction;
}
`;
