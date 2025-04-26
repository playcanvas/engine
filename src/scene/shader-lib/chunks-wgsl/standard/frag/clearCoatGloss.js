export default /* wgsl */`
#ifdef STD_CLEARCOATGLOSS_CONSTANT
    uniform material_clearCoatGloss: f32;
#endif

fn getClearCoatGlossiness() {
    ccGlossiness = 1.0;

    #ifdef STD_CLEARCOATGLOSS_CONSTANT
    ccGlossiness = ccGlossiness * uniform.material_clearCoatGloss;
    #endif

    #ifdef STD_CLEARCOATGLOSS_TEXTURE
    ccGlossiness = ccGlossiness * textureSampleBias({STD_CLEARCOATGLOSS_TEXTURE_NAME}, {STD_CLEARCOATGLOSS_TEXTURE_NAME}Sampler, {STD_CLEARCOATGLOSS_TEXTURE_UV}, uniform.textureBias).{STD_CLEARCOATGLOSS_TEXTURE_CHANNEL};
    #endif

    #ifdef STD_CLEARCOATGLOSS_VERTEX
    ccGlossiness = ccGlossiness * saturate(vVertexColor.{STD_CLEARCOATGLOSS_VERTEX_CHANNEL});
    #endif

    #ifdef STD_CLEARCOATGLOSS_INVERT
    ccGlossiness = 1.0 - ccGlossiness;
    #endif

    ccGlossiness += 0.0000001;
}
`;
