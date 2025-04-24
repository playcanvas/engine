export default /* wgsl */`
#ifdef STD_CLEARCOAT_CONSTANT
    uniform material_clearCoat: f32;
#endif

fn getClearCoat() {
    ccSpecularity = 1.0;

    #ifdef STD_CLEARCOAT_CONSTANT
    ccSpecularity = ccSpecularity * uniform.material_clearCoat;
    #endif

    #ifdef STD_CLEARCOAT_TEXTURE
    ccSpecularity = ccSpecularity * textureSampleBias({STD_CLEARCOAT_TEXTURE_NAME}, {STD_CLEARCOAT_TEXTURE_NAME}Sampler, {STD_CLEARCOAT_TEXTURE_UV}, uniform.textureBias).{STD_CLEARCOAT_TEXTURE_CHANNEL};
    #endif

    #ifdef STD_CLEARCOAT_VERTEX
    ccSpecularity = ccSpecularity * saturate(vVertexColor.{STD_CLEARCOAT_VERTEX_CHANNEL});
    #endif
}
`;
