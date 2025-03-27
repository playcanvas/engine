export default /* glsl */`
#ifdef STD_METALNESS_MATERIAL_ENABLED
uniform float material_metalness;
#endif

void getMetalness() {
    float metalness = 1.0;

    #ifdef STD_METALNESS_MATERIAL_ENABLED
    metalness *= material_metalness;
    #endif

    #ifdef STD_METALNESS_TEXTURE_ENABLED
    metalness *= texture2DBias({STD_METALNESS_TEXTURE}, {STD_METALNESS_TEXTURE_UV}, textureBias).{STD_METALNESS_TEXTURE_CHANNEL};
    #endif

    #ifdef STD_METALNESS_VERTEX_ENABLED
    metalness *= saturate(vVertexColor.{STD_METALNESS_VERTEX_CHANNEL});
    #endif

    dMetalness = metalness;
}
`;
