export default /* wgsl */`
#ifndef MESH_COLOR
    uniform material_opacity: f32;
#endif
uniform material_alphaDitherScale: f32;

fn getOpacity() {
    #ifdef MESH_COLOR
        dAlpha = uniform.mesh_color.a;
    #else
        dAlpha = uniform.material_opacity;
    #endif

    #ifdef STD_OPACITY_TEXTURE
    dAlpha = dAlpha * textureSampleBias({STD_OPACITY_TEXTURE_NAME}, {STD_OPACITY_TEXTURE_NAME}Sampler, {STD_OPACITY_TEXTURE_UV}, uniform.textureBias).{STD_OPACITY_TEXTURE_CHANNEL};
    #endif

    #ifdef STD_OPACITY_VERTEX
    dAlpha = dAlpha * clamp(vVertexColor.{STD_OPACITY_VERTEX_CHANNEL}, 0.0, 1.0);
    #endif
}
`;
