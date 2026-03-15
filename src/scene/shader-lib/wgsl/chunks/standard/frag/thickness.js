export default /* wgsl */`
#ifdef STD_THICKNESS_CONSTANT
uniform material_thickness: f32;
#endif

fn getThickness() {
    dThickness = 1.0;

    #ifdef STD_THICKNESS_CONSTANT
    dThickness = dThickness * uniform.material_thickness;
    #endif

    #ifdef STD_THICKNESS_TEXTURE
    dThickness = dThickness * textureSampleBias({STD_THICKNESS_TEXTURE_NAME}, {STD_THICKNESS_TEXTURE_NAME}Sampler, {STD_THICKNESS_TEXTURE_UV}, uniform.textureBias).{STD_THICKNESS_TEXTURE_CHANNEL};
    #endif

    #ifdef STD_THICKNESS_VERTEX
    dThickness = dThickness * saturate(vVertexColor.{STD_THICKNESS_VERTEX_CHANNEL});
    #endif
}
`;
