export default /* wgsl */`
#ifdef STD_METALNESS_CONSTANT
uniform material_metalness: f32;
#endif

fn getMetalness() {
    var metalness: f32 = 1.0;

    #ifdef STD_METALNESS_CONSTANT
        metalness = metalness * uniform.material_metalness;
    #endif

    #ifdef STD_METALNESS_TEXTURE
        metalness = metalness * textureSampleBias({STD_METALNESS_TEXTURE_NAME}, {STD_METALNESS_TEXTURE_NAME}Sampler, {STD_METALNESS_TEXTURE_UV}, uniform.textureBias).{STD_METALNESS_TEXTURE_CHANNEL};
    #endif

    #ifdef STD_METALNESS_VERTEX
    metalness = metalness * saturate(vVertexColor.{STD_METALNESS_VERTEX_CHANNEL});
    #endif

    dMetalness = metalness;
}
`;
