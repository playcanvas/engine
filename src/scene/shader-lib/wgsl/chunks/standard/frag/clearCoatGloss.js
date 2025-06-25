export default /* wgsl */`
    uniform material_clearCoatGloss: f32;

fn getClearCoatGlossiness() {
    ccGlossiness = uniform.material_clearCoatGloss;

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
