export default /* wgsl */`
#ifdef STD_GLOSS_CONSTANT
    uniform material_gloss: f32;
#endif

fn getGlossiness() {
    dGlossiness = 1.0;

    #ifdef STD_GLOSS_CONSTANT
    dGlossiness = dGlossiness * uniform.material_gloss;
    #endif

    #ifdef STD_GLOSS_TEXTURE
    dGlossiness = dGlossiness * textureSampleBias({STD_GLOSS_TEXTURE_NAME}, {STD_GLOSS_TEXTURE_NAME}Sampler, {STD_GLOSS_TEXTURE_UV}, uniform.textureBias).{STD_GLOSS_TEXTURE_CHANNEL};
    #endif

    #ifdef STD_GLOSS_VERTEX
    dGlossiness = dGlossiness * saturate(vVertexColor.{STD_GLOSS_VERTEX_CHANNEL});
    #endif

    #ifdef STD_GLOSS_INVERT
    dGlossiness = 1.0 - dGlossiness;
    #endif

    dGlossiness = dGlossiness + 0.0000001;
}
`;
