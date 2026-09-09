export default /* glsl */`
#ifndef MESH_COLOR
    uniform float material_opacity;
#endif
uniform float material_alphaDitherScale;

void getOpacity() {
    #ifdef MESH_COLOR
        dAlpha = mesh_color.a;
    #else
        dAlpha = material_opacity;
    #endif

    #ifdef STD_OPACITY_TEXTURE
    dAlpha *= texture2DBias({STD_OPACITY_TEXTURE_NAME}, {STD_OPACITY_TEXTURE_UV}, textureBias).{STD_OPACITY_TEXTURE_CHANNEL};
    #endif

    #ifdef STD_OPACITY_VERTEX
    dAlpha *= clamp(vVertexColor.{STD_OPACITY_VERTEX_CHANNEL}, 0.0, 1.0);
    #endif
}
`;
