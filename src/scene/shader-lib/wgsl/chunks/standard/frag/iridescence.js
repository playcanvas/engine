export default /* wgsl */`
#ifdef STD_IRIDESCENCE_CONSTANT
    uniform material_iridescence: f32;
#endif

fn getIridescence() {
    var iridescence = 1.0;

    #ifdef STD_IRIDESCENCE_CONSTANT
    iridescence = iridescence * uniform.material_iridescence;
    #endif

    #ifdef STD_IRIDESCENCE_TEXTURE
    iridescence = iridescence * textureSampleBias({STD_IRIDESCENCE_TEXTURE_NAME}, {STD_IRIDESCENCE_TEXTURE_NAME}Sampler, {STD_IRIDESCENCE_TEXTURE_UV}, uniform.textureBias).{STD_IRIDESCENCE_TEXTURE_CHANNEL};
    #endif

    dIridescence = iridescence; 
}
`;
