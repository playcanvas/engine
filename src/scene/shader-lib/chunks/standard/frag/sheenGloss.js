export default /* glsl */`
uniform float material_sheenGloss;

void getSheenGlossiness() {
    float sheenGlossiness = material_sheenGloss;

    #ifdef STD_SHEENGLOSS_TEXTURE
    sheenGlossiness *= texture2DBias({STD_SHEENGLOSS_TEXTURE_NAME}, {STD_SHEENGLOSS_TEXTURE_UV}, textureBias).{STD_SHEENGLOSS_TEXTURE_CHANNEL};
    #endif

    #ifdef STD_SHEENGLOSS_VERTEX
    sheenGlossiness *= saturate(vVertexColor.{STD_SHEENGLOSS_VERTEX_CHANNEL});
    #endif

    #ifdef STD_SHEENGLOSS_INVERT
    sheenGlossiness = 1.0 - sheenGlossiness;
    #endif

    sGlossiness = sheenGlossiness + 0.0000001;
}
`;
