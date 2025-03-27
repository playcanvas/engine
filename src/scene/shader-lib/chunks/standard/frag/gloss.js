export default /* glsl */`
#ifdef STD_GLOSS_MATERIAL_ENABLED
uniform float material_gloss;
#endif

void getGlossiness() {
    dGlossiness = 1.0;

    #ifdef STD_GLOSS_MATERIAL_ENABLED
    dGlossiness *= material_gloss;
    #endif

    #ifdef STD_GLOSS_TEXTURE_ENABLED
    dGlossiness *= texture2DBias({STD_GLOSS_TEXTURE}, {STD_GLOSS_TEXTURE_UV}, textureBias).{STD_GLOSS_TEXTURE_CHANNEL};
    #endif

    #ifdef STD_GLOSS_VERTEX_ENABLED
    dGlossiness *= saturate(vVertexColor.{STD_GLOSS_VERTEX_CHANNEL});
    #endif

    #ifdef STD_GLOSS_INVERT
    dGlossiness = 1.0 - dGlossiness;
    #endif

    dGlossiness += 0.0000001;
}
`;
