export default /* wgsl */`

    // global texture bias for standard textures
    #if LIT_NONE_SLICE_MODE == TILED
        var<private> textureBias: f32 = -1000.0;
    #else
        uniform textureBias: f32;
    #endif

    #include "litShaderArgsPS"
`;
