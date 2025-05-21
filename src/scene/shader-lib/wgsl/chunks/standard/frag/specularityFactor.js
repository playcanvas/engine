export default /* wgsl */`

#ifdef STD_SPECULARITYFACTOR_CONSTANT
    uniform material_specularityFactor: f32;
#endif

fn getSpecularityFactor() {
    var specularityFactor = 1.0;

    #ifdef STD_SPECULARITYFACTOR_CONSTANT
    specularityFactor = specularityFactor * uniform.material_specularityFactor;
    #endif

    #ifdef STD_SPECULARITYFACTOR_TEXTURE
    specularityFactor = specularityFactor * textureSampleBias({STD_SPECULARITYFACTOR_TEXTURE_NAME}, {STD_SPECULARITYFACTOR_TEXTURE_NAME}Sampler, {STD_SPECULARITYFACTOR_TEXTURE_UV}, uniform.textureBias).{STD_SPECULARITYFACTOR_TEXTURE_CHANNEL};
    #endif

    #ifdef STD_SPECULARITYFACTOR_VERTEX
    specularityFactor = specularityFactor * saturate(vVertexColor.{STD_SPECULARITYFACTOR_VERTEX_CHANNEL});
    #endif

    dSpecularityFactor = specularityFactor;
}
`;
