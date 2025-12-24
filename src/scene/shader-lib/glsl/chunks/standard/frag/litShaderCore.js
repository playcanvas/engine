export default /* glsl */`

    // global texture bias for standard textures
    #if LIT_NONE_SLICE_MODE == TILED
        const float textureBias = -1000.0;
    #else
        uniform float textureBias;
    #endif

    #include "litShaderArgsPS"
`;
