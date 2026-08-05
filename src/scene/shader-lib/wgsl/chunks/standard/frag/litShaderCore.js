export default /* wgsl */`

    // global texture bias for standard textures
    // note: unlike GLSL, the tiled nine-slice mode does not force the top mip here, as the chunks
    // reference this as 'uniform.textureBias' and so it needs to be a real uniform
    uniform textureBias: f32;

    #include "litShaderArgsPS"
`;
