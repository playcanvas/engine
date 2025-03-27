export default /* glsl */`
#ifdef STD_CLEARCOATGLOSS_MATERIAL_ENABLED
uniform float material_clearCoatGloss;
#endif

void getClearCoatGlossiness() {
    ccGlossiness = 1.0;

    #ifdef STD_CLEARCOATGLOSS_MATERIAL_ENABLED
    ccGlossiness *= material_clearCoatGloss;
    #endif

    #ifdef STD_CLEARCOATGLOSS_TEXTURE_ENABLED
    ccGlossiness *= texture2DBias({STD_CLEARCOATGLOSS_TEXTURE}, {STD_CLEARCOATGLOSS_TEXTURE_UV}, textureBias).{STD_CLEARCOATGLOSS_TEXTURE_CHANNEL};
    #endif

    #ifdef STD_CLEARCOATGLOSS_VERTEX_ENABLED
    ccGlossiness *= saturate(vVertexColor.{STD_CLEARCOATGLOSS_VERTEX_CHANNEL});
    #endif

    #ifdef STD_CLEARCOATGLOSS_INVERT
    ccGlossiness = 1.0 - ccGlossiness;
    #endif

    ccGlossiness += 0.0000001;
}
`;
