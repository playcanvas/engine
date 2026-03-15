export default /* wgsl */`

#ifdef STD_REFRACTION_CONSTANT
    uniform material_refraction: f32;
#endif

fn getRefraction() {
    var refraction: f32 = 1.0;

    #ifdef STD_REFRACTION_CONSTANT
    refraction = uniform.material_refraction;
    #endif

    #ifdef STD_REFRACTION_TEXTURE
    refraction = refraction * textureSampleBias({STD_REFRACTION_TEXTURE_NAME}, {STD_REFRACTION_TEXTURE_NAME}Sampler, {STD_REFRACTION_TEXTURE_UV}, uniform.textureBias).{STD_REFRACTION_TEXTURE_CHANNEL};
    #endif

    #ifdef STD_REFRACTION_VERTEX
    refraction = refraction * saturate(vVertexColor.{STD_REFRACTION_VERTEX_CHANNEL});
    #endif

    dTransmission = refraction;
}
`;
