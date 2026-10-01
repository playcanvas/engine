export default /* wgsl */`

    // global texture bias for standard textures, a member of the view uniform buffer
    uniform textureBias: f32;

    // The standard textures sample with {STD_TEXTURE_BIAS}. The tiled nine-slice mode forces the top
    // mip instead, as the tile wrap breaks the derivatives the mip level is based on.
    #if LIT_NONE_SLICE_MODE == TILED
        #define {STD_TEXTURE_BIAS} (-1000.0)
    #else
        #define {STD_TEXTURE_BIAS} uniform.textureBias
    #endif

    #include "litShaderArgsPS"
`;
