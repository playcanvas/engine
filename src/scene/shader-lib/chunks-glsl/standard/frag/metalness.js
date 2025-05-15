export default /* glsl */`
#ifdef STD_METALNESS_CONSTANT
uniform float material_metalness;
#endif

void getMetalness() {
    float metalness = 1.0;

    #ifdef STD_METALNESS_CONSTANT
    metalness *= material_metalness;
    #endif

    #ifdef STD_METALNESS_TEXTURE
    metalness *= texture2DBias({STD_METALNESS_TEXTURE_NAME}, {STD_METALNESS_TEXTURE_UV}, textureBias).{STD_METALNESS_TEXTURE_CHANNEL};
    #endif

    #ifdef STD_METALNESS_VERTEX
    metalness *= saturate(vVertexColor.{STD_METALNESS_VERTEX_CHANNEL});
    #endif

    dMetalness = metalness;
}
`;
